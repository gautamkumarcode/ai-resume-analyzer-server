import { NextFunction, Request, Response } from "express";

export interface AppError extends Error {
	statusCode?: number;
	status?: string;
	isOperational?: boolean;
}

export const errorHandler = (
	err: AppError,
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const statusCode = err.statusCode || 500;
	const status = err.status || "error";
	const message = err.message || "Something went wrong";

	console.error("Error:", {
		statusCode,
		status,
		message,
		stack: err.stack,
	});

	res.status(statusCode).json({
		success: false,
		status,
		message,
		...(process.env.NODE_ENV === "development" && { stack: err.stack }),
	});
};

export class ApiError extends Error {
	statusCode: number;
	status: string;
	isOperational: boolean;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
		this.isOperational = true;

		Error.captureStackTrace(this, this.constructor);
	}
}
