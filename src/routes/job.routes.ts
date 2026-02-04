import { Router } from "express";
import { body } from "express-validator";
import {
	createJob,
	deleteJob,
	getJob,
	getJobMatch,
	getJobMatches,
	getJobs,
	matchResumeToJob,
	updateJob,
} from "../controllers/job.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All routes are protected
router.use(protect);

// Job validation
const jobValidation = [
	body("title").notEmpty().withMessage("Job title is required"),
	body("company").notEmpty().withMessage("Company name is required"),
	body("description").notEmpty().withMessage("Job description is required"),
];

// Job routes
router.post("/", jobValidation, createJob);
router.get("/", getJobs);
router.get("/:id", getJob);
router.put("/:id", updateJob);
router.delete("/:id", deleteJob);

// Job matching routes
router.post("/match", matchResumeToJob);
router.get("/matches/all", getJobMatches);
router.get("/matches/:id", getJobMatch);

export default router;
