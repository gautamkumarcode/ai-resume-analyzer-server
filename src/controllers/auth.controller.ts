import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { User } from "../models";
import { generateToken } from "../utils/jwt";

const serializeUser = (user: InstanceType<typeof User>) => ({
	id: user._id,
	email: user.email,
	firstName: user.firstName,
	lastName: user.lastName,
	role: user.role,
	createdAt: user.createdAt,
});

export const register = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { email, password, firstName, lastName, role } = req.body;

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			throw new ApiError("User already exists with this email", 400);
		}

		const user = await User.create({
			email,
			password,
			firstName,
			lastName,
			role: role === "recruiter" ? "recruiter" : "candidate",
		});

		const token = generateToken(user);

		res.status(201).json({
			success: true,
			data: { user: serializeUser(user), token },
		});
	} catch (error) {
		next(error);
	}
};

export const login = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { email, password } = req.body;

		const user = await User.findOne({ email }).select("+password");
		if (!user) {
			throw new ApiError("Invalid credentials", 401);
		}

		const isMatch = await user.comparePassword(password);
		if (!isMatch) {
			throw new ApiError("Invalid credentials", 401);
		}

		const token = generateToken(user);

		res.json({
			success: true,
			data: { user: serializeUser(user), token },
		});
	} catch (error) {
		next(error);
	}
};

export const getProfile = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		res.json({
			success: true,
			data: { user: serializeUser(req.user as any) },
		});
	} catch (error) {
		next(error);
	}
};

export const updateProfile = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!._id;
		const { firstName, lastName } = req.body;

		const user = await User.findByIdAndUpdate(
			userId,
			{ firstName, lastName },
			{ new: true, runValidators: true },
		);

		if (!user) {
			throw new ApiError("User not found", 404);
		}

		res.json({
			success: true,
			data: { user: serializeUser(user) },
		});
	} catch (error) {
		next(error);
	}
};
