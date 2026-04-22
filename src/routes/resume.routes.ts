import { Router } from "express";
import {
	analyzeResumeController,
	deleteResume,
	getResume,
	getResumes,
	improveResumeController,
	uploadResume,
} from "../controllers/resume.controller";
import { protect, requireRole } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

router.use(protect);

// Test endpoint for AI service
router.get("/test-ai", requireRole("candidate"), async (req, res, next) => {
	try {
		const testText =
			"John Doe\nSoftware Engineer\nExperience: 5 years in React, Node.js, Python\nEducation: BS Computer Science";
		const { analyzeResume } = await import("../services/ai.service");
		const result = await analyzeResume(testText);
		res.json({ success: true, data: result });
	} catch (error) {
		next(error);
	}
});

// Candidates only — upload, analyze, manage their own resumes
router.post(
	"/upload",
	requireRole("candidate"),
	upload.single("resume"),
	uploadResume,
);
router.post("/:id/analyze", requireRole("candidate"), analyzeResumeController);
router.post("/:id/improve", requireRole("candidate"), improveResumeController);
router.get("/", requireRole("candidate"), getResumes);
router.get("/:id", requireRole("candidate"), getResume);
router.delete("/:id", requireRole("candidate"), deleteResume);

export default router;
