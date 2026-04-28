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

		// Use recruiter-defined questions if available, otherwise generate with AI
		let questions: { question: string; category: string }[];
		if (job.interviewQuestions && job.interviewQuestions.length > 0) {
			questions = job.interviewQuestions.map((q) => ({
				question: q,
				category: "role-specific",
			}));
			console.log(
				`[Interview] Using ${questions.length} recruiter-defined questions`,
			);
		} else {
			questions = await generateInterviewQuestions(
				job.title,
				job.description,
				resume.rawText,
				5,
			);
			console.log(`[Interview] Generated ${questions.length} AI questions`);
		}

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
		const job = await Job.findOne({ _id: jobId, user: recruiterId });
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

// Conversational chat turn — called for each user answer in real-time
export const chatTurn = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { systemPrompt, history, userMessage } = req.body as {
			systemPrompt: string;
			history: { role: "assistant" | "user"; text: string }[];
			userMessage: string;
		};

		const { chatWithAI } = await import("../services/ai.service");

		// Build a conversational prompt
		const historyText = history
			.map(
				(m) =>
					`${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.text}`,
			)
			.join("\n");

		const prompt = `${systemPrompt}

Conversation so far:
${historyText}

Candidate just said: "${userMessage}"

Respond as the interviewer. Keep it SHORT (1-2 sentences). Acknowledge briefly then ask the next question, OR if all questions are done say "Thank you for your time. The interview is complete."`;

		const reply = await chatWithAI(
			prompt,
			"You are a professional AI interviewer. Keep responses concise and natural.",
			300,
		);

		res.json({ success: true, data: { reply: reply.trim() } });
	} catch (error) {
		next(error);
	}
};

// TTS proxy — tries OpenAI TTS first (nova voice), falls back to signal client
export const textToSpeech = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { text } = req.body as { text: string };
		if (!text?.trim()) {
			res.status(400).json({ success: false, message: "Text is required" });
			return;
		}

		const openaiKey = process.env.OPENAI_API_KEY;
		const elevenKey = process.env.ELEVENLABS_API_KEY;

		// Try OpenAI TTS first (nova = natural female voice)
		if (openaiKey) {
			try {
				const response = await fetch("https://api.openai.com/v1/audio/speech", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${openaiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "tts-1",
						input: text,
						voice: "nova", // natural female voice
						speed: 0.95,
					}),
				});

				if (response.ok) {
					res.setHeader("Content-Type", "audio/mpeg");
					const reader = response.body?.getReader();
					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							res.write(Buffer.from(value));
						}
						res.end();
						return;
					}
				}
				console.warn("[TTS] OpenAI failed:", response.status);
			} catch (err) {
				console.warn("[TTS] OpenAI error:", err);
			}
		}

		// ElevenLabs — uses voice ID from env (must be a voice you own/created on free tier)
		if (elevenKey) {
			const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
			if (!VOICE_ID) {
				console.warn(
					"[TTS] ELEVENLABS_VOICE_ID not set. Create a voice at elevenlabs.io/app/voice-lab and add ELEVENLABS_VOICE_ID to .env",
				);
			} else {
				try {
					const response = await fetch(
						`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
						{
							method: "POST",
							headers: {
								"xi-api-key": elevenKey,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								text,
								model_id: "eleven_turbo_v2",
								voice_settings: {
									stability: 0.45,
									similarity_boost: 0.8,
									style: 0.35,
									use_speaker_boost: true,
									speed: 0.95,
								},
							}),
						},
					);

					if (response.ok) {
						res.setHeader("Content-Type", "audio/mpeg");
						const reader = response.body?.getReader();
						if (reader) {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								res.write(Buffer.from(value));
							}
							res.end();
							return;
						}
					}
					const errText = await response.text();
					console.warn("[TTS] ElevenLabs failed:", response.status, errText);
				} catch (err) {
					console.warn("[TTS] ElevenLabs error:", err);
				}
			}
		}

		// All TTS providers failed — signal client to use browser TTS
		res.status(503).json({ success: false, message: "TTS_FALLBACK" });
	} catch (error) {
		console.error("[TTS] Unexpected error:", error);
		res.status(503).json({ success: false, message: "TTS_FALLBACK" });
	}
};
