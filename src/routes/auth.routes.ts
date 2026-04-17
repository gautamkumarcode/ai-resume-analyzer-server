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
