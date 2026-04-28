import { Router } from "express";
import {
    getCandidateInterviews,
    getJobInterviews,
    startInterview,
    submitInterview,
} from "../controllers/interview.controller";
import { protect, requireRole } from "../middleware/auth";

const router = Router();

router.use(protect);

// Candidate routes
router.post("/start", requireRole("candidate"), startInterview);
router.post("/:id/submit", requireRole("candidate"), submitInterview);
router.get("/my", requireRole("candidate"), getCandidateInterviews);

// Recruiter routes
router.get("/job/:jobId", requireRole("recruiter"), getJobInterviews);

export default router;
