import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const getGeminiClient = (): GoogleGenerativeAI => {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
	return new GoogleGenerativeAI(apiKey);
};

const getOpenAIClient = (): OpenAI => {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
	return new OpenAI({ apiKey });
};

const sanitizeJson = (value: string): string => {
	return value
		.replace(/\u201C|\u201D/g, '"')
		.replace(/\u2018|\u2019/g, "'")
		.replace(/,\s*([}\]])/g, "$1");
};

const extractJsonBlock = (value: string): string | null => {
	let inString = false;
	let escape = false;
	let startIndex = -1;
	const stack: string[] = [];

	for (let i = 0; i < value.length; i++) {
		const char = value[i];

		if (escape) {
			escape = false;
			continue;
		}

		if (char === "\\") {
			escape = true;
			continue;
		}

		if (char === '"') {
			inString = !inString;
			continue;
		}

		if (inString) {
			continue;
		}

		if (char === "{" || char === "[") {
			if (startIndex === -1) {
				startIndex = i;
			}
			stack.push(char);
			continue;
		}

		if (char === "}" || char === "]") {
			if (stack.length === 0) {
				continue;
			}
			const last = stack[stack.length - 1];
			if ((last === "{" && char === "}") || (last === "[" && char === "]")) {
				stack.pop();
				if (stack.length === 0 && startIndex !== -1) {
					return value.slice(startIndex, i + 1);
				}
			}
		}
	}

	return null;
};

const parseJsonResponse = <T>(text: string): T => {
	const trimmed = text.trim();

	const stripCodeFence = (value: string): string => {
		const match =
			value.match(/```json\s*([\s\S]*?)```/i) ??
			value.match(/```\s*([\s\S]*?)```/i);
		return match ? match[1].trim() : value.trim();
	};

	const tryParse = (value: string): T | null => {
		try {
			return JSON.parse(value) as T;
		} catch {
			try {
				return JSON.parse(sanitizeJson(value)) as T;
			} catch {
				return null;
			}
		}
	};

	const direct = tryParse(trimmed);
	if (direct) {
		return direct;
	}

	const withoutFence = stripCodeFence(trimmed);
	const fenced = tryParse(withoutFence);
	if (fenced) {
		return fenced;
	}

	const firstBrace = withoutFence.indexOf("{");
	const lastBrace = withoutFence.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		const sliced = withoutFence.slice(firstBrace, lastBrace + 1);
		const slicedParsed = tryParse(sliced);
		if (slicedParsed) {
			return slicedParsed;
		}
	}

	const extracted = extractJsonBlock(withoutFence);
	if (extracted) {
		const extractedParsed = tryParse(extracted);
		if (extractedParsed) {
			return extractedParsed;
		}
	}

	console.error(
		"Failed to parse AI response. Raw text (first 500 chars):",
		text.substring(0, 500),
	);
	throw new Error("Unable to parse JSON from AI response");
};

export interface ResumeAnalysis {
	overallScore: number;
	strengths: string[];
	improvements: string[];
	keywords: string[];
	summary: string;
	parsedData: {
		name?: string;
		email?: string;
		phone?: string;
		location?: string;
		summary?: string;
		skills: { name: string; level?: string }[];
		experience: {
			title: string;
			company: string;
			location?: string;
			description?: string;
		}[];
		education: {
			degree: string;
			institution: string;
			location?: string;
		}[];
	};
}

