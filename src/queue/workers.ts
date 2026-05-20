import { Worker } from "bullmq";
import { Job as DbJob } from "../models";
import {
	fetchAllWellfoundJobs,
	scrapeWellfoundJobs,
} from "../services/scraper.service";

/**
 * Job Scraper Worker - Handles fetching jobs from various platforms
 */
export const jobScraperWorker = new Worker(
	"job-scraper",
	async (job) => {
		const { platform } = job.data;

		try {
			console.log(`[Worker] Scraping jobs from ${platform}...`);

			let jobs: any[] = [];

			switch (platform) {
				case "wellfound":
					jobs = await fetchAllWellfoundJobs();
					break;
				case "wellfound-playwright":
					const urls = await scrapeWellfoundJobs({ headless: true });
					jobs = urls.map((url) => ({
						title: "Job from Wellfound",
						company: "Unknown",
						description: "",
						location: "Check source",
					}));
					break;
				default:
					throw new Error(`Unknown platform: ${platform}`);
			}

			// Save jobs to database
			const savedJobs = await DbJob.insertMany(
				jobs.map((j) => ({
					title: j.title,
					company: j.company,
					description: j.description,
					location: j.location,
					skills: j.skills || [],
					requirements: j.requirements || [],
					type: j.type || "full-time",
					source: platform,
					externalId: j.externalId,
				})),
				{ ordered: false },
			).catch((err) => {
				// Some jobs may already exist (duplicate key error is fine)
				console.warn(`[Worker] Some jobs already existed: ${err.message}`);
				return [];
			});

			console.log(
				`[Worker] Scraped and saved ${savedJobs.length} jobs from ${platform}`,
			);

			return { platform, count: savedJobs.length };
		} catch (error) {
			console.error(`[Worker] Scraper failed for ${platform}:`, error);
			throw error;
		}
	},
	{
		connection: {
			host: process.env.REDIS_HOST || "localhost",
			port: parseInt(process.env.REDIS_PORT || "6379"),
			password: process.env.REDIS_PASSWORD,
			retryStrategy: () => null,
		},
		concurrency: 1,
	},
);

jobScraperWorker.on("completed", (job) => {
	console.log(`[Worker] Job scraper task ${job.id} completed`);
});

jobScraperWorker.on("failed", (job, err) => {
	console.error(`[Worker] Job scraper task ${job?.id} failed:`, err);
});

export default {
	jobScraperWorker,
};
