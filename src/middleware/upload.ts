import { Request } from "express";
import multer from "multer";
import path from "path";
import { ApiError } from "./errorHandler";

// Configure storage
const storage = multer.diskStorage({
	destination: (req: Request, file: Express.Multer.File, cb) => {
		cb(null, "uploads/");
	},
	filename: (req: Request, file: Express.Multer.File, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
	},
});

// File filter
const fileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback,
) => {
	const allowedTypes = [
		"application/pdf",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new ApiError("Only PDF and DOCX files are allowed", 400) as any);
	}
};

export const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
});