const MODELS = [
	"gemini-3.0-flash",
	"gemini-2.0-flash",
	"gemini-2.0-flash-lite",
	"gemini-2.5-pro",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (err: any): number | null => {
	const details = err?.errorDetails as any[] | undefined;
	if (!details) return null;
	for (const detail of details) {
		if (detail?.["@type"]?.includes("RetryInfo") && detail.retryDelay) {
			const match = String(detail.retryDelay).match(/(\d+)/);
			if (match) return parseInt(match[1], 10) * 1000;
		}
	}
	return null;
};

const generateWithFallback = async (
	prompt: string,
	systemInstruction: string,
	maxOutputTokens: number,
): Promise<string> => {
	let lastError: Error | null = null;

	// --- Try Gemini models first ---
	for (const modelName of MODELS) {
		try {
			const model = getGeminiClient().getGenerativeModel({
				model: modelName,
				systemInstruction,
			});

			const response = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.3,
					maxOutputTokens,
					responseMimeType: "application/json",
				},
			});

			const candidate = response.response.candidates?.[0];
			if (candidate?.finishReason && candidate.finishReason !== "STOP") {
				console.warn(
					`[AI] Model ${modelName} finish reason: ${candidate.finishReason}`,
				);
			}

			const content = response.response.text();
			if (!content) throw new Error("Empty response from AI");

			console.log(`[AI] Success with Gemini model: ${modelName}`);
			return content;
		} catch (err: any) {
			lastError = err;
			const status = err?.status ?? err?.statusCode;
			if (status === 503 || status === 429 || status === 404) {
				const retryDelay = getRetryDelay(err);
				if (retryDelay && retryDelay <= 20000) {
					console.warn(
						`[AI] ${modelName} rate limited, waiting ${retryDelay}ms...`,
					);
					await sleep(retryDelay);
				} else {
					console.warn(
						`[AI] ${modelName} unavailable (${status}), trying next...`,
					);
				}
				continue;
			}
			// Non-quota error from Gemini — skip straight to OpenAI
			console.warn(
				`[AI] ${modelName} error (${status ?? err?.message}), falling back to OpenAI...`,
			);
			break;
		}
	}

	// --- Fallback: OpenAI ---
	const openaiKey = process.env.OPENAI_API_KEY;
	if (openaiKey) {
		try {
			console.log("[AI] Trying OpenAI gpt-4o-mini...");
			const openai = getOpenAIClient();
			const completion = await openai.chat.completions.create({
				model: "gpt-5.4",
				messages: [
					{ role: "system", content: systemInstruction },
					{ role: "user", content: prompt },
				],
				temperature: 0.3,
				max_tokens: maxOutputTokens,
				response_format: { type: "json_object" },
			});

			const content = completion.choices[0]?.message?.content;
			if (!content) throw new Error("Empty response from OpenAI");

			console.log("[AI] Success with OpenAI gpt-4o-mini");
			return content;
		} catch (openaiErr: any) {
			console.error("[AI] OpenAI also failed:", openaiErr?.message);
			lastError = openaiErr;
		}
	} else {
		console.warn(
			"[AI] No OPENAI_API_KEY configured, cannot fall back to OpenAI",
		);
	}

	throw lastError ?? new Error("All AI providers unavailable");
};

