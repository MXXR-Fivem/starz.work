import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../config/database";

interface WeLoveDevsConfig {
	enabled: boolean;
	apiUrl: string;
	apiKey: string;
	intervalMs: number;
	pageSize: number;
	minDelayMs: number;
	max429Retries: number;
	query?: string;
}

interface WeLoveDevsJobPage {
	totalCount?: number;
	values?: unknown[];
}

interface WeLoveDevsCompanyLike {
	companyName?: unknown;
	handle?: unknown;
	fallbackGalleryUrl?: unknown;
}

interface WeLoveDevsSalaryLike {
	min?: unknown;
	max?: unknown;
	currency?: unknown;
	period?: unknown;
	frequency?: unknown;
	type?: unknown;
	unit?: unknown;
	kind?: unknown;
	yearly?: unknown;
	annual?: unknown;
	daily?: unknown;
	yearlyMin?: unknown;
	yearlyMax?: unknown;
	annualMin?: unknown;
	annualMax?: unknown;
	dailyMin?: unknown;
	dailyMax?: unknown;
}

interface WeLoveDevsRemotePolicyLike {
	frequency?: unknown;
}

interface WeLoveDevsDetailsLike {
	salary?: unknown;
	remotePolicy?: unknown;
	acceptRemote?: unknown;
}

interface WeLoveDevsSkillLike {
	name?: unknown;
}

interface WeLoveDevsGeolocLike {
	lat?: unknown;
	lng?: unknown;
}

interface WeLoveDevsJobLike {
	id?: unknown;
	title?: unknown;
	description?: unknown;
	rawDescription?: unknown;
	descriptionPreview?: unknown;
	formattedPlaces?: unknown;
	contractTypes?: unknown;
	publishDate?: unknown;
	premium?: unknown;
	status?: unknown;
	smallCompany?: unknown;
	details?: unknown;
	skillsList?: unknown;
	seoAlias?: unknown;
	_geoloc?: unknown;
}

interface ExistingOfferSourceRow extends RowDataPacket {
	external_id: string;
}

interface ExistingCompanyRow extends RowDataPacket {
	id: number;
}

type QueryableConnection = Pick<PoolConnection, "query">;
type DbError = Error & { code?: string; sqlMessage?: string };
type SalaryPeriod = "yearly" | "daily";
type NormalizedSalary = {
	min: number | null;
	max: number | null;
	currency: string;
	period: SalaryPeriod;
};
export type WeLoveDevsSyncResult = {
	skipped: boolean;
	reason?: "disabled" | "missing_api_key";
	fetchedCount: number;
	insertedCount: number;
	totalCount: number;
	durationMs: number;
};

const SYNC_SOURCE_NAME = "welovedevs";
const DEFAULT_API_URL = "https://epi-api.welovedevs.com/v1";
const DEFAULT_INTERVAL_MINUTES = 10;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MIN_DELAY_MS = 1200;
const DEFAULT_MAX_429_RETRIES = 6;
const RANDOM_PREMIUM_RATE = 1 / 250;
const MYSQL_MIN_DATETIME_MS = Date.UTC(1000, 0, 1, 0, 0, 0, 0);
const MYSQL_MAX_DATETIME_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");

export const htmlToText = (value: string): string =>
	decodeHtmlEntities(
		value
			.replace(/<li[^>]*>/gi, "\n- ")
			.replace(/<\/li>/gi, "\n")
			.replace(/<\/(h[1-6]|div|section|article|ul|ol)>/gi, "\n\n")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n\n")
			.replace(/<[^>]+>/g, " ")
			.replace(/[ \t]+/g, " ")
			.replace(/\n\s+/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim()
	);

const extractJsonLdDescription = (html: string): string | undefined => {
	const scripts = html.matchAll(
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
	);

	for (const script of scripts) {
		try {
			const payload = JSON.parse(script[1]) as { "@type"?: unknown; description?: unknown };

			if (payload["@type"] === "JobPosting") {
				return toTrimmedString(payload.description);
			}
		} catch (_error) {
			continue;
		}
	}

	return undefined;
};

const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

export const toTrimmedString = (value: unknown): string | undefined => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const toStringOrNull = (value: unknown, maxLength?: number): string | null => {
	const normalizedValue = toTrimmedString(value);

	if (!normalizedValue) {
		return null;
	}

	if (typeof maxLength === "number" && normalizedValue.length > maxLength) {
		return normalizedValue.slice(0, maxLength);
	}

	return normalizedValue;
};

const toTrimmedStringArray = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => toTrimmedString(item))
		.filter((item): item is string => Boolean(item));
};

