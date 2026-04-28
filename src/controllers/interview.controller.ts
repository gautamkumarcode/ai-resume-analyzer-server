import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { Interview, Job, Resume } from "../models";
import {
    evaluateInterview,
    generateInterviewQuestions,
} from "../services/ai.service";

// Candidate: start a new interview session
export const startInterview = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { jobId, resumeId } = req.body;
		const candidateId = req.user!._id;

		const [job, resume] = await Promise.all([
			Job.findById(jobId),
			Resume.findOne({ _id: resumeId, user: candidateId }),
		]);

		if (!job) throw new ApiError("Job not found", 404);
		if (!resume) throw new ApiError("Resume not found", 404);

		// Check for existing in-progress interview
		const existing = await Interview.findOne({
			candidate: candidateId,
			job: jobId,
			status: "in_progress",
		});
		if (existing) {
			res.json({ success: true, data: { interview: existing } });
			return;
		}

		// Generate questions
		const questions = await generateInterviewQuestions(
			job.title,
			job.description,
			resume.rawText,
			5,
		);

		const interview = await Interview.create({
			candidate: candidateId,
			job: jobId,
			resume: resumeId,
			answers: questions.map((q) => ({
				question: q.question,
				answer: "",
				score: 0,
				feedback: "",
			})),
			status: "in_progress",
		});

		res.status(201).json({ success: true, data: { interview } });
	} catch (error) {
		next(error);
	}
};

// Candidate: submit completed interview answers
export const submitInterview = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const { answers } = req.body; // [{ question, answer }]
		const candidateId = req.user!._id;

		const interview = await Interview.findOne({
			_id: id,
			candidate: candidateId,
			status: "in_progress",
		}).populate("job");

		if (!interview) throw new ApiError("Interview not found", 404);

		const job = interview.job as any;

		// Evaluate with AI
		const evaluation = await evaluateInterview(
			job.title,
			job.description,
			answers,
		);

		// Update interview with results
		interview.answers = answers.map((a: any, i: number) => ({
			question: a.question,
			answer: a.answer,
			score: evaluation.answerEvaluations[i]?.score ?? 0,
			feedback: evaluation.answerEvaluations[i]?.feedback ?? "",
		}));
		interview.overallScore = evaluation.overallScore;
		interview.fitLevel = evaluation.fitLevel;
		interview.summary = evaluation.summary;
		interview.strengths = evaluation.strengths;
		interview.concerns = evaluation.concerns;
		interview.status = "completed";
		interview.completedAt = new Date();

		await interview.save();

		res.json({ success: true, data: { interview } });
	} catch (error) {
		next(error);
	}
};

// Candidate: get their own interviews
export const getCandidateInterviews = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const candidateId = req.user!._id;
		const interviews = await Interview.find({ candidate: candidateId })
			.populate("job", "title company location")
			.sort({ createdAt: -1 });

		res.json({ success: true, data: { interviews } });
	} catch (error) {
		next(error);
	}
};

// Recruiter: get all interviews for a specific job
export const getJobInterviews = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { jobId } = req.params;
		const recruiterId = req.user!._id;

		// Verify recruiter owns this job
		const job = await Job.findOne({ _id: jobId, postedBy: recruiterId });
		if (!job) throw new ApiError("Job not found", 404);

		const interviews = await Interview.find({
			job: jobId,
			status: "completed",
		})
			.populate("candidate", "firstName lastName email")
			.populate("resume", "fileName")
			.sort({ overallScore: -1 }); // best fit first

		res.json({ success: true, data: { interviews } });
	} catch (error) {
		next(error);
	}
};
