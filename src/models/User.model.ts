import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "candidate" | "recruiter" | "admin";

export interface IUser extends Document {
	_id: mongoose.Types.ObjectId;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	active: boolean;
	// Extended profile fields
	phone?: string;
	location?: string;
	title?: string;
	company?: string;
	summary?: string;
	experience?: string;
	skills?: string[];
	linkedin?: string;
	website?: string;
	createdAt: Date;
	updatedAt: Date;
	comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
	{
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			minlength: [6, "Password must be at least 6 characters"],
			select: false,
		},
		firstName: {
			type: String,
			required: [true, "First name is required"],
			trim: true,
		},
		lastName: {
			type: String,
			required: [true, "Last name is required"],
			trim: true,
		},
		role: {
			type: String,
			enum: ["candidate", "recruiter", "admin"],
			default: "candidate",
			required: true,
		},
		active: {
			type: Boolean,
			default: true,
		},
		// Extended profile fields
		phone: {
			type: String,
			trim: true,
		},
		location: {
			type: String,
			trim: true,
		},
		title: {
			type: String,
			trim: true,
		},
		company: {
			type: String,
			trim: true,
		},
		summary: {
			type: String,
			trim: true,
		},
		experience: {
			type: String,
			trim: true,
		},
		skills: [
			{
				type: String,
				trim: true,
			},
		],
		linkedin: {
			type: String,
			trim: true,
		},
		website: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
	},
);

// Hash password before saving
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
	next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
	candidatePassword: string,
): Promise<boolean> {
	return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
