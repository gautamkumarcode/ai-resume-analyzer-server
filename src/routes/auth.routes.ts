import { Router } from "express";
import { body } from "express-validator";
import {
	getProfile,
	login,
	register,
	updateProfile,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";

const router = Router();

// Validation rules
const registerValidation = [
	body("email")
		.isEmail()
		.normalizeEmail()
		.withMessage("Please provide a valid email"),
	body("password")
		.isLength({ min: 6 })
		.withMessage("Password must be at least 6 characters"),
	body("firstName").trim().notEmpty().withMessage("First name is required"),
	body("lastName").trim().notEmpty().withMessage("Last name is required"),
	body("role")
		.optional()
		.isIn(["candidate", "recruiter"])
		.withMessage("Role must be candidate or recruiter"),
];

const loginValidation = [
	body("email")
		.isEmail()
		.normalizeEmail()
		.withMessage("Please provide a valid email"),
	body("password").notEmpty().withMessage("Password is required"),
];

const updateProfileValidation = [
	body("firstName")
		.optional()
		.trim()
		.notEmpty()
		.withMessage("First name cannot be empty"),
	body("lastName")
		.optional()
		.trim()
		.notEmpty()
		.withMessage("Last name cannot be empty"),
	body("phone").optional().trim(),
	body("location").optional().trim(),
	body("title").optional().trim(),
	body("company").optional().trim(),
	body("summary").optional().trim(),
	body("experience").optional().trim(),
	body("skills").optional().trim(),
	body("linkedin")
		.optional()
		.trim()
		.custom((value) => {
			if (!value || value === "") return true; // Allow empty values
			if (!value.match(/^https?:\/\/.+/)) {
				throw new Error(
					"LinkedIn must be a valid URL starting with http:// or https://",
				);
			}
			return true;
		}),
	body("website")
		.optional()
		.trim()
		.custom((value) => {
			if (!value || value === "") return true; // Allow empty values
			if (!value.match(/^https?:\/\/.+/)) {
				throw new Error(
					"Website must be a valid URL starting with http:// or https://",
				);
			}
			return true;
		}),
];

// Routes
router.post(
	"/register",
	authRateLimiter,
	registerValidation,
	validate,
	register,
);
router.post("/login", authRateLimiter, loginValidation, validate, login);
router.get("/profile", protect, getProfile);
router.put(
	"/profile",
	protect,
	updateProfileValidation,
	validate,
	updateProfile,
);

export default router;
