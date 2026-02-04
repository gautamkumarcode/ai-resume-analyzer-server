import { NextFunction, Request, Response } from "express";
import { ApiError } from "../middleware/errorHandler";
import { User } from "../models";
import { generateToken } from "../utils/jwt";

export const register = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { email, password, firstName, lastName } = req.body;

		// Check if user exists
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			throw new ApiError("User already exists with this email", 400);
		}

		// Create user
		const user = await User.create({
			email,
			password,
			firstName,
			lastName,
		});

		// Generate token
		const token = generateToken(user);

		res.status(201).json({
			success: true,
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
				},
				token,
			},
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

		// Find user with password
		const user = await User.findOne({ email }).select("+password");
		if (!user) {
			throw new ApiError("Invalid credentials", 401);
		}

		// Check password
		const isMatch = await user.comparePassword(password);
		if (!isMatch) {
			throw new ApiError("Invalid credentials", 401);
		}

		// Generate token
		const token = generateToken(user);

		res.json({
			success: true,
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
				},
				token,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const getProfile = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const user = (req as any).user;

		res.json({
			success: true,
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					createdAt: user.createdAt,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const updateProfile = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user._id;
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
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};
