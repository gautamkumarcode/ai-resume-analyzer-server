import { Router } from "express";
import {
	analyzeResumeController,
	deleteResume,
	getResume,
	getResumes,
	uploadResume,
} from "../controllers/resume.controller";
import { protect } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// All routes are protected
router.use(protect);

router.post("/upload", upload.single("resume"), uploadResume);
router.post("/:id/analyze", analyzeResumeController);
router.get("/", getResumes);
router.get("/:id", getResume);
router.delete("/:id", deleteResume);

export default router;
