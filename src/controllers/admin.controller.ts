import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Application, Job, JobMatch, Resume, User } from "../models";

export const getAnalytics = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const [totalUsers, totalJobs, totalApplications, totalResumes] =
			await Promise.all([
				User.countDocuments(),
				Job.countDocuments(),
				Application.countDocuments(),
				Resume.countDocuments(),
			]);

		res.json({
			success: true,
			data: { totalUsers, totalJobs, totalApplications, totalResumes },
		});
	} catch (error) {
		next(error);
	}
};

export const getUsers = async (
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

		const [users, total] = await Promise.all([
			User.find()
				.select("-password")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
			User.countDocuments(),
		]);

		res.json({
			success: true,
			data: {
				users,
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

export const updateUserStatus = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const { active } = req.body;

		const user = await User.findById(id);
		if (!user) throw new ApiError("User not found", 404);

		if (user._id.toString() === req.user!._id.toString()) {
			throw new ApiError("Cannot modify your own account", 400);
		}

		user.active = active;
		await user.save();

		const updated = await User.findById(id).select("-password");
		res.json({ success: true, data: { user: updated } });
	} catch (error) {
		next(error);
	}
};

export const deleteUser = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;

		const user = await User.findById(id);
		if (!user) throw new ApiError("User not found", 404);

		if (user._id.toString() === req.user!._id.toString()) {
			throw new ApiError("Cannot delete your own account", 400);
		}

		await user.deleteOne();
		res.json({ success: true, message: "User deleted successfully" });
	} catch (error) {
		next(error);
	}
};

export const getAdminJobs = async (
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
				.populate("user", "firstName lastName email")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
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

export const deleteAdminJob = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;

		const job = await Job.findById(id);
		if (!job) throw new ApiError("Job not found", 404);

		await job.deleteOne();
		await Application.deleteMany({ jobId: id });
		await JobMatch.deleteMany({ job: id });

		res.json({ success: true, message: "Job deleted successfully" });
	} catch (error) {
		next(error);
	}
};
