import { Router } from "express";
import {
	chatTurn,
	getCandidateInterviews,
	getJobInterviews,
	startInterview,
	submitInterview,
	textToSpeech,
} from "../controllers/interview.controller";
import { protect, requireRole } from "../middleware/auth";

const router = Router();

router.use(protect);

// TTS proxy — streams ElevenLabs audio, falls back gracefully if no key
router.post("/tts", textToSpeech);

// Conversational chat turn (candidate)
router.post("/chat", requireRole("candidate"), chatTurn);

// Candidate routes
router.post("/start", requireRole("candidate"), startInterview);
router.post("/:id/submit", requireRole("candidate"), submitInterview);
router.get("/my", requireRole("candidate"), getCandidateInterviews);

// Recruiter routes
router.get("/job/:jobId", requireRole("recruiter"), getJobInterviews);

export default router;
