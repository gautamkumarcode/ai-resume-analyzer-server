import mongoose, { Document, Schema } from "mongoose";

export interface ISkill {
	name: string;
	level?: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface IExperience {
	title: string;
	company: string;
	location?: string;
	startDate?: Date;
	endDate?: Date;
	current?: boolean;
	description?: string;
}

export interface IEducation {
	degree: string;
	institution: string;
	location?: string;
	graduationDate?: Date;
	gpa?: string;
}

export interface IResume extends Document {
	_id: mongoose.Types.ObjectId;
	user: mongoose.Types.ObjectId;
	fileName: string;
	filePath: string;
	fileType: string;
	rawText: string;
	parsedData: {
		name?: string;
		email?: string;
		phone?: string;
		location?: string;
		summary?: string;
		skills: ISkill[];
		experience: IExperience[];
		education: IEducation[];
	};
	aiAnalysis?: {
		overallScore: number;
		strengths: string[];
		improvements: string[];
		keywords: string[];
		summary: string;
	};
	createdAt: Date;
	updatedAt: Date;
}

const resumeSchema = new Schema<IResume>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		fileName: {
			type: String,
			required: true,
		},
		filePath: {
			type: String,
			required: true,
		},
		fileType: {
			type: String,
			required: true,
			enum: [
				"application/pdf",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			],
		},
		rawText: {
			type: String,
			default: "",
		},
		parsedData: {
			name: String,
			email: String,
			phone: String,
			location: String,
			summary: String,
			skills: [
				{
					name: String,
					level: {
						type: String,
						enum: ["beginner", "intermediate", "advanced", "expert"],
					},
				},
			],
			experience: [
				{
					title: String,
					company: String,
					location: String,
					startDate: Date,
					endDate: Date,
					current: Boolean,
					description: String,
				},
			],
			education: [
				{
					degree: String,
					institution: String,
					location: String,
					graduationDate: Date,
					gpa: String,
				},
			],
		},
		aiAnalysis: {
			overallScore: Number,
			strengths: [String],
			improvements: [String],
			keywords: [String],
			summary: String,
		},
	},
	{
		timestamps: true,
	},
);

export const Resume = mongoose.model<IResume>("Resume", resumeSchema);
