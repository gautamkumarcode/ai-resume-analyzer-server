import mongoose, { Document, Schema } from "mongoose";

export interface IJobMatch extends Document {
	_id: mongoose.Types.ObjectId;
	user: mongoose.Types.ObjectId;
	resume: mongoose.Types.ObjectId;
	job: mongoose.Types.ObjectId;
	matchScore: number;
	skillsMatch: {
		matched: string[];
		missing: string[];
		percentage: number;
	};
	experienceMatch: {
		score: number;
		feedback: string;
	};
	recommendations: string[];
	aiAnalysis: string;
	createdAt: Date;
	updatedAt: Date;
}

const jobMatchSchema = new Schema<IJobMatch>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		resume: {
			type: Schema.Types.ObjectId,
			ref: "Resume",
			required: true,
		},
		job: {
			type: Schema.Types.ObjectId,
			ref: "Job",
			required: true,
		},
		matchScore: {
			type: Number,
			required: true,
			min: 0,
			max: 100,
		},
		skillsMatch: {
			matched: [String],
			missing: [String],
			percentage: Number,
		},
		experienceMatch: {
			score: Number,
			feedback: String,
		},
		recommendations: [String],
		aiAnalysis: String,
	},
	{
		timestamps: true,
	},
);

// Compound index for unique resume-job combination per user
jobMatchSchema.index({ user: 1, resume: 1, job: 1 }, { unique: true });

export const JobMatch = mongoose.model<IJobMatch>("JobMatch", jobMatchSchema);
