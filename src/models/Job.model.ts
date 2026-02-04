import mongoose, { Document, Schema } from "mongoose";

export interface IJob extends Document {
	_id: mongoose.Types.ObjectId;
	user: mongoose.Types.ObjectId;
	title: string;
	company: string;
	location?: string;
	type: "full-time" | "part-time" | "contract" | "internship" | "remote";
	description: string;
	requirements: string[];
	skills: string[];
	salary?: {
		min?: number;
		max?: number;
		currency?: string;
	};
	createdAt: Date;
	updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		title: {
			type: String,
			required: [true, "Job title is required"],
			trim: true,
		},
		company: {
			type: String,
			required: [true, "Company name is required"],
			trim: true,
		},
		location: {
			type: String,
			trim: true,
		},
		type: {
			type: String,
			enum: ["full-time", "part-time", "contract", "internship", "remote"],
			default: "full-time",
		},
		description: {
			type: String,
			required: [true, "Job description is required"],
		},
		requirements: [
			{
				type: String,
			},
		],
		skills: [
			{
				type: String,
			},
		],
		salary: {
			min: Number,
			max: Number,
			currency: {
				type: String,
				default: "USD",
			},
		},
	},
	{
		timestamps: true,
	},
);

export const Job = mongoose.model<IJob>("Job", jobSchema);
