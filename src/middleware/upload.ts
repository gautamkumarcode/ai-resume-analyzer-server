import { Request } from "express";
import multer from "multer";
import { ApiError } from "./errorHandler";

// Use memory storage for S3 upload
const storage = multer.memoryStorage();

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
