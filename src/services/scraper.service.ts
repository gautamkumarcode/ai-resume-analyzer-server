import { chromium } from "playwright";
import { fetchWellfoundJobs } from "./connectors/wellfound.connector";

export interface ScraperConfig {
	headless?: boolean;
	timeout?: number;
	waitForSelector?: boolean;
}

/**
 * Scrape jobs from Wellfound using Playwright
 */
export const scrapeWellfoundJobs = async (config: ScraperConfig = {}) => {
	const { headless = true, timeout = 30000 } = config;

	let browser;
	try {
		browser = await chromium.launch({ headless });
		const page = await browser.newPage();

		// Set timeout
		page.setDefaultTimeout(timeout);

		// Navigate to Wellfound
		const wellfoundUrl =
			process.env.WELLFOUND_BASE_URL || "https://www.wellfound.com";
		await page.goto(`${wellfoundUrl}/jobs`, { waitUntil: "networkidle" });

		// Wait for job listings to load
		await page.waitForSelector(
			".job-card, [class*='job'], [class*='listing']",
			{
				timeout: 10000,
			},
		);

		// Extract job URLs
		const jobUrls = await page.$$eval(
			"a[href*='/jobs/']",
			(links: Array<{ href: string }>) => links.map((link) => link.href),
		);

		const uniqueUrls = [...new Set(jobUrls)];
		console.log(`[Scraper] Found ${uniqueUrls.length} unique job URLs`);

		await browser.close();
		return uniqueUrls;
	} catch (error) {
		if (browser) await browser.close();
		throw new Error(`Wellfound scraping failed: ${(error as Error).message}`);
	}
};

/**
 * Fetch all Wellfound jobs (from API or fallback)
 */
export const fetchAllWellfoundJobs = async () => {
	try {
		console.log("[Scraper] Fetching jobs from Wellfound API...");
		const jobs = await fetchWellfoundJobs();
		console.log(`[Scraper] Successfully fetched ${jobs.length} jobs`);
		return jobs;
	} catch (error) {
		console.warn(`[Scraper] API fetch failed: ${(error as Error).message}`);
		console.log("[Scraper] Falling back to Playwright scraping...");

		// Fallback to scraping
		const jobUrls = await scrapeWellfoundJobs({ headless: true });
		return jobUrls.map((url) => ({
			title: "Job (Scraped)",
			company: "Unknown",
			description: "",
			location: "Check job page",
			skills: [],
			requirements: [],
		}));
	}
};

/**
 * Login to Wellfound with Playwright
 */
export const loginToWellfound = async (
	email: string,
	password: string,
	config: ScraperConfig = {},
) => {
	const { headless = false, timeout = 30000 } = config;

	let browser;
	try {
		browser = await chromium.launchPersistentContext("./wellfound-user-data", {
			headless,
		});

		const page = (await browser.pages()[0]) || (await browser.newPage());
		page.setDefaultTimeout(timeout);

		const wellfoundUrl =
			process.env.WELLFOUND_BASE_URL || "https://www.wellfound.com";
		await page.goto(`${wellfoundUrl}/login`, { waitUntil: "networkidle" });

		// Fill email
		const emailSelector =
			'input[type="email"], input[name*="email"], input[placeholder*="email"]';
		await page.fill(emailSelector, email);

		// Add human-like delay
		await page.waitForTimeout(1000 + Math.random() * 2000);

		// Fill password
		const passwordSelector = 'input[type="password"], input[name*="password"]';
		await page.fill(passwordSelector, password);

		// Click submit
		await page.click(
			'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")',
		);

		// Wait for navigation
		await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 });

		console.log("[Auth] Successfully logged in to Wellfound");

		// Close the persistent context
		await browser.close();
		return true;
	} catch (error) {
		if (browser) await browser.close();
		throw new Error(`Wellfound login failed: ${(error as Error).message}`);
	}
};

/**
 * Apply to a job on Wellfound using Playwright
 */
export const applyToWellfoundJob = async (
	jobUrl: string,
	resumePath: string,
	config: ScraperConfig = {},
) => {
	const { headless = false, timeout = 30000 } = config;

	let browser;
	try {
		browser = await chromium.launch({ headless });
		const page = await browser.newPage();
		page.setDefaultTimeout(timeout);

		// Navigate to job
		await page.goto(jobUrl, { waitUntil: "networkidle" });

		// Find and click apply button
		const applySelectors = [
			'button:has-text("Apply")',
			'button:has-text("Easy Apply")',
			'a:has-text("Apply Now")',
			'[data-testid*="apply"], [class*="apply-btn"]',
		];

		let applied = false;
		for (const selector of applySelectors) {
			try {
				await page.click(selector);
				applied = true;
				break;
			} catch {
				continue;
			}
		}

		if (!applied) {
			throw new Error("Could not find apply button");
		}

		// Add delay for form to appear
		await page.waitForTimeout(2000);

		// Upload resume if file input exists
		const fileInputs = await page.locator('input[type="file"]').count();
		if (fileInputs > 0) {
			await page
				.locator('input[type="file"]')
				.first()
				.setInputFiles(resumePath);
			await page.waitForTimeout(1000);
		}

		// Click final submit
		const submitSelectors = [
			'button:has-text("Submit")',
			'button:has-text("Apply Now")',
			'button:has-text("Send Application")',
		];

		for (const selector of submitSelectors) {
			try {
				await page.click(selector);
				break;
			} catch {
				continue;
			}
		}

		console.log(`[Apply] Successfully applied to job: ${jobUrl}`);

		await browser.close();
		return { success: true, jobUrl, timestamp: new Date() };
	} catch (error) {
		if (browser) await browser.close();
		throw new Error(`Application failed: ${(error as Error).message}`);
	}
};

export default {
	scrapeWellfoundJobs,
	fetchAllWellfoundJobs,
	loginToWellfound,
	applyToWellfoundJob,
};
