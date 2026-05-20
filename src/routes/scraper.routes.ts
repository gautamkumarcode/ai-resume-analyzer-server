import { NextFunction, Response, Router } from "express";
import { AuthRequest, protect } from "../middleware/auth";
import { Job as DbJob, Resume as DbResume, JobMatch } from "../models";
import { addJobMatchTask, addJobScrapeTask } from "../queue/index";
import { matchJobWithResume } from "../services/jobMatcher.service";

const router = Router();

/**
 * POST /api/scraper/scrape-wellfound
 * Trigger job scraping from Wellfound
 */
router.post(
	"/scrape-wellfound",
	protect,
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			// Check for admin or trigger from authenticated user
			const job = await addJobScrapeTask("wellfound");

			res.json({
				success: true,
				message: "Job scraping started",
				jobId: job.id,
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * POST /api/scraper/match-resume
 * Match a resume with available jobs
 */
router.post(
	"/match-resume",
	protect,
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?._id;
			const { resumeId } = req.body;

			if (!userId) {
				return res.status(401).json({ error: "Not authorized" });
			}

			if (!resumeId) {
				return res.status(400).json({ error: "resumeId is required" });
			}

			// Get resume
			const resume = await DbResume.findById(resumeId);
			if (!resume) {
				return res.status(404).json({ error: "Resume not found" });
			}

			// Get all jobs
			const jobs = await DbJob.find().sort({ createdAt: -1 }).limit(50); // Limit to recent 50 for demo

			if (jobs.length === 0) {
				return res.json({
					success: true,
					message: "No jobs available for matching",
					matches: [],
				});
			}

			// Parse resume text for matching
			const resumeText = resume.rawText || resume.fileName || "";
			const resumeData = {
				skills: (resume as any).skills || [],
				experience: (resume as any).experience || [],
				summary: (resume as any).summary,
			};

			// Match each job
			const matches = [];
			for (const job of jobs) {
				try {
					const match = await matchJobWithResume(
						{
							title: job.title,
							description: job.description,
							skills: job.skills,
							requirements: job.requirements,
						},
						resumeData,
						resumeText,
					);

					// Save to JobMatch collection
					const jobMatch = new JobMatch({
						user: userId,
						resume: resumeId,
						job: job._id,
						matchScore: match.matchScore,
						skillsMatch: match.skillsMatch,
						experienceMatch: match.experienceMatch,
						recommendations: match.recommendations,
						aiAnalysis: match.aiAnalysis,
					});

					await jobMatch.save().catch(() => {
						// Ignore duplicate key errors
					});

					if (match.matchScore >= 60) {
						// Only include good matches
						matches.push({
							jobId: job._id,
							jobTitle: job.title,
							company: job.company,
							...match,
						});
					}
				} catch (error) {
					console.error(`Failed to match job ${job._id}:`, error);
				}
			}

			// Sort by match score
			matches.sort((a, b) => b.matchScore - a.matchScore);

			res.json({
				success: true,
				message: `Found ${matches.length} matching jobs`,
				matches: matches.slice(0, 20), // Return top 20
				totalMatches: matches.length,
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * GET /api/scraper/job-matches
 * Get saved job matches for current user
 */
router.get(
	"/job-matches",
	protect,
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?._id;
			const { resumeId } = req.query;

			if (!userId) {
				return res.status(401).json({ error: "Not authorized" });
			}

			let query: any = { user: userId };
			if (resumeId) query.resume = resumeId;

			const matches = await JobMatch.find(query)
				.populate("job", "title company location description")
				.sort({ matchScore: -1 })
				.limit(50);

			res.json({
				success: true,
				data: matches,
				total: matches.length,
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * POST /api/scraper/bulk-match
 * Queue bulk job matching for a resume against all jobs
 */
router.post(
	"/bulk-match",
	protect,
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?._id;
			const { resumeId } = req.body;

			if (!userId) {
				return res.status(401).json({ error: "Not authorized" });
			}

			if (!resumeId) {
				return res.status(400).json({ error: "resumeId is required" });
			}

			// Get all job IDs
			const jobs = await DbJob.find().select("_id");
			const jobIds = jobs.map((j) => j._id.toString());

			// Queue the matching task
			const job = await addJobMatchTask(userId, resumeId, jobIds);

			res.json({
				success: true,
				message: "Bulk matching queued",
				jobId: job.id,
				jobsToMatch: jobIds.length,
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * GET /api/scraper/stats
 * Get scraping and matching statistics
 */
router.get(
	"/stats",
	protect,
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?._id;
			if (!userId) {
				return res.status(401).json({ error: "Not authorized" });
			}

			const totalJobs = await DbJob.countDocuments();
			const totalMatches = await JobMatch.countDocuments();
			const userMatches = await JobMatch.countDocuments({ user: userId });

			res.json({
				success: true,
				stats: {
					totalJobs,
					totalMatches,
					userMatches,
					platforms: ["wellfound"],
				},
			});
		} catch (error) {
			next(error);
		}
	},
);

export default router;
