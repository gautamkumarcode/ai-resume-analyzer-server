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
	phone: user.phone,
	location: user.location,
	title: user.title,
	company: user.company,
	summary: user.summary,
	experience: user.experience,
	skills: user.skills,
	linkedin: user.linkedin,
	website: user.website,
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
		const {
			firstName,
			lastName,
			phone,
			location,
			title,
			company,
			summary,
			experience,
			skills,
			linkedin,
			website,
		} = req.body;

		// Convert skills string to array if provided
		const skillsArray = skills
			? skills
					.split(",")
					.map((s: string) => s.trim())
					.filter(Boolean)
			: undefined;

		// Helper function to handle empty strings
		const processField = (value: any) => {
			if (value === undefined) return undefined;
			if (typeof value === "string" && value.trim() === "") return null;
			return value;
		};

		const updateData: any = {};
		if (firstName !== undefined) updateData.firstName = firstName;
		if (lastName !== undefined) updateData.lastName = lastName;
		if (phone !== undefined) updateData.phone = processField(phone);
		if (location !== undefined) updateData.location = processField(location);
		if (title !== undefined) updateData.title = processField(title);
		if (company !== undefined) updateData.company = processField(company);
		if (summary !== undefined) updateData.summary = processField(summary);
		if (experience !== undefined)
			updateData.experience = processField(experience);
		if (skillsArray !== undefined) updateData.skills = skillsArray;
		if (linkedin !== undefined) updateData.linkedin = processField(linkedin);
		if (website !== undefined) updateData.website = processField(website);

		const user = await User.findByIdAndUpdate(userId, updateData, {
			new: true,
			runValidators: true,
		});

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
