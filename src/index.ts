import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import adminRoutes from "./routes/admin.routes";
import applicationRoutes from "./routes/application.routes";
import authRoutes from "./routes/auth.routes";
import interviewRoutes from "./routes/interview.routes";
import jobRoutes from "./routes/job.routes";
import resumeRoutes from "./routes/resume.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/interviews", interviewRoutes);

// Health check
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", message: "NextRole API is running" });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
