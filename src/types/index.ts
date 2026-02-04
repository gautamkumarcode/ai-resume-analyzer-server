import { Request } from "express";
import { IUser } from "../models";

export interface AuthRequest extends Request {
	user?: IUser;
}

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}

export interface PaginationQuery {
	page?: number;
	limit?: number;
	sort?: string;
}