const firstHtmlText = (...values: unknown[]): string | undefined => {
	for (const value of values) {
		const text = toTrimmedString(value);

		if (text) {
			return htmlToText(text);
		}
	}

	return undefined;
};

export const toNumberOrNull = (value: unknown): number | null => {
	const numericValue = Number(value);

	if (!Number.isFinite(numericValue)) {
		return null;
	}

	return numericValue;
};

export const toDateOrNull = (value: unknown): Date | null => {
	const toValidDate = (timestampMs: number): Date | null => {
		if (!Number.isFinite(timestampMs)) {
			return null;
		}

		if (timestampMs < MYSQL_MIN_DATETIME_MS || timestampMs > MYSQL_MAX_DATETIME_MS) {
			return null;
		}

		const date = new Date(timestampMs);
		return Number.isNaN(date.getTime()) ? null : date;
	};

	const numericValue = Number(value);

	if (Number.isFinite(numericValue)) {
		const absoluteValue = Math.abs(numericValue);
		let timestampMs = numericValue;

		if (absoluteValue >= 1e17) {
			timestampMs = numericValue / 1_000_000;
		} else if (absoluteValue >= 1e14) {
			timestampMs = numericValue / 1_000;
		} else if (absoluteValue >= 1e11) {
			timestampMs = numericValue;
		} else if (absoluteValue >= 1e9) {
			timestampMs = numericValue * 1_000;
		}

		const numericDate = toValidDate(timestampMs);

		if (numericDate) {
			return numericDate;
		}
	}

	const stringValue = toTrimmedString(value);

	if (!stringValue) {
		return null;
	}

	const parsedDate = new Date(stringValue);
	return toValidDate(parsedDate.getTime());
};

export const toPositiveInteger = (value: unknown, fallback: number): number => {
	const numericValue = Number(value);

	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		return fallback;
	}

	return numericValue;
};

export const normalizeSkill = (name: string): string => {
	return name.trim().toLowerCase().replace(/\s+/g, " ");
};

export const parseBooleanLike = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}

	const numericValue = Number(value);
	return Number.isFinite(numericValue) && numericValue > 0;
};

