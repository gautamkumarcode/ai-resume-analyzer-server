import { NextFunction, Response } from "express";
import fs from "fs";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Application, Resume } from "../models";
import { analyzeResume } from "../services/ai.service";
import { parseResume } from "../utils/resumeParser";

export const uploadResume = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		if (!req.file) {
			throw new ApiError("Please upload a resume file", 400);
		}

		const userId = req.user!._id;

		// Parse resume text
		const rawText = await parseResume(req.file.path, req.file.mimetype);

		// Analyze with AI on upload
		const analysis = await analyzeResume(rawText);

		// Create resume record with analysis
		const resume = await Resume.create({
			user: userId,
			fileName: req.file.originalname,
			filePath: req.file.path,
			fileType: req.file.mimetype,
			rawText,
			aiAnalysis: {
				overallScore: analysis.overallScore,
				strengths: analysis.strengths,
				improvements: analysis.improvements,
				keywords: analysis.keywords,
				summary: analysis.summary,
			},
			parsedData: {
				name: analysis.parsedData.name,
				email: analysis.parsedData.email,
				phone: analysis.parsedData.phone,
				location: analysis.parsedData.location,
				summary: analysis.parsedData.summary,
				skills: analysis.parsedData.skills.map((skill) => ({
					name: skill.name,
					level: skill.level as any,
				})),
				experience: analysis.parsedData.experience,
				education: analysis.parsedData.education,
			},
		});

		res.status(201).json({
			success: true,
			data: { resume },
		});
	} catch (error) {
		// Clean up uploaded file on error
		if (req.file) {
			fs.unlink(req.file.path, () => {});
		}
		next(error);
	}
};

export const analyzeResumeController = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const resume = await Resume.findOne({ _id: id, user: userId });
		if (!resume) {
			throw new ApiError("Resume not found", 404);
		}

		// Analyze with AI
		const analysis = await analyzeResume(resume.rawText);

		// Update resume with analysis
		resume.aiAnalysis = {
			overallScore: analysis.overallScore,
			strengths: analysis.strengths,
			improvements: analysis.improvements,
			keywords: analysis.keywords,
			summary: analysis.summary,
		};

		resume.parsedData = {
			...resume.parsedData,
			...analysis.parsedData,
			skills: analysis.parsedData.skills.map((s) => ({
				name: s.name,
				level: s.level as any,
			})),
		};

		await resume.save();

		res.json({
			success: true,
			data: { resume },
		});
	} catch (error) {
		next(error);
	}
};

export const getResumes = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!._id;

		const resumes = await Resume.find({ user: userId })
			.select("-rawText")
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			data: { resumes },
		});
	} catch (error) {
		next(error);
	}
};

export const getResume = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const resume = await Resume.findOne({ _id: id, user: userId });
		if (!resume) {
			throw new ApiError("Resume not found", 404);
		}

		res.json({
			success: true,
			data: { resume },
		});
	} catch (error) {
		next(error);
	}
};

export const deleteResume = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const userId = req.user!._id;

		const resume = await Resume.findOneAndDelete({ _id: id, user: userId });
		if (!resume) {
			throw new ApiError("Resume not found", 404);
		}

		// Nullify resumeId on associated applications
		await Application.updateMany(
			{ resumeId: id },
			{ $set: { resumeId: null } },
		);

		// Delete file
		fs.unlink(resume.filePath, () => {});

		res.json({
			success: true,
			message: "Resume deleted successfully",
		});
	} catch (error) {
		next(error);
	}
};

export const improveResumeController = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const { jobId } = req.body;
		const userId = req.user!._id;

		const resume = await Resume.findOne({ _id: id, user: userId });
		if (!resume) {
			throw new ApiError("Resume not found", 404);
		}

		const { Job } = await import("../models");
		const job = await Job.findById(jobId);
		if (!job) {
			throw new ApiError("Job not found", 404);
		}

		const { improveResume } = await import("../services/ai.service");
		const result = await improveResume(resume.rawText, job.description);

		res.json({
			success: true,
			data: { improvement: result },
		});
	} catch (error) {
		next(error);
	}
};
