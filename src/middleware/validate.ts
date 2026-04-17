import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

/**
 * Middleware to check express-validator results and return
 * a consistent 422 response if any validation rules failed.
 */
export const validate = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		res.status(422).json({
			success: false,
			message: "Validation failed",
			errors: errors.array().map((e) => ({
				field: e.type === "field" ? e.path : undefined,
				message: e.msg,
			})),
		});
		return;
	}

	next();
};
