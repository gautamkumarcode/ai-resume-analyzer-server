import fs from "fs";
import mammoth from "mammoth";
import path from "path";
import pdf from "pdf-parse";

export const parseResume = async (
	filePath: string,
	mimeType: string,
): Promise<string> => {
	const absolutePath = path.resolve(filePath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error("File not found");
	}

	let text = "";

	if (mimeType === "application/pdf") {
		const dataBuffer = fs.readFileSync(absolutePath);
		const pdfData = await pdf(dataBuffer);
		text = pdfData.text;
	} else if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		const result = await mammoth.extractRawText({ path: absolutePath });
		text = result.value;
	}

	return text.trim();
};

export const parseResumeFromBuffer = async (
	buffer: Buffer,
	mimeType: string,
): Promise<string> => {
	let text = "";

	if (mimeType === "application/pdf") {
		const pdfData = await pdf(buffer);
		text = pdfData.text;
	} else if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		const result = await mammoth.extractRawText({ buffer });
		text = result.value;
	}

	return text.trim();
};

export const extractContactInfo = (
	text: string,
): { email?: string; phone?: string } => {
	const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
	const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

	const emails = text.match(emailRegex);
	const phones = text.match(phoneRegex);

	return {
		email: emails?.[0],
		phone: phones?.[0],
	};
};
