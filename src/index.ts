import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { closeQueues } from "./queue/index";
import { connectRedis, disconnectRedis } from "./queue/redis.config";
import adminRoutes from "./routes/admin.routes";
import applicationRoutes from "./routes/application.routes";
import authRoutes from "./routes/auth.routes";
import externalRoutes from "./routes/external.routes";
import interviewRoutes from "./routes/interview.routes";
import jobRoutes from "./routes/job.routes";
import resumeRoutes from "./routes/resume.routes";
import scraperRoutes from "./routes/scraper.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
let jobScraperWorkerInstance: {
	close: () => Promise<void>;
	waitUntilReady: () => Promise<void>;
} | null = null;

// CORS — restrict to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
	: ["http://localhost:3000"];

app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (e.g. mobile apps, curl)
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error(`CORS: origin '${origin}' not allowed`));
			}
		},
		credentials: true,
	}),
);

// Body parsers with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Connect to MongoDB
connectDB();

// Initialize Redis and Queue Workers
const initializeQueues = async () => {
	try {
		await connectRedis();
		console.log("[Server] Redis connected");

		// Start job scraper worker only after Redis is reachable
		const workerModule = await import("./queue/workers");
		jobScraperWorkerInstance = workerModule.jobScraperWorker;
		await jobScraperWorkerInstance.waitUntilReady();
		console.log("[Server] Job scraper worker ready");
	} catch (error) {
		console.warn("[Server] Queue initialization skipped:", error);
	}
};

initializeQueues();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/external", externalRoutes);
app.use("/api/scraper", scraperRoutes);

// Health check
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", message: "NextRole API is running" });
});

// Error handling middleware
app.use(errorHandler);

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("[Server] SIGTERM received, shutting down gracefully...");
	server.close(async () => {
		try {
			if (jobScraperWorkerInstance) {
				await jobScraperWorkerInstance.close();
			}
			await closeQueues();
			await disconnectRedis();
			console.log("[Server] All connections closed");
			process.exit(0);
		} catch (error) {
			console.error("[Server] Shutdown error:", error);
			process.exit(1);
		}
	});
});

process.on("SIGINT", async () => {
	console.log("[Server] SIGINT received, shutting down gracefully...");
	server.close(async () => {
		try {
			if (jobScraperWorkerInstance) {
				await jobScraperWorkerInstance.close();
			}
			await closeQueues();
			await disconnectRedis();
			console.log("[Server] All connections closed");
			process.exit(0);
		} catch (error) {
			console.error("[Server] Shutdown error:", error);
			process.exit(1);
		}
	});
});

export default app;
