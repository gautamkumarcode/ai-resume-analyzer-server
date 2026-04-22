import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Application, Resume } from "../models";
import { analyzeResume } from "../services/ai.service";
import {
	deleteFromCloudinary,
	uploadToCloudinary,
} from "../services/storage.service";
import { parseResumeFromBuffer } from "../utils/resumeParser";

export const uploadResume = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		if (!req.file) {
			throw new ApiError("Please upload a resume file", 400);
		}

		const userId = req.user!._id.toString();

		console.log(`[Resume Upload] Starting upload for user ${userId}`);
		console.log(
			`[Resume Upload] File: ${req.file.originalname}, Size: ${req.file.size}`,
		);

		// Upload to Cloudinary
		const uploadResult = await uploadToCloudinary(
			req.file.buffer,
			req.file.originalname,
			userId,
		);

		console.log(
			`[Resume Upload] File uploaded to Cloudinary: ${uploadResult.public_id}`,
		);

		// Parse resume text from buffer
		const rawText = await parseResumeFromBuffer(
			req.file.buffer,
			req.file.mimetype,
		);

		console.log(`[Resume Upload] Text parsed, length: ${rawText.length}`);

		// Create resume record first without analysis
		const resume = await Resume.create({
			user: userId,
			fileName: req.file.originalname,
			filePath: uploadResult.public_id, // Store Cloudinary public_id
			fileType: req.file.mimetype,
			rawText,
			parsedData: {
				skills: [],
				experience: [],
				education: [],
			},
		});

		console.log(`[Resume Upload] Resume record created: ${resume._id}`);

		// Try to analyze with AI, but don't fail upload if analysis fails
		try {
			console.log(`[Resume Upload] Starting AI analysis`);
			const analysis = await analyzeResume(rawText);

			console.log(
				`[Resume Upload] AI analysis completed with score: ${analysis.overallScore}`,
			);

			// Update resume with analysis
			resume.aiAnalysis = {
				overallScore: analysis.overallScore,
				strengths: analysis.strengths,
				improvements: analysis.improvements,
				keywords: analysis.keywords,
				summary: analysis.summary,
			};

			resume.parsedData = {
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
			};

			await resume.save();
			console.log(`[Resume Upload] Resume updated with AI analysis`);
		} catch (analysisError) {
			console.error(`[Resume Upload] AI analysis failed:`, analysisError);
			// Continue without analysis - user can analyze later
		}

		res.status(201).json({
			success: true,
			data: { resume },
		});
	} catch (error) {
		console.error(`[Resume Upload] Error:`, error);
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

		// Check if resume has text to analyze
		if (!resume.rawText || resume.rawText.trim().length === 0) {
			throw new ApiError("Resume text not available for analysis", 400);
		}

		console.log(`[Resume Analysis] Starting analysis for resume ${id}`);
		console.log(
			`[Resume Analysis] Resume text length: ${resume.rawText.length}`,
		);

		let analysis;
		try {
			analysis = await analyzeResume(resume.rawText);
		} catch (aiError: any) {
			const msg = aiError?.message ?? "";
			const isQuota =
				msg.includes("quota") || msg.includes("429") || msg.includes("503");
			throw new ApiError(
				isQuota
					? "AI quota exceeded. Please wait a few minutes and try again, or add billing to your Google AI account at https://ai.dev."
					: "Failed to analyze resume. Please try again.",
				503,
			);
		}

		console.log(
			`[Resume Analysis] Analysis completed with score: ${analysis.overallScore}`,
		);

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
		console.error(`[Resume Analysis] Error:`, error);
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

		// Delete file from Cloudinary
		try {
			await deleteFromCloudinary(resume.filePath);
		} catch (error) {
			console.error("Failed to delete file from Cloudinary:", error);
			// Continue even if Cloudinary deletion fails
		}

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
