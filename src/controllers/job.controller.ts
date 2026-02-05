import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Job, JobMatch, Resume } from "../models";
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
		// Public job board - show all jobs to all users
		const jobs = await Job.find()
			.sort({ createdAt: -1 })
			.populate("user", "name email");

		res.json({
			success: true,
			data: { jobs },
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

		// Allow viewing any job (public job board)
		const job = await Job.findById(id).populate("user", "name email");
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

		// Delete associated job matches
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

		// Get resume and job
		const [resume, job] = await Promise.all([
			Resume.findOne({ _id: resumeId, user: userId }),
			Job.findOne({ _id: jobId, user: userId }),
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

		res.json({
			success: true,
			data: { jobMatch },
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

		const jobMatches = await JobMatch.find({ user: userId })
			.populate("resume", "fileName parsedData.name")
			.populate("job", "title company")
			.sort({ matchScore: -1 });

		res.json({
			success: true,
			data: { jobMatches },
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
