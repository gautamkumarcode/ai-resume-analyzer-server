import jwt, { SignOptions } from "jsonwebtoken";
import { IUser } from "../models";

export const generateToken = (user: IUser): string => {
	const options: SignOptions = {
		expiresIn: "7d",
	};
	return jwt.sign(
		{ id: user._id },
		process.env.JWT_SECRET || "default-secret",
		options,
	);
};
