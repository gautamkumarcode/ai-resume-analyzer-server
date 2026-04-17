import { Router } from "express";
import { body, param } from "express-validator";
import {
	applyToJob,
	getMyApplications,
	updateApplicationStatus,
	withdrawApplication,
} from "../controllers/application.controller";
import { protect, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const applyValidation = [
	body("jobId").notEmpty().isMongoId().withMessage("Valid job ID is required"),
	body("resumeId")
		.optional()
		.isMongoId()
		.withMessage("resumeId must be a valid ID"),
];

const statusValidation = [
	body("status")
		.isIn(["shortlisted", "rejected"])
		.withMessage("Status must be 'shortlisted' or 'rejected'"),
];

router.post(
	"/",
	protect,
	requireRole("candidate"),
	applyValidation,
	validate,
	applyToJob,
);

router.get("/my", protect, requireRole("candidate"), getMyApplications);

router.patch(
	"/:id/status",
	protect,
	requireRole("recruiter"),
	param("id").isMongoId().withMessage("Invalid application ID"),
	statusValidation,
	validate,
	updateApplicationStatus,
);

router.delete(
	"/:id",
	protect,
	requireRole("candidate"),
	param("id").isMongoId().withMessage("Invalid application ID"),
	validate,
	withdrawApplication,
);

export default router;