export const analyzeResume = async (
	resumeText: string,
): Promise<ResumeAnalysis> => {
	const prompt = `You are an expert resume analyst and career coach. Analyze this resume and return ONLY valid JSON.

Resume:
${resumeText}

Return this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>", "<improvement 4>", "<improvement 5>"],
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "summary": "<2-3 sentence professional summary>",
  "parsedData": {
    "name": "<full name>",
    "email": "<email>",
    "phone": "<phone>",
    "location": "<city, country>",
    "summary": "<summary from resume>",
    "skills": [{"name": "<skill>", "level": "<beginner|intermediate|advanced|expert>"}],
    "experience": [{"title": "<job title>", "company": "<company>", "location": "<location>", "description": "<responsibilities>"}],
    "education": [{"degree": "<degree>", "institution": "<school>", "location": "<location>"}]
  }
}

Score 90-100 for exceptional, 80-89 strong, 70-79 good, 60-69 average, below 60 needs major work.`;

	try {
		const content = await generateWithFallback(
			prompt,
			"You are an expert resume analyzer. Analyze resumes and provide structured feedback in JSON format.",
			12000,
		);

		console.log(
			"[Resume Analysis] Raw AI response (first 500 chars):",
			content.substring(0, 500),
		);
		console.log("[Resume Analysis] Response length:", content.length);

		try {
			return parseJsonResponse<ResumeAnalysis>(content);
		} catch (parseError) {
			console.error("[Resume Analysis] Failed to parse JSON:", parseError);
			throw parseError;
		}
	} catch (error) {
		console.error("AI Analysis Error:", error);
		throw new Error(
			`Resume analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
};

export interface JobMatchAnalysis {
	matchScore: number;
	skillsMatch: {
		matched: string[];
		missing: string[];
		percentage: number;
	};
	experienceMatch: {
		score: number;
		feedback: string;
	};
	recommendations: string[];
	analysis: string;
}

export const analyzeJobMatch = async (
	resumeText: string,
	jobDescription: string,
	jobRequirements: string[],
	jobSkills: string[],
): Promise<JobMatchAnalysis> => {
	const prompt = `You are an expert recruiter and ATS system. Analyze how well this candidate's resume matches the job posting and provide detailed, actionable feedback.

Resume:
${resumeText}

Job Description:
${jobDescription}

Requirements:
${jobRequirements.join("\n")}

Required Skills:
${jobSkills.join(", ")}

Provide a comprehensive match analysis in the following JSON format:
{
  "matchScore": <overall match score 0-100 based on: skills match (40%), experience match (35%), education/qualifications (15%), cultural fit indicators (10%)>,
  "skillsMatch": {
    "matched": [
      "<exact skill from job requirements found in resume>",
      "List ALL matched skills with exact names"
    ],
    "missing": [
      "<required skill not found in resume>",
      "List ALL missing required skills"
    ],
    "percentage": <percentage of required skills found in resume>
  },
  "experienceMatch": {
    "score": <0-100 based on years of experience, relevant roles, and industry match>,
    "feedback": "<detailed 3-4 sentence analysis covering: years of experience vs requirement, relevance of past roles, industry experience, leadership/seniority level match, specific gaps or strengths>"
  },
  "recommendations": [
    "<specific action to improve match - e.g., 'Add Python certification to skills section'>",
    "<exact keyword to add - e.g., 'Include 'Agile methodology' in project descriptions'>",
    "<experience gap to address - e.g., 'Highlight any cloud migration projects to match AWS requirement'>",
    "<quantification suggestion - e.g., 'Add metrics to team leadership experience (e.g., team size, project budget)'>",
    "<formatting improvement - e.g., 'Move React.js from 'Other Skills' to 'Core Technical Skills' for better visibility'>",
    "Provide 5-8 specific, actionable recommendations prioritized by impact"
  ],
  "analysis": "<comprehensive 4-6 sentence analysis covering:
    1. Overall fit assessment and key strengths
    2. Critical gaps and how they impact candidacy
    3. Specific areas where candidate exceeds requirements
    4. Concrete steps to improve match score
    5. Likelihood of passing ATS screening
    6. Recommendation on whether to apply (strong match/apply with improvements/not recommended)>"
}

MATCHING CRITERIA:
- 85-100: Excellent match - candidate meets or exceeds all requirements
- 70-84: Strong match - candidate meets most requirements with minor gaps
- 55-69: Moderate match - candidate has relevant experience but missing key skills
- 40-54: Weak match - significant gaps in skills or experience
- Below 40: Poor match - candidate does not meet minimum requirements

ANALYSIS GUIDELINES:
- Be specific about which requirements are met and which are missing
- Quantify gaps (e.g., "requires 5 years, candidate has 2 years")
- Identify transferable skills that could compensate for missing requirements
- Suggest exact keywords and phrases to add for ATS optimization
- Provide realistic assessment of interview chances
- Focus on actionable improvements, not just problems

Return only valid JSON, no additional text.`;

	try {
		const content = await generateWithFallback(
			prompt,
			"You are an expert recruiter and resume matcher. Analyze how well candidates match job requirements.",
			8000,
		);

		console.log(
			"[Job Match] Raw AI response (first 500 chars):",
			content.substring(0, 500),
		);

		try {
			return parseJsonResponse<JobMatchAnalysis>(content);
		} catch (parseError) {
			console.error("[Job Match] Failed to parse JSON:", parseError);
			throw parseError;
		}
	} catch (error) {
		console.error("Job Match Analysis Error:", error);
		return {
			matchScore: 0,
			skillsMatch: { matched: [], missing: jobSkills, percentage: 0 },
			experienceMatch: { score: 0, feedback: "Unable to analyze at this time" },
			recommendations: ["Please try again later"],
			analysis: "Analysis unavailable",
		};
	}
};

export interface ImprovementResult {
	improvedBulletPoints: string[];
	missingKeywords: string[];
	formattingSuggestions: string[];
}

export const improveResume = async (
	resumeText: string,
	jobDescription: string,
): Promise<ImprovementResult> => {
	const prompt = `You are an expert resume coach and ATS optimization specialist. Analyze this resume against the job description and provide specific, actionable improvements to increase the match score and pass ATS screening.

Resume:
${resumeText}

Job Description:
${jobDescription}

Return a JSON object with exactly these fields:
{
  "improvedBulletPoints": [
    "<rewrite weak bullet point with: strong action verb + specific task + quantifiable result + relevant keyword>",
    "Example: Change 'Worked on team projects' to 'Led cross-functional team of 5 developers to deliver React-based dashboard, reducing load time by 40%'",
    "Provide 6-10 improved bullet points targeting the weakest sections"
  ],
  "missingKeywords": [
    "<critical keyword from job description> - Add to: <specific section, e.g., 'Skills section' or 'Project X description'>",
    "<technical term from requirements> - Suggestion: <how to naturally incorporate it>",
    "<industry buzzword> - Context: <where it appears in job posting and where to add in resume>",
    "Identify 8-12 missing keywords with specific placement suggestions"
  ],
  "formattingSuggestions": [
    "<structural improvement with specific action - e.g., 'Add a 'Technical Skills' section before Experience to highlight React, Node.js, AWS'>",
    "<content organization - e.g., 'Reorder experience entries to put most relevant role (Frontend Developer) first'>",
    "<quantification - e.g., 'Add metrics to all experience bullets: team size, project scope, performance improvements, cost savings'>",
    "<ATS optimization - e.g., 'Replace skill rating bars with plain text list - ATS cannot parse graphics'>",
    "<keyword density - e.g., 'Mention 'JavaScript' 3-4 times across different sections for better ATS ranking'>",
    "<section additions - e.g., 'Add Certifications section to highlight AWS Solutions Architect certification mentioned in requirements'>",
    "Provide 6-10 specific formatting and structural improvements prioritized by impact"
  ]
}

IMPROVEMENT PRIORITIES:
1. ATS Optimization: Ensure resume passes automated screening
2. Keyword Matching: Include all critical terms from job description
3. Quantification: Add metrics and numbers to demonstrate impact
4. Action Verbs: Use strong, specific verbs (Led, Architected, Optimized vs Worked on, Helped with)
5. Relevance: Highlight most relevant experience and skills prominently
6. Clarity: Make achievements and responsibilities crystal clear

GUIDELINES:
- Every suggestion must be specific and actionable
- Provide exact text replacements, not vague advice
- Focus on changes that directly improve job match
- Prioritize high-impact improvements first
- Include both content and formatting recommendations
- Ensure suggestions are realistic and honest (no fabrication)

Return only valid JSON, no additional text.`;

	try {
		const content = await generateWithFallback(
			prompt,
			"You are an expert resume coach. Provide specific, actionable improvements.",
			8000,
		);

		return parseJsonResponse<ImprovementResult>(content);
	} catch (error) {
		console.error("Resume Improvement Error:", error);
		return {
			improvedBulletPoints: [],
			missingKeywords: [],
			formattingSuggestions: [
				"Unable to generate suggestions at this time. Please try again.",
			],
		};
	}
};

export interface InterviewQuestion {
	question: string;
	category: "technical" | "behavioral" | "situational" | "role-specific";
}

const FALLBACK_QUESTIONS: InterviewQuestion[] = [
	{
		question: "Tell me about your most recent project and your role in it.",
		category: "role-specific",
	},
	{
		question:
			"What is your strongest technical skill and how have you applied it?",
		category: "technical",
	},
	{
		question: "Describe a time you solved a difficult problem under pressure.",
		category: "behavioral",
	},
	{
		question: "How do you approach learning a new technology or framework?",
		category: "situational",
	},
	{
		question: "Where do you see yourself growing technically in the next year?",
		category: "role-specific",
	},
];

export const generateInterviewQuestions = async (
	jobTitle: string,
	jobDescription: string,
	resumeText: string,
	count = 5,
): Promise<InterviewQuestion[]> => {
	// Ask for questions one per line to avoid JSON truncation
	const prompt = `Generate exactly ${count} short interview questions for a ${jobTitle} candidate.
Job focus: ${jobDescription.slice(0, 300)}
Candidate background: ${resumeText.slice(0, 300)}

Output format — one question per line, prefixed with category:
technical: <question under 20 words>
behavioral: <question under 20 words>
situational: <question under 20 words>
role-specific: <question under 20 words>
technical: <question under 20 words>

Output ONLY the 5 lines above, nothing else.`;

	try {
		const content = await generateWithFallback(
			prompt,
			"You are an expert interviewer. Output exactly 5 lines in the requested format.",
			400,
		);

		// Parse "category: question" lines
		const lines = content
			.trim()
			.split("\n")
			.filter((l) => l.includes(":"));
		const questions: InterviewQuestion[] = [];

		for (const line of lines) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1) continue;
			const cat = line.slice(0, colonIdx).trim().toLowerCase();
			const q = line.slice(colonIdx + 1).trim();
			if (!q) continue;
			const validCats = [
				"technical",
				"behavioral",
				"situational",
				"role-specific",
			];
			questions.push({
				question: q,
				category: (validCats.includes(cat)
					? cat
					: "technical") as InterviewQuestion["category"],
			});
			if (questions.length >= count) break;
		}

		// Pad with fallbacks if we didn't get enough
		while (questions.length < count) {
			questions.push(
				FALLBACK_QUESTIONS[questions.length % FALLBACK_QUESTIONS.length],
			);
		}

		return questions;
	} catch (err) {
		console.warn(
			"[Interview] AI question generation failed, using fallback questions:",
			err,
		);
		return FALLBACK_QUESTIONS.slice(0, count);
	}
};

export interface InterviewEvaluation {
	overallScore: number;
	fitLevel: "excellent" | "good" | "average" | "poor";
	summary: string;
	strengths: string[];
	concerns: string[];
	answerEvaluations: { score: number; feedback: string }[];
}

export const evaluateInterview = async (
	jobTitle: string,
	jobDescription: string,
	qaPairs: { question: string; answer: string }[],
): Promise<InterviewEvaluation> => {
	const qaText = qaPairs
		.map(
			(qa, i) =>
				`Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer || "(no answer provided)"}`,
		)
		.join("\n\n");

	const prompt = `You are an expert hiring manager. Evaluate this candidate's interview for the role.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Interview Q&A:
${qaText}

Evaluate and return JSON:
{
  "overallScore": <0-100>,
  "fitLevel": "excellent|good|average|poor",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "answerEvaluations": [
    {"score": <0-10>, "feedback": "<specific feedback on this answer>"},
    ...one per answer in order...
  ]
}

Scoring: 85-100 excellent, 70-84 good, 50-69 average, below 50 poor.
Return only valid JSON.`;

	const content = await generateWithFallback(
		prompt,
		"You are an expert hiring manager evaluating interview responses.",
		3000,
	);
	return parseJsonResponse<InterviewEvaluation>(content);
};

// Exported wrapper for conversational chat turns
export const chatWithAI = async (
	prompt: string,
	systemInstruction: string,
	maxTokens = 300,
): Promise<string> => {
	return generateWithFallback(prompt, systemInstruction, maxTokens);
};
