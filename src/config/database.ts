import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
	try {
		const mongoURI =
			process.env.MONGODB_URI || "mongodb://localhost:27017/ai-resume-analyzer";

		await mongoose.connect(mongoURI);

		console.log("MongoDB connected successfully");

		mongoose.connection.on("error", (err) => {
			console.error("MongoDB connection error:", err);
		});

		mongoose.connection.on("disconnected", () => {
			console.log("MongoDB disconnected");
		});
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
		process.exit(1);
	}
};
