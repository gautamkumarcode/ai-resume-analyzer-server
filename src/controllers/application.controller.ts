import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Application, Job, Resume } from "../models";

export const applyToJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { jobId, resumeId } = req.body;

		const job = await Job.findById(jobId);
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		if (resumeId) {
			const resume = await Resume.findOne({
				_id: resumeId,
				user: req.user!._id,
			});
			if (!resume) {
				throw new ApiError("Resume not found or you are not the owner", 403);
			}
		}

		const application = await Application.create({
			candidateId: req.user!._id,
			jobId,
			resumeId: resumeId || undefined,
			status: "applied",
			appliedAt: new Date(),
		});

		res.status(201).json({
			success: true,
			data: { application },
		});
	} catch (error: any) {
		if (error.code === 11000) {
			next(new ApiError("You have already applied to this job", 409));
		} else {
			next(error);
		}
	}
};

export const getMyApplications = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const applications = await Application.find({ candidateId: req.user!._id })
			.sort({ appliedAt: -1 })
			.populate("jobId", "title company location type")
			.populate("resumeId", "fileName");

		res.json({
			success: true,
			data: { applications },
		});
	} catch (error) {
		next(error);
	}
};

export const updateApplicationStatus = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { status } = req.body;

		if (!["shortlisted", "rejected"].includes(status)) {
			throw new ApiError(
				"Invalid status. Must be 'shortlisted' or 'rejected'",
				400,
			);
		}

		const application = await Application.findById(req.params.id);
		if (!application) {
			throw new ApiError("Application not found", 404);
		}

		const job = await Job.findById(application.jobId);
		if (!job || job.user.toString() !== req.user!._id.toString()) {
			throw new ApiError("Not authorized to update this application", 403);
		}

		application.status = status;
		await application.save();

		res.json({
			success: true,
			data: { application },
		});
	} catch (error) {
		next(error);
	}
};

export const withdrawApplication = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const application = await Application.findById(req.params.id);
		if (!application) {
			throw new ApiError("Application not found", 404);
		}

		if (application.candidateId.toString() !== req.user!._id.toString()) {
			throw new ApiError("Not authorized to withdraw this application", 403);
		}

		await application.deleteOne();

		res.json({
			success: true,
			message: "Application withdrawn successfully",
		});
	} catch (error) {
		next(error);
	}
};

export const getJobApplications = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const job = await Job.findById(req.params.id);
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		if (job.user.toString() !== req.user!._id.toString()) {
			throw new ApiError("Not authorized to view these applications", 403);
		}

		const applications = await Application.find({ jobId: req.params.id })
			.populate("candidateId", "firstName lastName email")
			.populate("resumeId", "fileName aiAnalysis.overallScore");

		res.json({
			success: true,
			data: { applications },
		});
	} catch (error) {
		next(error);
	}
};
