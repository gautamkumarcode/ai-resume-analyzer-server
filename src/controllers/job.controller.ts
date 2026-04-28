import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Application, Job, JobMatch, Resume } from "../models";
import { analyzeJobMatch } from "../services/ai.service";

export const createJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!._id;
		const {
			title,
			company,
			location,
			type,
			description,
			requirements,
			skills,
			salary,
		} = req.body;

		const job = await Job.create({
			user: userId,
			title,
			company,
			location,
			type,
			description,
			requirements,
			skills,
			salary,
		});

		res.status(201).json({
			success: true,
			data: { job },
		});
	} catch (error) {
		next(error);
	}
};

export const getJobs = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(
			100,
			Math.max(1, parseInt(req.query.limit as string) || 20),
		);
		const skip = (page - 1) * limit;

		const [jobs, total] = await Promise.all([
			Job.find()
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("user", "firstName lastName email"),
			Job.countDocuments(),
		]);

		res.json({
			success: true,
			data: {
				jobs,
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const getJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;

		const job = await Job.findById(id).populate(
			"user",
			"firstName lastName email",
		);
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		res.json({
			success: true,
			data: { job },
		});
	} catch (error) {
		next(error);
	}
};

export const updateJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const job = await Job.findOneAndUpdate(
			{ _id: id, user: userId },
			req.body,
			{ new: true, runValidators: true },
		);

		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		res.json({
			success: true,
			data: { job },
		});
	} catch (error) {
		next(error);
	}
};

export const deleteJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const job = await Job.findOneAndDelete({ _id: id, user: userId });
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		// Delete associated applications and job matches
		await Application.deleteMany({ jobId: id });
		await JobMatch.deleteMany({ job: id });

		res.json({
			success: true,
			message: "Job deleted successfully",
		});
	} catch (error) {
		next(error);
	}
};

export const matchResumeToJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { resumeId, jobId } = req.body;
		const userId = req.user!._id;

		// Resume must belong to the user; job can be any job (public board)
		const [resume, job] = await Promise.all([
			Resume.findOne({ _id: resumeId, user: userId }),
			Job.findById(jobId),
		]);

		if (!resume) {
			throw new ApiError("Resume not found", 404);
		}
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		// Analyze match with AI
		const matchAnalysis = await analyzeJobMatch(
			resume.rawText,
			job.description,
			job.requirements,
			job.skills,
		);

		// Create or update job match
		const jobMatch = await JobMatch.findOneAndUpdate(
			{ user: userId, resume: resumeId, job: jobId },
			{
				user: userId,
				resume: resumeId,
				job: jobId,
				matchScore: matchAnalysis.matchScore,
				skillsMatch: matchAnalysis.skillsMatch,
				experienceMatch: matchAnalysis.experienceMatch,
				recommendations: matchAnalysis.recommendations,
				aiAnalysis: matchAnalysis.analysis,
			},
			{ new: true, upsert: true },
		);

		const populated = await jobMatch.populate([
			{ path: "resume", select: "fileName parsedData.name" },
			{ path: "job", select: "title company" },
		]);

		res.json({
			success: true,
			data: { jobMatch: populated },
		});
	} catch (error) {
		next(error);
	}
};

export const getJobMatches = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!._id;
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(
			100,
			Math.max(1, parseInt(req.query.limit as string) || 20),
		);
		const skip = (page - 1) * limit;

		const [jobMatches, total] = await Promise.all([
			JobMatch.find({ user: userId })
				.populate("resume", "fileName parsedData.name")
				.populate("job", "title company location type")
				.sort({ matchScore: -1 })
				.skip(skip)
				.limit(limit),
			JobMatch.countDocuments({ user: userId }),
		]);

		res.json({
			success: true,
			data: {
				jobMatches,
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const getJobMatch = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const jobMatch = await JobMatch.findOne({ _id: id, user: userId })
			.populate("resume")
			.populate("job");

		if (!jobMatch) {
			throw new ApiError("Job match not found", 404);
		}

		res.json({
			success: true,
			data: { jobMatch },
		});
	} catch (error) {
		next(error);
	}
};

export const getRecommendedJobs = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!._id;

		// Find all resumes for the user
		const resumes = await Resume.find({ user: userId });

		if (resumes.length === 0) {
			throw new ApiError("Please upload a resume first", 400);
		}

		// Select the resume with the highest aiAnalysis.overallScore
		const bestResume = resumes.reduce((best, current) => {
			const bestScore = best.aiAnalysis?.overallScore ?? 0;
			const currentScore = current.aiAnalysis?.overallScore ?? 0;
			return currentScore > bestScore ? current : best;
		});

		// Fetch the 50 most recently created jobs
		const jobs = await Job.find().sort({ createdAt: -1 }).limit(50);

		// Run Promise.all to analyze each job against the best resume
		const matchResults = await Promise.all(
			jobs.map(async (job) => {
				const matchAnalysis = await analyzeJobMatch(
					bestResume.rawText,
					job.description,
					job.requirements,
					job.skills,
				);
				return {
					...job.toObject(),
					matchScore: matchAnalysis.matchScore,
				};
			}),
		);

		// Sort by matchScore descending and take top 5
		const topJobs = matchResults
			.sort((a, b) => b.matchScore - a.matchScore)
			.slice(0, 5);

		res.json({
			success: true,
			data: { recommendedJobs: topJobs },
		});
	} catch (error) {
		next(error);
	}
};

export const updateInterviewQuestions = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const { questions } = req.body as { questions: string[] };
		const userId = req.user!._id;

		if (!Array.isArray(questions)) {
			throw new ApiError("questions must be an array of strings", 400);
		}

		const job = await Job.findOneAndUpdate(
			{ _id: id, user: userId },
			{ interviewQuestions: questions.filter((q) => q.trim()) },
			{ new: true },
		);

		if (!job) throw new ApiError("Job not found", 404);

		res.json({ success: true, data: { job } });
	} catch (error) {
		next(error);
	}
};
