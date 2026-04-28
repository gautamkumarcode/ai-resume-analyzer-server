import { Router } from "express";
import { body, param, query } from "express-validator";
import { getJobApplications } from "../controllers/application.controller";
import {
	createJob,
	deleteJob,
	getJob,
	getJobMatch,
	getJobMatches,
	getJobs,
	getRecommendedJobs,
	matchResumeToJob,
	updateInterviewQuestions,
	updateJob,
} from "../controllers/job.controller";
import { protect, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// All routes require authentication
router.use(protect);

const jobValidation = [
	body("title").trim().notEmpty().withMessage("Job title is required"),
	body("company").trim().notEmpty().withMessage("Company name is required"),
	body("description")
		.trim()
		.notEmpty()
		.withMessage("Job description is required"),
	body("type")
		.optional()
		.isIn(["full-time", "part-time", "contract", "internship", "remote"])
		.withMessage("Invalid job type"),
	body("skills").optional().isArray().withMessage("Skills must be an array"),
	body("requirements")
		.optional()
		.isArray()
		.withMessage("Requirements must be an array"),
];

const matchValidation = [
	body("resumeId")
		.notEmpty()
		.isMongoId()
		.withMessage("Valid resume ID is required"),
	body("jobId").notEmpty().isMongoId().withMessage("Valid job ID is required"),
];

const paginationValidation = [
	query("page")
		.optional()
		.isInt({ min: 1 })
		.withMessage("Page must be a positive integer"),
	query("limit")
		.optional()
		.isInt({ min: 1, max: 100 })
		.withMessage("Limit must be between 1 and 100"),
];

// ── Matching routes (candidates only) ──────────────────────────────────────
router.post(
	"/match",
	requireRole("candidate"),
	matchValidation,
	validate,
	matchResumeToJob,
);
router.get(
	"/matches/all",
	requireRole("candidate"),
	paginationValidation,
	validate,
	getJobMatches,
);
router.get(
	"/matches/:id",
	requireRole("candidate"),
	param("id").isMongoId().withMessage("Invalid match ID"),
	validate,
	getJobMatch,
);

// ── Job board (all authenticated users can browse) ─────────────────────────
router.get("/", paginationValidation, validate, getJobs);

// ── Recommended jobs (candidates only) ─────────────────────────────────────
// IMPORTANT: This must come BEFORE /:id to avoid "recommended" being treated as an ID
router.get("/recommended", requireRole("candidate"), getRecommendedJobs);

router.get(
	"/:id",
	param("id").isMongoId().withMessage("Invalid job ID"),
	validate,
	getJob,
);

// ── Job management (recruiters only) ──────────────────────────────────────
router.post("/", requireRole("recruiter"), jobValidation, validate, createJob);
router.put(
	"/:id",
	requireRole("recruiter"),
	param("id").isMongoId().withMessage("Invalid job ID"),
	validate,
	updateJob,
);
router.delete(
	"/:id",
	requireRole("recruiter"),
	param("id").isMongoId().withMessage("Invalid job ID"),
	validate,
	deleteJob,
);

router.get(
	"/:id/applications",
	requireRole("recruiter"),
	param("id").isMongoId().withMessage("Invalid job ID"),
	validate,
	getJobApplications,
);

// ── Interview questions (recruiters only) ──────────────────────────────────
router.put(
	"/:id/interview-questions",
	requireRole("recruiter"),
	param("id").isMongoId().withMessage("Invalid job ID"),
	body("questions").isArray().withMessage("questions must be an array"),
	validate,
	updateInterviewQuestions,
);

export default router;
