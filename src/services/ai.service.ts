import OpenAI from "openai";

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
	if (!openai) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.");
		}
		openai = new OpenAI({ apiKey });
	}
	return openai;
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
		const response = await getOpenAIClient().chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"You are an expert resume analyzer. Analyze resumes and provide structured feedback in JSON format.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.3,
			max_tokens: 2000,
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return JSON.parse(content);
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
		const response = await getOpenAIClient().chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"You are an expert recruiter and resume matcher. Analyze how well candidates match job requirements.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.3,
			max_tokens: 1500,
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return JSON.parse(content);
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
