import { GoogleGenerativeAI } from "@google/generative-ai";

// Lazy initialization of Gemini client
let gemini: GoogleGenerativeAI | null = null;

const getGeminiClient = (): GoogleGenerativeAI => {
	if (!gemini) {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error(
				"Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file.",
			);
		}
		gemini = new GoogleGenerativeAI(apiKey);
	}
	return gemini;
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

export const analyzeResume = async (
	resumeText: string,
): Promise<ResumeAnalysis> => {
	const prompt = `Analyze the following resume and provide a structured analysis in JSON format.

Resume:
${resumeText}

Provide the analysis in the following JSON format:
{
  "overallScore": <number from 0-100>,
  "strengths": ["<strength1>", "<strength2>", ...],
  "improvements": ["<improvement1>", "<improvement2>", ...],
  "keywords": ["<keyword1>", "<keyword2>", ...],
  "summary": "<brief summary of the candidate>",
  "parsedData": {
    "name": "<candidate name>",
    "email": "<email if found>",
    "phone": "<phone if found>",
    "location": "<location if found>",
    "summary": "<professional summary if found>",
    "skills": [{"name": "<skill>", "level": "<beginner|intermediate|advanced|expert>"}],
    "experience": [{"title": "<job title>", "company": "<company>", "location": "<location>", "description": "<description>"}],
    "education": [{"degree": "<degree>", "institution": "<institution>", "location": "<location>"}]
  }
}

Return only valid JSON, no additional text.`;

	try {
		const model = getGeminiClient().getGenerativeModel({
			model: "gemini-2.5-flash",
			systemInstruction:
				"You are an expert resume analyzer. Analyze resumes and provide structured feedback in JSON format.",
		});

		const response = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: {
				temperature: 0.3,
				maxOutputTokens: 8000,
				responseMimeType: "application/json",
			},
		});

		const candidate = response.response.candidates?.[0];
		const finishReason = candidate?.finishReason;

		if (finishReason && finishReason !== "STOP") {
			console.warn(
				`[Resume Analysis] Response truncated. Finish reason: ${finishReason}`,
			);
		}

		const content = response.response.text();
		if (!content) {
			throw new Error("No response from AI");
		}

		console.log(
			"[Resume Analysis] Raw AI response (first 500 chars):",
			content.substring(0, 500),
		);
		console.log(
			"[Resume Analysis] Response length:",
			content.length,
			"Finish reason:",
			finishReason,
		);

		try {
			return parseJsonResponse<ResumeAnalysis>(content);
		} catch (parseError) {
			console.error("[Resume Analysis] Failed to parse JSON:", parseError);
			console.error("[Resume Analysis] Full response:", content);
			throw parseError;
		}
	} catch (error) {
		console.error("AI Analysis Error:", error);
		// Return default analysis if AI fails
		return {
			overallScore: 0,
			strengths: [],
			improvements: ["Unable to analyze resume at this time"],
			keywords: [],
			summary: "Analysis unavailable",
			parsedData: {
				skills: [],
				experience: [],
				education: [],
			},
		};
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
	const prompt = `Analyze how well this resume matches the job description and requirements.

Resume:
${resumeText}

Job Description:
${jobDescription}

Requirements:
${jobRequirements.join("\n")}

Required Skills:
${jobSkills.join(", ")}

Provide the analysis in the following JSON format:
{
  "matchScore": <number from 0-100>,
  "skillsMatch": {
    "matched": ["<skill1>", "<skill2>"],
    "missing": ["<skill1>", "<skill2>"],
    "percentage": <number from 0-100>
  },
  "experienceMatch": {
    "score": <number from 0-100>,
    "feedback": "<feedback about experience match>"
  },
  "recommendations": ["<recommendation1>", "<recommendation2>"],
  "analysis": "<detailed analysis of the match>"
}

Return only valid JSON, no additional text.`;

	try {
		const model = getGeminiClient().getGenerativeModel({
			model: "gemini-2.5-flash",
			systemInstruction:
				"You are an expert recruiter and resume matcher. Analyze how well candidates match job requirements.",
		});

		const response = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: {
				temperature: 0.3,
				maxOutputTokens: 4000,
				responseMimeType: "application/json",
			},
		});

		const candidate = response.response.candidates?.[0];
		const finishReason = candidate?.finishReason;

		if (finishReason && finishReason !== "STOP") {
			console.warn(
				`[Job Match] Response truncated. Finish reason: ${finishReason}`,
			);
		}

		const content = response.response.text();
		if (!content) {
			throw new Error("No response from AI");
		}

		console.log(
			"[Job Match] Raw AI response (first 500 chars):",
			content.substring(0, 500),
		);
		console.log(
			"[Job Match] Response length:",
			content.length,
			"Finish reason:",
			finishReason,
		);

		try {
			return parseJsonResponse<JobMatchAnalysis>(content);
		} catch (parseError) {
			console.error("[Job Match] Failed to parse JSON:", parseError);
			console.error("[Job Match] Full response:", content);
			throw parseError;
		}
	} catch (error) {
		console.error("Job Match Analysis Error:", error);
		return {
			matchScore: 0,
			skillsMatch: {
				matched: [],
				missing: jobSkills,
				percentage: 0,
			},
			experienceMatch: {
				score: 0,
				feedback: "Unable to analyze at this time",
			},
			recommendations: ["Please try again later"],
			analysis: "Analysis unavailable",
		};
	}
};
