import { v2 as cloudinary } from "cloudinary";

// Lazy config — called before first use so env vars are guaranteed to be loaded
const configureCloudinary = () => {
	const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
	const api_key = process.env.CLOUDINARY_API_KEY;
	const api_secret = process.env.CLOUDINARY_API_SECRET;

	if (!cloud_name || !api_key || !api_secret) {
		throw new Error(
			"Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.",
		);
	}

	cloudinary.config({ cloud_name, api_key, api_secret });
};

export interface UploadResult {
	public_id: string;
	secure_url: string;
	resource_type: string;
}

/**
 * Upload file buffer to Cloudinary
 */
export const uploadToCloudinary = async (
	buffer: Buffer,
	fileName: string,
	userId: string,
): Promise<UploadResult> => {
	try {
		configureCloudinary();
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					resource_type: "raw", // For non-image files like PDFs and DOCX
					folder: `nextrole/resumes/${userId}`,
					public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, "")}`, // Remove extension, Cloudinary will add it
					use_filename: true,
					unique_filename: true,
				},
				(error, result) => {
					if (error) {
						console.error("Cloudinary upload error:", error);
						reject(new Error("Failed to upload file to Cloudinary"));
					} else if (result) {
						resolve({
							public_id: result.public_id,
							secure_url: result.secure_url,
							resource_type: result.resource_type,
						});
					} else {
						reject(new Error("No result from Cloudinary upload"));
					}
				},
			);

			uploadStream.end(buffer);
		});
	} catch (error) {
		console.error("Cloudinary upload error:", error);
		throw new Error("Failed to upload file to Cloudinary");
	}
};

/**
 * Get file from Cloudinary as buffer
 */
export const getFromCloudinary = async (publicId: string): Promise<Buffer> => {
	try {
		configureCloudinary();
		const url = cloudinary.url(publicId, { resource_type: "raw" });

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (error) {
		console.error("Cloudinary download error:", error);
		throw new Error("Failed to download file from Cloudinary");
	}
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
	try {
		configureCloudinary();
		const result = await cloudinary.uploader.destroy(publicId, {
			resource_type: "raw",
		});

		if (result.result !== "ok") {
			console.warn("Cloudinary delete warning:", result);
		}
	} catch (error) {
		console.error("Cloudinary delete error:", error);
		throw new Error("Failed to delete file from Cloudinary");
	}
};

/**
 * Generate secure URL for file access
 */
export const getCloudinaryUrl = (publicId: string): string => {
	configureCloudinary();
	return cloudinary.url(publicId, {
		resource_type: "raw",
		secure: true,
	});
};
