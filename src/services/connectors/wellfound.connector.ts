export interface WellfoundRawJob {
	id?: string;
	role?: string;
	company?: string;
	location?: string;
	description?: string;
	tags?: string[];
	remote?: boolean;
}

export interface NormalizedJob {
	externalId?: string;
	title: string;
	company: string;
	location?: string;
	description: string;
	skills: string[];
	requirements: string[];
	type?: "full-time" | "part-time" | "contract" | "internship" | "remote";
}

/**
 * Fetch jobs from a Wellfound feed or API URL. The URL should be provided
 * via `WELLFOUND_API_URL` environment variable. An optional `WELLFOUND_API_KEY`
 * can be supplied to authorize requests.
 *
 * This function is intentionally conservative: it will try to parse JSON first,
 * then fall back to extracting structured data from HTML if necessary. It
 * normalizes job fields to the platform's internal shape but does NOT persist
 * anything to the database.
 */
export const fetchWellfoundJobs = async (): Promise<NormalizedJob[]> => {
	const url = process.env.WELLFOUND_API_URL;
	if (!url) throw new Error("WELLFOUND_API_URL not configured");

	const headers: Record<string, string> = { Accept: "application/json" };
	if (process.env.WELLFOUND_API_KEY) {
		headers["Authorization"] = `Bearer ${process.env.WELLFOUND_API_KEY}`;
	}

	const res = await fetch(url, { headers });
	if (!res.ok) {
		throw new Error(`Wellfound fetch failed: ${res.status} ${res.statusText}`);
	}

	const text = await res.text();

	// Expect the WELLFOUND_API_URL to return JSON. If it doesn't parse, instruct
	// the caller to provide a structured JSON feed/endpoint.
	let parsed: any;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		throw new Error(
			"Received non-JSON response from WELLFOUND_API_URL — provide a JSON/structured feed for Wellfound or configure an API endpoint.",
		);
	}

	const list = Array.isArray(parsed)
		? parsed
		: (parsed.jobs ?? parsed.results ?? []);

	return list.map((item: any) => {
		const raw: WellfoundRawJob = {
			id: item.id ?? item.job_id ?? item.slug,
			role: item.role ?? item.title ?? item.name,
			company:
				item.company?.name ?? item.company ?? item.startup ?? item.organization,
			location: item.location ?? item.city ?? item.remote_location,
			description: item.description ?? item.summary ?? item.body,
			tags: item.tags ?? item.skills ?? item.keywords,
			remote: item.remote ?? item.is_remote,
		};

		const skills = (raw.tags ?? [])
			.map(String)
			.map((s) => s.trim())
			.filter(Boolean);

		const normalized: NormalizedJob = {
			externalId: raw.id,
			title: raw.role ?? "",
			company: raw.company ?? "",
			location: raw.location,
			description: raw.description ?? "",
			skills,
			requirements: skills.slice(0, 6),
			type: raw.remote ? "remote" : undefined,
		};

		return normalized;
	});
};

export default {
	fetchWellfoundJobs,
};
