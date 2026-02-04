import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { IUser, User } from "../models";
import { ApiError } from "./errorHandler";

export interface AuthRequest extends Request {
	user?: IUser;
}

interface JwtPayload {
	id: string;
	iat: number;
	exp: number;
}

export const protect = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		let token: string | undefined;

		if (req.headers.authorization?.startsWith("Bearer")) {
			token = req.headers.authorization.split(" ")[1];
		}

		if (!token) {
			throw new ApiError("Not authorized, no token provided", 401);
		}

		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET || "default-secret",
		) as JwtPayload;

		const user = await User.findById(decoded.id);

		if (!user) {
			throw new ApiError("User not found", 401);
		}

		req.user = user;
		next();
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError) {
			next(new ApiError("Not authorized, invalid token", 401));
		} else {
			next(error);
		}
	}
};
