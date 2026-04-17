import mongoose, { Document, Schema } from "mongoose";

export type ApplicationStatus = "applied" | "shortlisted" | "rejected";

export interface IApplication extends Document {
	_id: mongoose.Types.ObjectId;
	candidateId: mongoose.Types.ObjectId;
	jobId: mongoose.Types.ObjectId;
	resumeId?: mongoose.Types.ObjectId;
	status: ApplicationStatus;
	matchScore?: number;
	appliedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
	{
		candidateId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		jobId: {
			type: Schema.Types.ObjectId,
			ref: "Job",
			required: true,
		},
		resumeId: {
			type: Schema.Types.ObjectId,
			ref: "Resume",
			required: false,
		},
		status: {
			type: String,
			enum: ["applied", "shortlisted", "rejected"],
			default: "applied",
		},
		matchScore: {
			type: Number,
			min: 0,
			max: 100,
		},
		appliedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	},
);

// Compound unique index: one application per candidate per job
applicationSchema.index({ candidateId: 1, jobId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>(
	"Application",
	applicationSchema,
);
