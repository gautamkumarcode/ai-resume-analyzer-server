import { Router } from "express";
import { param, query } from "express-validator";
import {
    deleteAdminJob,
    deleteUser,
    getAdminJobs,
    getAnalytics,
    getUsers,
    updateUserStatus,
} from "../controllers/admin.controller";
import { protect, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// All admin routes require authentication + admin role
router.use(protect, requireRole("admin"));

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

router.get("/analytics", getAnalytics);
router.get("/users", paginationValidation, validate, getUsers);
router.patch(
	"/users/:id/status",
	param("id").isMongoId().withMessage("Invalid user ID"),
	validate,
	updateUserStatus,
);
router.delete(
	"/users/:id",
	param("id").isMongoId().withMessage("Invalid user ID"),
	validate,
	deleteUser,
);
router.get("/jobs", paginationValidation, validate, getAdminJobs);
router.delete(
	"/jobs/:id",
	param("id").isMongoId().withMessage("Invalid job ID"),
	validate,
	deleteAdminJob,
);

export default router;
