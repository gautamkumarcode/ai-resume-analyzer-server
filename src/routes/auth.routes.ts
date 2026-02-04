import { Router } from "express";
import { body } from "express-validator";
import {
	getProfile,
	login,
	register,
	updateProfile,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth";

const router = Router();

// Validation rules
const registerValidation = [
	body("email").isEmail().withMessage("Please provide a valid email"),
	body("password")
		.isLength({ min: 6 })
		.withMessage("Password must be at least 6 characters"),
	body("firstName").notEmpty().withMessage("First name is required"),
	body("lastName").notEmpty().withMessage("Last name is required"),
];

const loginValidation = [
	body("email").isEmail().withMessage("Please provide a valid email"),
	body("password").notEmpty().withMessage("Password is required"),
];

// Routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;
