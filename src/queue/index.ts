import { Queue, QueueOptions } from "bullmq";

// Queue configuration
const queueConfig: QueueOptions = {
	connection: {
		host: process.env.REDIS_HOST || "localhost",
		port: parseInt(process.env.REDIS_PORT || "6379"),
		password: process.env.REDIS_PASSWORD,
		retryStrategy: () => null,
	},
};

// Job queues
export const jobScraperQueue = new Queue("job-scraper", queueConfig);
export const jobMatcherQueue = new Queue("job-matcher", queueConfig);
export const applicationQueue = new Queue("applications", queueConfig);
export const notificationQueue = new Queue("notifications", queueConfig);

// Add job to scraper queue
export const addJobScrapeTask = async (platform: string, params: any = {}) => {
	const job = await jobScraperQueue.add(
		`scrape-${platform}`,
		{ platform, ...params },
		{
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
			removeOnComplete: true,
		},
	);
	console.log(`[Queue] Added job scrape task: ${job.id}`);
	return job;
};

// Add job to matcher queue
export const addJobMatchTask = async (
	userId: string,
	resumeId: string,
	jobIds: string[],
) => {
	const job = await jobMatcherQueue.add(
		"match-jobs",
		{ userId, resumeId, jobIds },
		{
			attempts: 2,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
			removeOnComplete: true,
		},
	);
	console.log(`[Queue] Added job match task: ${job.id}`);
	return job;
};

// Add application to queue
export const addApplicationTask = async (
	userId: string,
	jobId: string,
	resumeId: string,
) => {
	const job = await applicationQueue.add(
		"apply-job",
		{ userId, jobId, resumeId },
		{
			attempts: 2,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
			removeOnComplete: true,
		},
	);
	console.log(`[Queue] Added application task: ${job.id}`);
	return job;
};

// Add notification task
export const addNotificationTask = async (userId: string, message: string) => {
	const job = await notificationQueue.add(
		"send-notification",
		{ userId, message },
		{
			removeOnComplete: true,
		},
	);
	return job;
};

// Cleanup on shutdown
export const closeQueues = async () => {
	await Promise.all([
		jobScraperQueue.close(),
		jobMatcherQueue.close(),
		applicationQueue.close(),
		notificationQueue.close(),
	]);
	console.log("[Queue] All queues closed");
};

export default {
	jobScraperQueue,
	jobMatcherQueue,
	applicationQueue,
	notificationQueue,
	addJobScrapeTask,
	addJobMatchTask,
	addApplicationTask,
	addNotificationTask,
	closeQueues,
};
