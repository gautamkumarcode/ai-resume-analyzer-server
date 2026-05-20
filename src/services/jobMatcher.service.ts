import { GoogleGenerativeAI } from "@google/generative-ai";

export interface JobMatchResult {
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
	aiAnalysis: string;
}

interface ParsedResume {
	skills: string[];
	experience: Array<{
		title: string;
		years?: number;
		description?: string;
	}>;
	summary?: string;
}

interface JobDescription {
	title: string;
	description: string;
	skills?: string[];
	requirements?: string[];
}

/**
 * Extract job requirements from job description using AI
 */
export const extractJobRequirements = async (
	jobDescription: string,
): Promise<string[]> => {
	try {
		const geminiKey = process.env.GEMINI_API_KEY;
		if (geminiKey) {
			const genAI = new GoogleGenerativeAI(geminiKey);
			const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

			const result = await model.generateContent({
				contents: [
					{
						role: "user",
						parts: [
							{
								text: `Extract the top required skills and qualifications from this job description. Return as a JSON array of strings.

Job Description:
${jobDescription}

Return format: ["skill1", "skill2", "skill3", ...]`,
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.3,
					maxOutputTokens: 500,
					responseMimeType: "application/json",
				},
			});

			const text = result.response.text();
			return JSON.parse(text);
		}

		// Fallback: basic keyword extraction
		const keywords = [
			"javascript",
			"typescript",
			"react",
			"node.js",
			"python",
			"django",
			"flask",
			"mongodb",
			"postgresql",
			"aws",
			"docker",
			"kubernetes",
			"git",
			"rest api",
			"graphql",
		];

		return keywords.filter((kw) => jobDescription.toLowerCase().includes(kw));
	} catch (error) {
		console.error("[JobMatcher] Error extracting requirements:", error);
		return [];
	}
};

/**
 * Calculate skill match between resume and job
 */
export const calculateSkillMatch = (
	resumeSkills: string[],
	jobSkills: string[],
): { matched: string[]; missing: string[]; percentage: number } => {
	const normalizeSkill = (skill: string) => skill.toLowerCase().trim();

	const normalizedResumeSkills = resumeSkills.map(normalizeSkill);
	const normalizedJobSkills = jobSkills.map(normalizeSkill);

	// Find matched skills (with fuzzy matching)
	const matched: string[] = [];
	const missing: string[] = [];

	for (const jobSkill of normalizedJobSkills) {
		const found = normalizedResumeSkills.some(
			(resumeSkill) =>
				resumeSkill.includes(jobSkill) ||
				jobSkill.includes(resumeSkill) ||
				resumeSkill === jobSkill,
		);

		if (found) {
			matched.push(jobSkill);
		} else {
			missing.push(jobSkill);
		}
	}

	const percentage =
		normalizedJobSkills.length > 0
			? Math.round((matched.length / normalizedJobSkills.length) * 100)
			: 0;

	return { matched, missing, percentage };
};

/**
 * Calculate experience match score
 */
export const calculateExperienceMatch = (
	experience: ParsedResume["experience"],
	jobDescription: string,
	jobTitle: string,
): { score: number; feedback: string } => {
	let totalYears = 0;
	let feedback = "";

	// Calculate total years
	for (const exp of experience) {
		totalYears += exp.years || 0;
	}

	// Determine required experience level from job title
	const seniorPatterns = ["senior", "lead", "manager", "principal"];
	const midPatterns = ["mid", "mid-level", "experienced"];
	const juniorPatterns = ["junior", "entry-level", "intern"];

	const jobTitleLower = jobTitle.toLowerCase();
	let requiredYears = 2; // Default

	if (seniorPatterns.some((p) => jobTitleLower.includes(p))) {
		requiredYears = 5;
	} else if (midPatterns.some((p) => jobTitleLower.includes(p))) {
		requiredYears = 3;
	} else if (juniorPatterns.some((p) => jobTitleLower.includes(p))) {
		requiredYears = 0;
	}

	// Calculate score
	const experienceScore = Math.min(100, (totalYears / requiredYears) * 100);

	if (totalYears >= requiredYears * 1.5) {
		feedback = `Excellent experience match. ${totalYears}+ years aligns well with role requirements.`;
	} else if (totalYears >= requiredYears) {
		feedback = `Good experience match. ${totalYears} years meets requirements.`;
	} else if (totalYears >= requiredYears * 0.5) {
		feedback = `Moderate experience. ${totalYears} years is slightly below the ${requiredYears} years suggested.`;
	} else {
		feedback = `Limited experience. ${totalYears} years is below the suggested ${requiredYears} years.`;
	}

	return { score: Math.round(experienceScore), feedback };
};

/**
 * Generate AI recommendations using Claude/Gemini
 */
export const generateRecommendations = async (
	jobDescription: string,
	resumeText: string,
	matchPercentage: number,
): Promise<string[]> => {
	try {
		const geminiKey = process.env.GEMINI_API_KEY;
		if (geminiKey) {
			const genAI = new GoogleGenerativeAI(geminiKey);
			const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

			const result = await model.generateContent({
				contents: [
					{
						role: "user",
						parts: [
							{
								text: `Given this job description and resume, provide 3-5 specific, actionable recommendations to improve the application.

Job Description:
${jobDescription.substring(0, 1500)}

Resume (excerpt):
${resumeText.substring(0, 1000)}

Match Score: ${matchPercentage}%

Provide recommendations as a JSON array of strings.`,
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.5,
					maxOutputTokens: 500,
					responseMimeType: "application/json",
				},
			});

			const text = result.response.text();
			return JSON.parse(text);
		}

		// Fallback recommendations
		return [
			"Highlight relevant projects that match the job requirements",
			"Add specific metrics and achievements to your experience",
			"Include keywords from the job description naturally",
			"Consider adding a cover letter tailored to this role",
		];
	} catch (error) {
		console.error("[JobMatcher] Error generating recommendations:", error);
		return [
			"Review the job description carefully",
			"Highlight matching skills and experience",
		];
	}
};

/**
 * Match resume with job description - returns comprehensive match score
 */
export const matchJobWithResume = async (
	job: JobDescription,
	resumeData: ParsedResume,
	resumeText: string,
): Promise<JobMatchResult> => {
	try {
		// Extract job requirements if not provided
		const jobSkills =
			job.skills || (await extractJobRequirements(job.description));

		// Calculate skill match
		const skillsMatch = calculateSkillMatch(resumeData.skills, jobSkills);

		// Calculate experience match
		const experienceMatch = calculateExperienceMatch(
			resumeData.experience,
			job.description,
			job.title,
		);

		// Generate recommendations
		const overallScore = (skillsMatch.percentage + experienceMatch.score) / 2;
		const recommendations = await generateRecommendations(
			job.description,
			resumeText,
			Math.round(overallScore),
		);

		// Create AI analysis summary
		const aiAnalysis = `
This resume matches ${Math.round(overallScore)}% of the job requirements.

Skills Match: ${skillsMatch.percentage}% (${skillsMatch.matched.length}/${jobSkills.length} skills matched)
Experience: ${experienceMatch.feedback}

Key Matched Skills: ${skillsMatch.matched.slice(0, 3).join(", ") || "None"}
Missing Skills: ${skillsMatch.missing.slice(0, 3).join(", ") || "None"}
		`.trim();

		return {
			matchScore: Math.round(overallScore),
			skillsMatch,
			experienceMatch,
			recommendations,
			aiAnalysis,
		};
	} catch (error) {
		console.error("[JobMatcher] Error matching job with resume:", error);
		throw new Error(`Job matching failed: ${(error as Error).message}`);
	}
};

/**
 * Batch match multiple jobs with a resume
 */
export const batchMatchJobsWithResume = async (
	jobs: JobDescription[],
	resumeData: ParsedResume,
	resumeText: string,
): Promise<Array<JobDescription & JobMatchResult>> => {
	const matches = await Promise.all(
		jobs.map(async (job) => {
			try {
				const match = await matchJobWithResume(job, resumeData, resumeText);
				return { ...job, ...match };
			} catch (error) {
				console.error(
					`[JobMatcher] Failed to match job "${job.title}":`,
					error,
				);
				return {
					...job,
					matchScore: 0,
					skillsMatch: { matched: [], missing: [], percentage: 0 },
					experienceMatch: { score: 0, feedback: "Error calculating match" },
					recommendations: [],
					aiAnalysis: "Failed to calculate match",
				};
			}
		}),
	);

	// Sort by match score
	return matches.sort((a, b) => b.matchScore - a.matchScore);
};

export default {
	extractJobRequirements,
	calculateSkillMatch,
	calculateExperienceMatch,
	generateRecommendations,
	matchJobWithResume,
	batchMatchJobsWithResume,
};
