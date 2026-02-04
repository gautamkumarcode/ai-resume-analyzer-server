import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import jobRoutes from "./routes/job.routes";
import resumeRoutes from "./routes/resume.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);

// Health check
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", message: "AI Resume Analyzer API is running" });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