export const toCurrencyCode = (value: unknown): string => {
	const normalizedValue = toStringOrNull(value, 10)?.toUpperCase();

	if (!normalizedValue) {
		return "EUR";
	}

	if (normalizedValue === "€") {
		return "EUR";
	}

	const alphaCode = normalizedValue.replace(/[^A-Z]/g, "");
	return alphaCode.length === 3 ? alphaCode : "EUR";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeSalaryPeriod = (value: unknown): SalaryPeriod | null => {
	const normalizedValue = toTrimmedString(value)?.toLowerCase();

	if (!normalizedValue) {
		return null;
	}

	if (/(day|daily|jour|journee|journée|tj|tjm)/i.test(normalizedValue)) {
		return "daily";
	}

	if (/(year|yearly|annual|annuel|an|yearly_gross)/i.test(normalizedValue)) {
		return "yearly";
	}

	return null;
};

const salaryFromRecord = (salary: Record<string, unknown>, period: SalaryPeriod): NormalizedSalary => ({
	min: toNumberOrNull(salary.min),
	max: toNumberOrNull(salary.max),
	currency: toCurrencyCode(salary.currency),
	period
});

export const normalizeSalary = (value: unknown): NormalizedSalary => {
	if (!isRecord(value)) {
		return { min: null, max: null, currency: "EUR", period: "yearly" };
	}

	for (const [key, period] of [["daily", "daily"], ["yearly", "yearly"], ["annual", "yearly"]] as const) {
		const nestedSalary = value[key];

		if (isRecord(nestedSalary)) {
			const normalizedSalary = salaryFromRecord(nestedSalary, period);

			if (normalizedSalary.min !== null || normalizedSalary.max !== null) {
				return {
					...normalizedSalary,
					currency:
						nestedSalary.currency === undefined
							? toCurrencyCode(value.currency)
							: normalizedSalary.currency
				};
			}
		}
	}

	const dailyMin = toNumberOrNull(value.dailyMin);
	const dailyMax = toNumberOrNull(value.dailyMax);

	if (dailyMin !== null || dailyMax !== null) {
		return {
			min: dailyMin,
			max: dailyMax,
			currency: toCurrencyCode(value.currency),
			period: "daily"
		};
	}

	const annualMin = toNumberOrNull(value.annualMin ?? value.yearlyMin);
	const annualMax = toNumberOrNull(value.annualMax ?? value.yearlyMax);

	if (annualMin !== null || annualMax !== null) {
		return {
			min: annualMin,
			max: annualMax,
			currency: toCurrencyCode(value.currency),
			period: "yearly"
		};
	}

	return {
		min: toNumberOrNull(value.min),
		max: toNumberOrNull(value.max),
		currency: toCurrencyCode(value.currency),
		period:
			normalizeSalaryPeriod(value.period) ??
			normalizeSalaryPeriod(value.frequency) ??
			normalizeSalaryPeriod(value.type) ??
			normalizeSalaryPeriod(value.unit) ??
			normalizeSalaryPeriod(value.kind) ??
			"yearly"
	};
};

const parseJobPage = (payload: unknown): WeLoveDevsJobPage => {
	if (!payload || typeof payload !== "object") {
		return {};
	}

	const candidate = payload as Record<string, unknown>;
	return {
		totalCount: typeof candidate.totalCount === "number" ? candidate.totalCount : undefined,
		values: Array.isArray(candidate.values) ? candidate.values : undefined
	};
};

const isDuplicateOfferSourceError = (error: unknown): boolean => {
	const candidate = error as DbError | null;

	if (!candidate || typeof candidate !== "object") {
		return false;
	}

	if (candidate.code === "ER_DUP_ENTRY" && candidate.sqlMessage?.includes("offer_sources")) {
		return true;
	}

	return false;
};

const getConfig = (): WeLoveDevsConfig => {
	const enabled = String(process.env.WLD_SYNC_ENABLED ?? "false").trim().toLowerCase() === "true";
	const apiUrl = toTrimmedString(process.env.WLD_API_URL) ?? DEFAULT_API_URL;
	const apiKey = toTrimmedString(process.env.WLD_API_KEY) ?? "";
	const intervalMinutes = toPositiveInteger(
		process.env.WLD_SYNC_INTERVAL_MINUTES,
		DEFAULT_INTERVAL_MINUTES
	);
	const pageSize = Math.min(
		100,
		Math.max(1, toPositiveInteger(process.env.WLD_SYNC_PAGE_SIZE, DEFAULT_PAGE_SIZE))
	);
	const minDelayMs = Math.max(
		1000,
		toPositiveInteger(process.env.WLD_API_MIN_DELAY_MS, DEFAULT_MIN_DELAY_MS)
	);
	const max429Retries = Math.max(
		1,
		toPositiveInteger(process.env.WLD_MAX_429_RETRIES, DEFAULT_MAX_429_RETRIES)
	);
	const query = toTrimmedString(process.env.WLD_SYNC_QUERY);

	return {
		enabled,
		apiUrl,
		apiKey,
		intervalMs: intervalMinutes * 60_000,
		pageSize,
		minDelayMs,
		max429Retries,
		query
	};
};

const findOrCreateCompany = async (
	connection: QueryableConnection,
	job: WeLoveDevsJobLike
): Promise<number | null> => {
	const smallCompany = (job.smallCompany ?? {}) as WeLoveDevsCompanyLike;
	const name = toTrimmedString(smallCompany.companyName);

	if (!name) {
		return null;
	}

	const slug = toStringOrNull(smallCompany.handle, 255);
	const logoUrl = toStringOrNull(smallCompany.fallbackGalleryUrl, 500);

	if (slug) {
		const [slugRows] = await connection.query<ExistingCompanyRow[]>(
			"SELECT id FROM companies WHERE slug = ? LIMIT 1",
			[slug]
		);

		if (slugRows[0]) {
			return Number(slugRows[0].id);
		}
	}

	const [nameRows] = await connection.query<ExistingCompanyRow[]>(
		"SELECT id FROM companies WHERE name = ? LIMIT 1",
		[name]
	);

	if (nameRows[0]) {
		return Number(nameRows[0].id);
	}

	const [insertResult] = await connection.query<ResultSetHeader>(
		`
			INSERT INTO companies (name, slug, logo_url)
			VALUES (?, ?, ?)
		`,
		[name, slug, logoUrl]
	);

	return Number(insertResult.insertId);
};

const extractSkillNames = (job: WeLoveDevsJobLike): string[] => {
	const rawSkills = Array.isArray(job.skillsList) ? (job.skillsList as unknown[]) : [];
	const skillNames = rawSkills
		.map((item) => toTrimmedString((item as WeLoveDevsSkillLike).name))
		.filter((item): item is string => Boolean(item));

	return Array.from(new Set(skillNames));
};

const fetchPublicJobDescription = async (sourceUrl: string | null): Promise<string | undefined> => {
	if (!sourceUrl) {
		return undefined;
	}

	try {
		const response = await fetch(sourceUrl);

		if (!response.ok) {
			return undefined;
		}

		const html = await response.text();
		const htmlDescription = extractJsonLdDescription(html);
		return htmlDescription ? htmlToText(htmlDescription) : undefined;
	} catch (_error) {
		return undefined;
	}
};

const findExistingExternalIds = async (externalIds: string[]): Promise<Set<string>> => {
	if (externalIds.length === 0) {
		return new Set<string>();
	}

	const placeholders = externalIds.map(() => "?").join(", ");
	const [rows] = await pool.query<ExistingOfferSourceRow[]>(
		`
			SELECT external_id
			FROM offer_sources
			WHERE source_name = ? AND external_id IN (${placeholders})
		`,
		[SYNC_SOURCE_NAME, ...externalIds]
	);

	return new Set(rows.map((row) => row.external_id));
};

const createOffer = async (
	connection: QueryableConnection,
	job: WeLoveDevsJobLike
): Promise<number | null> => {
	const externalId = toTrimmedString(job.id);

	if (!externalId) {
		return null;
	}
	const title = toTrimmedString(job.title) ?? `WeLoveDevs offer ${externalId}`;
	const description = firstHtmlText(job.description, job.rawDescription, job.descriptionPreview) ?? title;
	const companyId = await findOrCreateCompany(connection, job);

	if (!companyId) {
		return null;
	}

	const details = (job.details ?? {}) as WeLoveDevsDetailsLike;
	const salary = normalizeSalary((details.salary ?? {}) as WeLoveDevsSalaryLike);
	const remotePolicy = (details.remotePolicy ?? {}) as WeLoveDevsRemotePolicyLike;

	const contractTypes = toTrimmedStringArray(job.contractTypes);
	const contractType = contractTypes.length > 0 ? contractTypes.join(", ").slice(0, 100) : null;

	const formattedPlaces = toTrimmedStringArray(job.formattedPlaces);
	const location = formattedPlaces.length > 0 ? formattedPlaces.join(", ").slice(0, 255) : null;
	const geoloc = Array.isArray(job._geoloc)
		? ((job._geoloc as unknown[])[0] as WeLoveDevsGeolocLike | undefined)
		: undefined;
	const latitude = toNumberOrNull(geoloc?.lat);
	const longitude = toNumberOrNull(geoloc?.lng);

	const remotePolicyValue =
		toStringOrNull(remotePolicy.frequency, 100) ?? toStringOrNull(details.acceptRemote, 100);
	const publishedAt = toDateOrNull(job.publishDate);
	const premium = parseBooleanLike(job.premium) || Math.random() < RANDOM_PREMIUM_RATE ? 1 : 0;
	const status = toTrimmedString(job.status) === "closed" ? "closed" : "published";
	const sourceUrlAlias = toTrimmedString(job.seoAlias);
	const sourceUrl = sourceUrlAlias ? `https://welovedevs.com/app/job/${sourceUrlAlias}` : null;
	const publicDescription = await fetchPublicJobDescription(sourceUrl);
	const fullDescription =
		publicDescription && publicDescription.length > description.length
			? publicDescription
			: description;

	const [insertOfferResult] = await connection.query<ResultSetHeader>(
		`
			INSERT INTO offers (
				company_id,
				title,
				description,
				description_preview,
				location,
				latitude,
				longitude,
				contract_type,
				remote_policy,
				status,
				moderation_status,
				premium,
				salary_min,
				salary_max,
				salary_currency,
				salary_period,
				source_posted_at,
				published_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?)
		`,
		[
			companyId,
			title.slice(0, 255),
			fullDescription,
			toStringOrNull(job.descriptionPreview),
			location,
			latitude,
			longitude,
			contractType,
			remotePolicyValue,
			status,
			premium,
			salary.min,
			salary.max,
			salary.currency,
			salary.period,
			publishedAt,
			publishedAt
		]
	);

	const offerId = Number(insertOfferResult.insertId);

	await connection.query<ResultSetHeader>(
		`
			INSERT INTO offer_sources (offer_id, source_name, external_id, source_url, raw_payload, fetched_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		[offerId, SYNC_SOURCE_NAME, externalId, sourceUrl, JSON.stringify(job), new Date()]
	);

	const skills = extractSkillNames(job);

	for (const skillName of skills) {
		const normalizedName = normalizeSkill(skillName);
		const [insertSkillResult] = await connection.query<ResultSetHeader>(
			`
				INSERT INTO skills (name, normalized_name)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
			`,
			[skillName.slice(0, 100), normalizedName.slice(0, 100)]
		);

		const skillId = Number(insertSkillResult.insertId);

		await connection.query<ResultSetHeader>(
			"INSERT IGNORE INTO offer_skills (offer_id, skill_id) VALUES (?, ?)",
			[offerId, skillId]
		);
	}

	return offerId;
};

const syncPage = async (config: WeLoveDevsConfig, page: number): Promise<{
	totalCount: number;
	pageCount: number;
	insertedCount: number;
}> => {
	const searchParams = new URLSearchParams();
	searchParams.set("page", String(page));
	searchParams.set("size", String(config.pageSize));

	if (config.query) {
		searchParams.set("q", config.query);
	}

	const url = `${config.apiUrl}?${searchParams.toString()}`;
	let response: Response | null = null;

	for (let attempt = 1; attempt <= config.max429Retries; attempt += 1) {
		response = await fetch(url, {
			method: "GET",
			headers: {
				"X-API-Key": config.apiKey
			}
		});

		if (response.status !== 429) {
			break;
		}

		const retryAfterHeader = response.headers.get("retry-after");
		const retryAfterSeconds = Number(retryAfterHeader);
		const retryDelayFromHeader = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
			? retryAfterSeconds * 1000
			: 0;
		const exponentialBackoff = config.minDelayMs * Math.pow(2, attempt - 1);
		const retryDelay = Math.max(config.minDelayMs, retryDelayFromHeader, exponentialBackoff);

		if (attempt >= config.max429Retries) {
			throw new Error(
				`WeLoveDevs API rate limit reached (429) after ${config.max429Retries} retries`
			);
		}

		console.warn(
			`[welovedevs-sync] 429 on page ${page}, retry ${attempt}/${config.max429Retries} in ${retryDelay}ms`
		);
		await sleep(retryDelay);
	}

	if (!response) {
		throw new Error("WeLoveDevs API did not return a response");
	}

	if (!response.ok) {
		throw new Error(`WeLoveDevs API request failed with status ${response.status}`);
	}

	const payload = parseJobPage(await response.json());
	const totalCount = toPositiveInteger(payload.totalCount, 0);
	const jobs = Array.isArray(payload.values) ? payload.values : [];

	const mappedJobs = jobs.map((item) => (item ?? {}) as WeLoveDevsJobLike);
	const externalIds = mappedJobs
		.map((job) => toTrimmedString(job.id))
		.filter((value): value is string => Boolean(value));
	const seenExternalIds = await findExistingExternalIds(externalIds);

	let insertedCount = 0;

	for (const job of mappedJobs) {
		const externalId = toTrimmedString(job.id);

		if (!externalId || seenExternalIds.has(externalId)) {
			continue;
		}

		seenExternalIds.add(externalId);
		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();
			const offerId = await createOffer(connection, job);

			if (offerId) {
				insertedCount += 1;
			}

			await connection.commit();
		} catch (error) {
			await connection.rollback();

			if (isDuplicateOfferSourceError(error)) {
				continue;
			}

			throw error;
		} finally {
			connection.release();
		}
	}

	return {
		totalCount,
		pageCount: mappedJobs.length,
		insertedCount
	};
};

export const runWeLoveDevsSyncOnce = async (
	options?: { force?: boolean }
): Promise<WeLoveDevsSyncResult> => {
	const config = getConfig();
	const startTime = Date.now();

	if (!config.enabled && !options?.force) {
		return {
			skipped: true,
			reason: "disabled",
			fetchedCount: 0,
			insertedCount: 0,
			totalCount: 0,
			durationMs: Date.now() - startTime
		};
	}

	if (!config.apiKey) {
		console.warn("[welovedevs-sync] WLD_SYNC_ENABLED=true but WLD_API_KEY is missing");
		return {
			skipped: true,
			reason: "missing_api_key",
			fetchedCount: 0,
			insertedCount: 0,
			totalCount: 0,
			durationMs: Date.now() - startTime
		};
	}

	let page = 0;
	let totalCount = 0;
	let fetchedCount = 0;
	let insertedCount = 0;
	let lastRequestAt = 0;

	while (true) {
		const elapsedSinceLastRequest = Date.now() - lastRequestAt;

		if (lastRequestAt > 0 && elapsedSinceLastRequest < config.minDelayMs) {
			await sleep(config.minDelayMs - elapsedSinceLastRequest);
		}

		lastRequestAt = Date.now();
		const pageResult = await syncPage(config, page);

		totalCount = pageResult.totalCount;
		fetchedCount += pageResult.pageCount;
		insertedCount += pageResult.insertedCount;

		if (pageResult.pageCount === 0) {
			break;
		}

		if (fetchedCount >= totalCount) {
			break;
		}

		page += 1;
	}

	const durationMs = Date.now() - startTime;
	console.log(
		`[welovedevs-sync] done in ${durationMs}ms (fetched=${fetchedCount}, inserted=${insertedCount}, total=${totalCount})`
	);

	return {
		skipped: false,
		fetchedCount,
		insertedCount,
		totalCount,
		durationMs
	};
};

export const startWeLoveDevsSyncCron = (): void => {
	const config = getConfig();

	if (!config.enabled) {
		console.log("[welovedevs-sync] disabled");
		return;
	}

	console.log(
		`[welovedevs-sync] enabled (interval=${Math.round(config.intervalMs / 60000)}m, pageSize=${config.pageSize})`
	);

	let isRunning = false;

	const run = async (): Promise<void> => {
		if (isRunning) {
			console.warn("[welovedevs-sync] skipped run because previous execution is still running");
			return;
		}

		isRunning = true;

		try {
			await runWeLoveDevsSyncOnce();
		} catch (error) {
			console.error("[welovedevs-sync] run failed", error);
		} finally {
			isRunning = false;
		}
	};

	void run();
	setInterval(() => {
		void run();
	}, config.intervalMs);
};

export default {
	runWeLoveDevsSyncOnce,
	startWeLoveDevsSyncCron
};
