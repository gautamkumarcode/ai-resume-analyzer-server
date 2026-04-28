import mongoose, { Document, Schema } from "mongoose";

export interface IInterviewAnswer {
	question: string;
	answer: string;
	score: number; // 0-10
	feedback: string;
}

export interface IInterview extends Document {
	_id: mongoose.Types.ObjectId;
	candidate: mongoose.Types.ObjectId;
	job: mongoose.Types.ObjectId;
	resume: mongoose.Types.ObjectId;
	answers: IInterviewAnswer[];
	overallScore: number; // 0-100
	fitLevel: "excellent" | "good" | "average" | "poor";
	summary: string;
	strengths: string[];
	concerns: string[];
	status: "in_progress" | "completed";
	completedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const interviewSchema = new Schema<IInterview>(
	{
		candidate: { type: Schema.Types.ObjectId, ref: "User", required: true },
		job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
		resume: { type: Schema.Types.ObjectId, ref: "Resume", required: true },
		answers: [
			{
				question: { type: String, required: true },
				answer: { type: String, default: "" },
				score: { type: Number, default: 0 },
				feedback: { type: String, default: "" },
			},
		],
		overallScore: { type: Number, default: 0 },
		fitLevel: {
			type: String,
			enum: ["excellent", "good", "average", "poor"],
			default: "average",
		},
		summary: { type: String, default: "" },
		strengths: [String],
		concerns: [String],
		status: {
			type: String,
			enum: ["in_progress", "completed"],
			default: "in_progress",
		},
		completedAt: Date,
	},
	{ timestamps: true },
);

export const Interview = mongoose.model<IInterview>(
	"Interview",
	interviewSchema,
);
