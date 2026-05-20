import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { Job } from "../models/Job.model";
import wellfound from "../services/connectors/wellfound.connector";

export const previewWellfound = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const jobs = await wellfound.fetchWellfoundJobs();
		return res.json({ count: jobs.length, jobs });
	} catch (err) {
		return next(err);
	}
};

export const importWellfound = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const externalUserId = process.env.EXTERNAL_JOBS_USER_ID;
		if (!externalUserId) {
			return res
				.status(500)
				.json({ message: "EXTERNAL_JOBS_USER_ID not configured" });
		}

		const importerUserId = new mongoose.Types.ObjectId(externalUserId);

		const jobs = await wellfound.fetchWellfoundJobs();

		let imported = 0;
		let updated = 0;

		for (const j of jobs) {
			const filter: any = j.externalId
				? { externalSource: "wellfound", externalId: j.externalId }
				: { title: j.title, company: j.company, location: j.location };

			const existing = await Job.findOne(filter);

			if (existing) {
				existing.title = j.title;
				existing.company = j.company;
				existing.location = j.location;
				existing.description = j.description;
				existing.requirements = j.requirements;
				existing.skills = j.skills;
				existing.type = j.type ?? existing.type;
				existing.externalSource = "wellfound";
				existing.externalId = j.externalId ?? existing.externalId;
				await existing.save();
				updated++;
			} else {
				await Job.create({
					user: importerUserId,
					title: j.title,
					company: j.company,
					location: j.location,
					description: j.description,
					requirements: j.requirements,
					skills: j.skills,
					type: j.type ?? "full-time",
					externalSource: "wellfound",
					externalId: j.externalId,
				});
				imported++;
			}
		}

		return res.json({ imported, updated, total: jobs.length });
	} catch (err) {
		return next(err);
	}
};

export default {
	previewWellfound,
};
