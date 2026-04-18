import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
	api_key: process.env.CLOUDINARY_API_KEY!,
	api_secret: process.env.CLOUDINARY_API_SECRET!,
});

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
		// For raw files, we need to fetch the URL and download the content
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
	return cloudinary.url(publicId, {
		resource_type: "raw",
		secure: true,
	});
};
