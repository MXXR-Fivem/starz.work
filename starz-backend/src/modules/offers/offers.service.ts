import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../../config/database";
import { toIsoDate, toIsoDateOrNull } from "../../helpers/date";
import { geocodeCity, getDefaultCityRadiusKm } from "../../helpers/geocoding";
import createHttpError from "../../helpers/httpError";
import { buildPagination } from "../../helpers/pagination";
import { normalizeSkill } from "../../helpers/string";
import type {
	CreateOfferPayload,
	CreateOfferSourcePayload,
	GetOffersQuery,
	UpdateOfferPayload,
	UpdateOfferSourcePayload
} from "./offers.schemas";
import { getOffersQuerySchema } from "./offers.schemas";

interface OfferListRow extends RowDataPacket {
	id: number;
	company_id: number;
	title: string;
	description_preview: string | null;
	location: string | null;
	latitude: number | null;
	longitude: number | null;
	contract_type: string | null;
	remote_policy: string | null;
	status: "draft" | "published" | "closed";
	moderation_status: "approved" | "rejected";
	premium: number;
	views_count: number;
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string;
	salary_period: "yearly" | "daily";
	source_posted_at: Date | string | null;
	published_at: Date | string | null;
	expires_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	company_name: string;
	distance_km?: number;
}

interface OfferByIdRow extends OfferListRow {
	description: string;
}

interface OfferSourceRow extends RowDataPacket {
	id: number;
	source_name: "welovedevs" | "manual";
	external_id: string;
	source_url: string | null;
	raw_payload: unknown;
	fetched_at: Date | string | null;
	created_at: Date | string;
}

interface OfferRawPayload {
	description?: unknown;
	rawDescription?: unknown;
	descriptionPreview?: unknown;
}

interface UserAccessRow extends RowDataPacket {
	role_name: string | null;
	orga_id: number | null;
}

interface OfferCompanyRow extends RowDataPacket {
	company_id: number;
}

interface OfferCountRow extends RowDataPacket {
	total: number;
}

interface OfferListItem {
	id: number;
	companyId: number;
	companyName: string;
	title: string;
	descriptionPreview: string | null;
	location: string | null;
	latitude: number | null;
	longitude: number | null;
	contractType: string | null;
	remotePolicy: string | null;
	status: "draft" | "published" | "closed";
	moderationStatus: "approved" | "rejected";
	premium: boolean;
	viewsCount: number;
	salaryMin: number | null;
	salaryMax: number | null;
	salaryCurrency: string;
	salaryPeriod: "yearly" | "daily";
	sourcePostedAt: string | null;
	publishedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	distanceKm?: number;
	skills: { id: number; name: string }[];
}

interface OfferDetails extends OfferListItem {
	description: string;
	sources: {
		id: number;
		sourceName: "welovedevs" | "manual";
		sourceUrl: string | null;
		fetchedAt: string | null;
		createdAt: string;
	}[];
}

interface PaginatedOffers {
	items: OfferListItem[];
	pagination: {
		page: number;
		size: number;
		total: number;
		totalPages: number;
	};
}

const parseCsvNumbers = (rawValue?: string): number[] => {
	if (!rawValue) {
		return [];
	}

	return rawValue
		.split(",")
		.map((item) => Number(item.trim()))
		.filter((item) => Number.isInteger(item) && item > 0);
};

const parseCsvStrings = (rawValue?: string): string[] => {
	if (!rawValue) {
		return [];
	}

	return rawValue
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
};

const normalizeContractTypeFilters = (value: string): string[] => {
	const normalizedValue = value.trim().toLowerCase();

	if (normalizedValue === "cdi") {
		return ["CDI", "Permanent", "Permanent contract"];
	}

	if (normalizedValue === "cdd") {
		return ["CDD", "Fixed term", "Fixed term contract"];
	}

	if (normalizedValue === "stage") {
		return ["Stage", "Internship"];
	}

	if (normalizedValue === "alternance") {
		return ["Alternance", "Apprenticeship"];
	}

	return [value];
};

const buildOffersWhereClause = (
	query: GetOffersQuery,
	options?: { publicView?: boolean }
): {
	whereSql: string;
	params: unknown[];
	distanceParams: unknown[];
	distanceSelectSql: string;
	needsDistance: boolean;
} => {
	const whereClauses: string[] = [];
	const params: unknown[] = [];
	const hasDistanceQuery = query.lat !== undefined && query.lng !== undefined;
	const publicView = options?.publicView ?? false;

	if (publicView) {
		whereClauses.push("o.status = 'published'");
		whereClauses.push("o.moderation_status = 'approved'");
		whereClauses.push("(o.expires_at IS NULL OR o.expires_at >= NOW())");
	} else if (query.status) {
		whereClauses.push("o.status = ?");
		params.push(query.status);
	}

	if (!publicView && query.moderationStatus) {
		whereClauses.push("o.moderation_status = ?");
		params.push(query.moderationStatus);
	}

	if (query.companyId) {
		whereClauses.push("o.company_id = ?");
		params.push(query.companyId);
	}

	if (query.location) {
		whereClauses.push("o.location LIKE ?");
		params.push(`%${query.location}%`);
	}

	if (query.contractType) {
		const contractTypes = normalizeContractTypeFilters(query.contractType);
		whereClauses.push(`(${contractTypes.map(() => "o.contract_type LIKE ?").join(" OR ")})`);
		params.push(...contractTypes.map((contractType) => `%${contractType}%`));
	}

	if (query.remotePolicy) {
		whereClauses.push("o.remote_policy LIKE ?");
		params.push(`%${query.remotePolicy}%`);
	}

	if (query.premium !== undefined) {
		whereClauses.push("o.premium = ?");
		params.push(query.premium ? 1 : 0);
	}

	if (query.salaryMin !== undefined) {
		whereClauses.push("(o.salary_max IS NULL OR o.salary_max >= ?)");
		params.push(query.salaryMin);
	}

	if (query.salaryMax !== undefined) {
		whereClauses.push("(o.salary_min IS NULL OR o.salary_min <= ?)");
		params.push(query.salaryMax);
	}

	const skillIds = parseCsvNumbers(query.skillIds);
	if (skillIds.length > 0) {
		const placeholders = skillIds.map(() => "?").join(", ");
		whereClauses.push(
			`EXISTS (
				SELECT 1
				FROM offer_skills osi
				WHERE osi.offer_id = o.id AND osi.skill_id IN (${placeholders})
			)`
		);
		params.push(...skillIds);
	}

	const skillNames = parseCsvStrings(query.skills);
	if (skillNames.length > 0) {
		const skillNameClauses = skillNames.map(() => "s.name LIKE ?").join(" OR ");
		whereClauses.push(
			`EXISTS (
				SELECT 1
				FROM offer_skills osn
				INNER JOIN skills s ON s.id = osn.skill_id
				WHERE osn.offer_id = o.id AND (${skillNameClauses})
			)`
		);
		params.push(...skillNames.map((name) => `%${name}%`));
	}

	if (query.q) {
		const contractQueries = normalizeContractTypeFilters(query.q);

		whereClauses.push(
			`(
				o.title LIKE ?
				OR o.description LIKE ?
				OR o.description_preview LIKE ?
				OR c.name LIKE ?
				OR (${contractQueries.map(() => "o.contract_type LIKE ?").join(" OR ")})
				OR o.remote_policy LIKE ?
				OR EXISTS (
					SELECT 1
					FROM offer_skills osq
					INNER JOIN skills sq ON sq.id = osq.skill_id
					WHERE osq.offer_id = o.id AND sq.name LIKE ?
				)
			)`
		);
		params.push(
			`%${query.q}%`,
			`%${query.q}%`,
			`%${query.q}%`,
			`%${query.q}%`,
			...contractQueries.map((contractQuery) => `%${contractQuery}%`),
			`%${query.q}%`,
			`%${query.q}%`
		);
	}

	const distanceFormula = hasDistanceQuery
		? `
			(
				6371 * ACOS(
					COS(RADIANS(?)) * COS(RADIANS(o.latitude)) *
					COS(RADIANS(o.longitude) - RADIANS(?)) +
					SIN(RADIANS(?)) * SIN(RADIANS(o.latitude))
				)
			)
		`
		: "";

	if (hasDistanceQuery && query.radiusKm !== undefined) {
		whereClauses.push("o.latitude IS NOT NULL AND o.longitude IS NOT NULL");
		whereClauses.push(`${distanceFormula} <= ?`);
		params.push(query.lat as number, query.lng as number, query.lat as number, query.radiusKm);
	}

	return {
		whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
		params,
		distanceParams: hasDistanceQuery
			? [query.lat as number, query.lng as number, query.lat as number]
			: [],
		distanceSelectSql: hasDistanceQuery ? `${distanceFormula} AS distance_km,` : "",
		needsDistance: hasDistanceQuery
	};
};

const resolveCityQuery = async (query: GetOffersQuery): Promise<GetOffersQuery> => {
	if (!query.city || (query.lat !== undefined && query.lng !== undefined)) {
		return query;
	}

	let coordinates: Awaited<ReturnType<typeof geocodeCity>> | null = null;

	try {
		coordinates = await geocodeCity(query.city);
	} catch (error) {
		if (process.env.NODE_ENV !== "production") {
			console.warn("[offers] city geocoding skipped", {
				city: query.city,
				message: error instanceof Error ? error.message : String(error)
			});
		}
		return query;
	}

	return {
		...query,
		lat: coordinates.lat,
		lng: coordinates.lng,
		radiusKm: query.radiusKm ?? getDefaultCityRadiusKm()
	};
};

const mapOfferListRow = (row: OfferListRow): OfferListItem => ({
	id: row.id,
	companyId: row.company_id,
	companyName: row.company_name,
	title: row.title,
	descriptionPreview: row.description_preview,
	location: row.location,
	latitude: row.latitude,
	longitude: row.longitude,
	contractType: row.contract_type,
	remotePolicy: row.remote_policy,
	status: row.status,
	moderationStatus: row.moderation_status,
	premium: row.premium === 1,
	viewsCount: Number(row.views_count ?? 0),
	salaryMin: row.salary_min,
	salaryMax: row.salary_max,
	salaryCurrency: row.salary_currency,
	salaryPeriod: row.salary_period,
	sourcePostedAt: toIsoDateOrNull(row.source_posted_at),
	publishedAt: toIsoDateOrNull(row.published_at),
	expiresAt: toIsoDateOrNull(row.expires_at),
	createdAt: toIsoDate(row.created_at),
	updatedAt: toIsoDate(row.updated_at),
	distanceKm: typeof row.distance_km === "number" ? row.distance_km : undefined,
	skills: []
});

const toTrimmedString = (value: unknown): string | null => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");

const htmlToText = (value: string): string =>
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

const parseRawPayload = (rawPayload: unknown): OfferRawPayload | null => {
	if (!rawPayload) {
		return null;
	}

	if (typeof rawPayload === "object") {
		return rawPayload as OfferRawPayload;
	}

	if (typeof rawPayload !== "string") {
		return null;
	}

	try {
		return JSON.parse(rawPayload) as OfferRawPayload;
	} catch (_error) {
		return null;
	}
};

const getBestSourceDescription = (rawPayload: unknown): string | null => {
	const payload = parseRawPayload(rawPayload);

	if (!payload) {
		return null;
	}

	return (
		(toTrimmedString(payload.description) ? htmlToText(toTrimmedString(payload.description) as string) : null) ??
		(toTrimmedString(payload.rawDescription) ? htmlToText(toTrimmedString(payload.rawDescription) as string) : null) ??
		(toTrimmedString(payload.descriptionPreview) ? htmlToText(toTrimmedString(payload.descriptionPreview) as string) : null)
	);
};

const extractJsonLdDescription = (html: string): string | null => {
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

	return null;
};

const normalizeWeLoveDevsJobUrl = (sourceUrl: string | null): string | null => {
	if (!sourceUrl) {
		return null;
	}

	return sourceUrl.replace("/app/jobs/", "/app/job/");
};

const fetchPublicJobDescription = async (sourceUrl: string | null): Promise<string | null> => {
	const normalizedSourceUrl = normalizeWeLoveDevsJobUrl(sourceUrl);

	if (!normalizedSourceUrl) {
		return null;
	}

	try {
		const response = await fetch(normalizedSourceUrl);

		if (!response.ok) {
			return null;
		}

		const description = extractJsonLdDescription(await response.text());
		return description ? htmlToText(description) : null;
	} catch (_error) {
		return null;
	}
};

const loadSkillsByOfferIds = async (
	offerIds: number[]
): Promise<Map<number, { id: number; name: string }[]>> => {
	const map = new Map<number, { id: number; name: string }[]>();

	if (offerIds.length === 0) {
		return map;
	}

	const placeholders = offerIds.map(() => "?").join(", ");
	const [rows] = await pool.query<(RowDataPacket & { offer_id: number; skill_id: number; skill_name: string })[]>(
		`
			SELECT os.offer_id, s.id AS skill_id, s.name AS skill_name
			FROM offer_skills os
			INNER JOIN skills s ON s.id = os.skill_id
			WHERE os.offer_id IN (${placeholders})
			ORDER BY s.name ASC
		`,
		offerIds
	);

	for (const row of rows) {
		const existing = map.get(row.offer_id) ?? [];
		existing.push({ id: row.skill_id, name: row.skill_name });
		map.set(row.offer_id, existing);
	}

	return map;
};

const getUserAccess = async (userId: number): Promise<UserAccessRow | null> => {
	const [rows] = await pool.query<UserAccessRow[]>(
		`
			SELECT r.name AS role_name, u.orga_id
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE u.id = ?
			LIMIT 1
		`,
		[userId]
	);

	return rows[0] ?? null;
};

const getOfferCompany = async (offerId: number): Promise<OfferCompanyRow | null> => {
	const [rows] = await pool.query<OfferCompanyRow[]>(
		"SELECT company_id FROM offers WHERE id = ? LIMIT 1",
		[offerId]
	);

	return rows[0] ?? null;
};

const assertCanManageCompany = async (userId: number, companyId: number): Promise<void> => {
	const access = await getUserAccess(userId);

	if (!access) {
		throw createHttpError(401, "Unauthorized");
	}

	if (access.role_name === "admin") {
		return;
	}

	if (!access.orga_id || access.orga_id !== companyId) {
		throw createHttpError(403, "Forbidden");
	}
};

const assertCanManageOffer = async (userId: number, offerId: number): Promise<void> => {
	const offer = await getOfferCompany(offerId);

	if (!offer) {
		throw createHttpError(404, "Offer not found");
	}

	await assertCanManageCompany(userId, offer.company_id);
};

const assertAdmin = async (userId: number): Promise<void> => {
	const access = await getUserAccess(userId);

	if (!access) {
		throw createHttpError(401, "Unauthorized");
	}

	if (access.role_name !== "admin") {
		throw createHttpError(403, "Forbidden");
	}
};

const upsertSkills = async (offerId: number, skills: string[]): Promise<void> => {
	const uniqueSkills = Array.from(new Set(skills.map((skill) => skill.trim()).filter(Boolean)));

	for (const rawSkill of uniqueSkills) {
		const { name, normalizedName } = normalizeSkill(rawSkill, { collapseWhitespace: true });

		const [insertSkillResult] = await pool.query<ResultSetHeader>(
			`
				INSERT INTO skills (name, normalized_name)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
			`,
			[name.slice(0, 100), normalizedName.slice(0, 100)]
		);

		const skillId = Number(insertSkillResult.insertId);

		await pool.query<ResultSetHeader>(
			"INSERT IGNORE INTO offer_skills (offer_id, skill_id) VALUES (?, ?)",
			[offerId, skillId]
		);
	}
};

const listOffersForView = async (
	query: unknown,
	options?: { publicView?: boolean }
): Promise<PaginatedOffers> => {
	const resolvedQuery = await resolveCityQuery(getOffersQuerySchema.parse(query));
	const { whereSql, params, distanceParams, distanceSelectSql, needsDistance } =
		buildOffersWhereClause(resolvedQuery, { publicView: options?.publicView ?? true });
	const sortByMap: Record<string, string> = {
		publishedAt: "o.published_at",
		createdAt: "o.created_at",
		updatedAt: "o.updated_at",
		title: "o.title",
		salaryMin: "o.salary_min",
		salaryMax: "o.salary_max",
		distance: needsDistance ? "distance_km" : "o.published_at"
	};
	const sortBy = sortByMap[resolvedQuery.sortBy] ?? "o.published_at";
	const sortOrder = resolvedQuery.sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
	const orderBySql =
		resolvedQuery.sortBy === "premiumThenDate"
			? `o.premium DESC, o.published_at ${sortOrder}`
			: `${sortBy} ${sortOrder}`;
	const page = resolvedQuery.page;
	const size = resolvedQuery.size;
	const offset = page * size;

	const [countRows] = await pool.query<OfferCountRow[]>(
		`
			SELECT COUNT(DISTINCT o.id) AS total
			FROM offers o
			INNER JOIN companies c ON c.id = o.company_id
			${whereSql}
		`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<OfferListRow[]>(
		`
			SELECT
				${distanceSelectSql}
				o.id,
				o.company_id,
				o.title,
				o.description_preview,
				o.location,
				o.latitude,
				o.longitude,
				o.contract_type,
				o.remote_policy,
				o.status,
				o.moderation_status,
				o.premium,
				o.views_count,
				o.salary_min,
				o.salary_max,
				o.salary_currency,
				o.salary_period,
				o.source_posted_at,
				o.published_at,
				o.expires_at,
				o.created_at,
				o.updated_at,
				c.name AS company_name
			FROM offers o
			INNER JOIN companies c ON c.id = o.company_id
			${whereSql}
			ORDER BY ${orderBySql}
			LIMIT ? OFFSET ?
		`,
		[...distanceParams, ...params, size, offset]
	);

	const items = rows.map(mapOfferListRow);
	const skillsByOffer = await loadSkillsByOfferIds(items.map((item) => item.id));

	for (const item of items) {
		item.skills = skillsByOffer.get(item.id) ?? [];
	}

	return {
		items,
		pagination: buildPagination({ page, size }, total)
	};
};

export const listOffers = async (query: unknown): Promise<PaginatedOffers> =>
	listOffersForView(query, { publicView: true });

export const listRandomOffers = async (limit = 3): Promise<OfferListItem[]> => {
	const [rows] = await pool.query<OfferListRow[]>(
		`
			SELECT
				o.id,
				o.company_id,
				o.title,
				o.description_preview,
				o.location,
				o.latitude,
				o.longitude,
				o.contract_type,
				o.remote_policy,
				o.status,
				o.moderation_status,
				o.premium,
				o.views_count,
				o.salary_min,
				o.salary_max,
				o.salary_currency,
				o.salary_period,
				o.source_posted_at,
				o.published_at,
				o.expires_at,
				o.created_at,
				o.updated_at,
				c.name AS company_name
			FROM offers o
			INNER JOIN companies c ON c.id = o.company_id
			WHERE o.status = 'published'
				AND o.moderation_status = 'approved'
				AND (o.expires_at IS NULL OR o.expires_at >= NOW())
			ORDER BY RAND()
			LIMIT ?
		`,
		[limit]
	);

	const items = rows.map(mapOfferListRow);
	const skillsByOffer = await loadSkillsByOfferIds(items.map((item) => item.id));
	return items.map((item) => ({ ...item, skills: skillsByOffer.get(item.id) ?? [] }));
};

export const listAllOffers = async (query: unknown): Promise<PaginatedOffers> =>
	listOffersForView(query, { publicView: false });

export const getOfferById = async (
	offerId: number,
	options?: { publicView?: boolean }
): Promise<OfferDetails> => {
	const publicView = options?.publicView ?? false;
	const [rows] = await pool.query<OfferByIdRow[]>(
		`
			SELECT
				o.id,
				o.company_id,
				o.title,
				o.description,
				o.description_preview,
				o.location,
				o.latitude,
				o.longitude,
				o.contract_type,
				o.remote_policy,
				o.status,
				o.moderation_status,
				o.premium,
				o.views_count,
				o.salary_min,
				o.salary_max,
				o.salary_currency,
				o.salary_period,
				o.source_posted_at,
				o.published_at,
				o.expires_at,
				o.created_at,
				o.updated_at,
				c.name AS company_name
			FROM offers o
			INNER JOIN companies c ON c.id = o.company_id
			WHERE o.id = ?
			${
				publicView
					? "AND o.status = 'published' AND o.moderation_status = 'approved' AND (o.expires_at IS NULL OR o.expires_at >= NOW())"
					: ""
			}
			LIMIT 1
		`,
		[offerId]
	);
	const row = rows[0];

	if (!row) {
		throw createHttpError(404, "Offer not found");
	}

	const offer = mapOfferListRow(row) as OfferDetails;

	if (publicView) {
		await pool.query<ResultSetHeader>(
			"UPDATE offers SET views_count = views_count + 1 WHERE id = ?",
			[offerId]
		);
		offer.viewsCount += 1;
	}

	offer.description = row.description;

	const skillsByOffer = await loadSkillsByOfferIds([offerId]);
	offer.skills = skillsByOffer.get(offerId) ?? [];
	offer.sources = await getOfferSources(offerId, { publicView });

	const [sourceRows] = await pool.query<OfferSourceRow[]>(
		`
			SELECT id, source_name, external_id, source_url, raw_payload, fetched_at, created_at
			FROM offer_sources
			WHERE offer_id = ?
			ORDER BY created_at DESC
			LIMIT 1
		`,
		[offerId]
	);
	const sourceDescription = getBestSourceDescription(sourceRows[0]?.raw_payload);
	const publicDescription =
		sourceDescription && sourceDescription.length > offer.description.length
			? null
			: await fetchPublicJobDescription(sourceRows[0]?.source_url ?? null);

	if (sourceDescription && sourceDescription.length > offer.description.length) {
		offer.description = sourceDescription;
	}

	if (publicDescription && publicDescription.length > offer.description.length) {
		offer.description = publicDescription;

		await pool.query<ResultSetHeader>("UPDATE offers SET description = ? WHERE id = ?", [
			publicDescription,
			offerId
		]);

		const normalizedSourceUrl = normalizeWeLoveDevsJobUrl(sourceRows[0]?.source_url ?? null);

		if (sourceRows[0]?.id && normalizedSourceUrl !== sourceRows[0].source_url) {
			await pool.query<ResultSetHeader>("UPDATE offer_sources SET source_url = ? WHERE id = ?", [
				normalizedSourceUrl,
				sourceRows[0].id
			]);
		}
	}

	return offer;
};

export const createOffer = async (
	userId: number,
	payload: CreateOfferPayload
): Promise<OfferDetails> => {
	await assertCanManageCompany(userId, payload.companyId);

	const [insertResult] = await pool.query<ResultSetHeader>(
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
				published_at,
				expires_at,
				created_by_user_id,
				updated_by_user_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
		[
			payload.companyId,
			payload.title,
			payload.description,
			payload.descriptionPreview ?? null,
			payload.location ?? null,
			payload.latitude ?? null,
			payload.longitude ?? null,
			payload.contractType ?? null,
			payload.remotePolicy ?? null,
			payload.status,
			payload.moderationStatus,
			payload.premium ? 1 : 0,
			payload.salaryMin ?? null,
			payload.salaryMax ?? null,
			payload.salaryCurrency,
			payload.salaryPeriod,
			payload.sourcePostedAt ? new Date(payload.sourcePostedAt) : null,
			payload.publishedAt ? new Date(payload.publishedAt) : null,
			payload.expiresAt ? new Date(payload.expiresAt) : null,
			userId,
			userId
		]
	);

	const offerId = Number(insertResult.insertId);
	await upsertSkills(offerId, payload.skills);

	return getOfferById(offerId, { publicView: false });
};

export const updateOffer = async (
	userId: number,
	offerId: number,
	payload: UpdateOfferPayload
): Promise<OfferDetails> => {
	await assertCanManageOffer(userId, offerId);

	const updateFields: string[] = [];
	const updateValues: unknown[] = [];

	const mapField = (field: string, value: unknown): void => {
		updateFields.push(`${field} = ?`);
		updateValues.push(value);
	};

	if (payload.title !== undefined) {
		mapField("title", payload.title);
	}
	if (payload.description !== undefined) {
		mapField("description", payload.description);
	}
	if (payload.descriptionPreview !== undefined) {
		mapField("description_preview", payload.descriptionPreview);
	}
	if (payload.location !== undefined) {
		mapField("location", payload.location);
	}
	if (payload.latitude !== undefined) {
		mapField("latitude", payload.latitude);
	}
	if (payload.longitude !== undefined) {
		mapField("longitude", payload.longitude);
	}
	if (payload.contractType !== undefined) {
		mapField("contract_type", payload.contractType);
	}
	if (payload.remotePolicy !== undefined) {
		mapField("remote_policy", payload.remotePolicy);
	}
	if (payload.status !== undefined) {
		mapField("status", payload.status);
	}
	if (payload.premium !== undefined) {
		mapField("premium", payload.premium ? 1 : 0);
	}
	if (payload.salaryMin !== undefined) {
		mapField("salary_min", payload.salaryMin);
	}
	if (payload.salaryMax !== undefined) {
		mapField("salary_max", payload.salaryMax);
	}
	if (payload.salaryCurrency !== undefined) {
		mapField("salary_currency", payload.salaryCurrency);
	}
	if (payload.salaryPeriod !== undefined) {
		mapField("salary_period", payload.salaryPeriod);
	}
	if (payload.sourcePostedAt !== undefined) {
		mapField("source_posted_at", payload.sourcePostedAt ? new Date(payload.sourcePostedAt) : null);
	}
	if (payload.publishedAt !== undefined) {
		mapField("published_at", payload.publishedAt ? new Date(payload.publishedAt) : null);
	}
	if (payload.expiresAt !== undefined) {
		mapField("expires_at", payload.expiresAt ? new Date(payload.expiresAt) : null);
	}

	if (updateFields.length > 0) {
		updateFields.push("updated_by_user_id = ?");
		updateValues.push(userId);

		await pool.query<ResultSetHeader>(
			`UPDATE offers SET ${updateFields.join(", ")} WHERE id = ?`,
			[...updateValues, offerId]
		);
	}

	if (payload.skills !== undefined) {
		await pool.query<ResultSetHeader>("DELETE FROM offer_skills WHERE offer_id = ?", [offerId]);
		await upsertSkills(offerId, payload.skills);
	}

	return getOfferById(offerId, { publicView: false });
};

export const deleteOffer = async (userId: number, offerId: number): Promise<void> => {
	await assertCanManageOffer(userId, offerId);

	const [result] = await pool.query<ResultSetHeader>("DELETE FROM offers WHERE id = ?", [offerId]);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Offer not found");
	}
};

const updateOfferStatus = async (
	userId: number,
	offerId: number,
	status: "draft" | "published" | "closed"
): Promise<OfferDetails> => {
	await assertCanManageOffer(userId, offerId);

	await pool.query<ResultSetHeader>(
		"UPDATE offers SET status = ?, updated_by_user_id = ? WHERE id = ?",
		[status, userId, offerId]
	);

	return getOfferById(offerId);
};

export const publishOffer = async (userId: number, offerId: number): Promise<OfferDetails> => {
	return updateOfferStatus(userId, offerId, "published");
};

export const closeOffer = async (userId: number, offerId: number): Promise<OfferDetails> => {
	return updateOfferStatus(userId, offerId, "closed");
};

export const archiveOffer = async (userId: number, offerId: number): Promise<OfferDetails> => {
	return updateOfferStatus(userId, offerId, "draft");
};

export const restoreOffer = async (userId: number, offerId: number): Promise<OfferDetails> => {
	return updateOfferStatus(userId, offerId, "published");
};

export const updateOfferModerationStatus = async (
	userId: number,
	offerId: number,
	moderationStatus: "approved" | "rejected"
): Promise<OfferDetails> => {
	await assertAdmin(userId);

	await pool.query<ResultSetHeader>("UPDATE offers SET moderation_status = ? WHERE id = ?", [
		moderationStatus,
		offerId
	]);

	return getOfferById(offerId);
};

export const getOfferSkills = async (offerId: number): Promise<{ id: number; name: string }[]> => {
	const [offerRows] = await pool.query<RowDataPacket[]>("SELECT id FROM offers WHERE id = ? LIMIT 1", [
		offerId
	]);

	if (!offerRows[0]) {
		throw createHttpError(404, "Offer not found");
	}

	const skillsByOffer = await loadSkillsByOfferIds([offerId]);
	return skillsByOffer.get(offerId) ?? [];
};

export const addOfferSkills = async (
	userId: number,
	offerId: number,
	skills: string[]
): Promise<{ id: number; name: string }[]> => {
	await assertCanManageOffer(userId, offerId);
	await upsertSkills(offerId, skills);
	return getOfferSkills(offerId);
};

export const removeOfferSkill = async (
	userId: number,
	offerId: number,
	skillId: number
): Promise<void> => {
	await assertCanManageOffer(userId, offerId);

	const [result] = await pool.query<ResultSetHeader>(
		"DELETE FROM offer_skills WHERE offer_id = ? AND skill_id = ?",
		[offerId, skillId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Offer skill link not found");
	}
};

export const getOfferSources = async (
	offerId: number,
	options?: { publicView?: boolean }
): Promise<
	{
		id: number;
		sourceName: "welovedevs" | "manual";
		sourceUrl: string | null;
		fetchedAt: string | null;
		createdAt: string;
	}[]
> => {
	const publicView = options?.publicView ?? true;
	const [offerRows] = await pool.query<RowDataPacket[]>("SELECT id FROM offers WHERE id = ? LIMIT 1", [
		offerId
	]);

	if (!offerRows[0]) {
		throw createHttpError(404, "Offer not found");
	}

	if (publicView) {
		const [publicRows] = await pool.query<RowDataPacket[]>(
			`
				SELECT id
				FROM offers
				WHERE id = ?
					AND status = 'published'
					AND moderation_status = 'approved'
					AND (expires_at IS NULL OR expires_at >= NOW())
				LIMIT 1
			`,
			[offerId]
		);

		if (!publicRows[0]) {
			throw createHttpError(404, "Offer not found");
		}
	}

	const [rows] = await pool.query<OfferSourceRow[]>(
		`
			SELECT id, source_name, external_id, source_url, raw_payload, fetched_at, created_at
			FROM offer_sources
			WHERE offer_id = ?
			ORDER BY created_at DESC
		`,
		[offerId]
	);

	return rows.map((row) => ({
		id: row.id,
		sourceName: row.source_name,
		sourceUrl: row.source_url,
		fetchedAt: toIsoDateOrNull(row.fetched_at),
		createdAt: toIsoDate(row.created_at)
	}));
};

export const addOfferSource = async (
	userId: number,
	offerId: number,
	payload: CreateOfferSourcePayload
): Promise<void> => {
	await assertCanManageOffer(userId, offerId);

	await pool.query<ResultSetHeader>(
		`
			INSERT INTO offer_sources (offer_id, source_name, external_id, source_url, raw_payload, fetched_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		[
			offerId,
			payload.sourceName,
			payload.externalId,
			payload.sourceUrl ?? null,
			payload.rawPayload === undefined ? null : JSON.stringify(payload.rawPayload),
			payload.fetchedAt ? new Date(payload.fetchedAt) : new Date()
		]
	);
};

export const updateOfferSource = async (
	userId: number,
	offerId: number,
	sourceId: number,
	payload: UpdateOfferSourcePayload
): Promise<void> => {
	await assertCanManageOffer(userId, offerId);

	const updateFields: string[] = [];
	const updateValues: unknown[] = [];

	if (payload.sourceUrl !== undefined) {
		updateFields.push("source_url = ?");
		updateValues.push(payload.sourceUrl);
	}

	if (payload.rawPayload !== undefined) {
		updateFields.push("raw_payload = ?");
		updateValues.push(payload.rawPayload === null ? null : JSON.stringify(payload.rawPayload));
	}

	if (payload.fetchedAt !== undefined) {
		updateFields.push("fetched_at = ?");
		updateValues.push(payload.fetchedAt ? new Date(payload.fetchedAt) : null);
	}

	const [result] = await pool.query<ResultSetHeader>(
		`UPDATE offer_sources SET ${updateFields.join(", ")} WHERE id = ? AND offer_id = ?`,
		[...updateValues, sourceId, offerId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Offer source not found");
	}
};

export const deleteOfferSource = async (
	userId: number,
	offerId: number,
	sourceId: number
): Promise<void> => {
	await assertCanManageOffer(userId, offerId);

	const [result] = await pool.query<ResultSetHeader>(
		"DELETE FROM offer_sources WHERE id = ? AND offer_id = ?",
		[sourceId, offerId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Offer source not found");
	}
};

const offersService = {
	listOffers,
	listRandomOffers,
	listAllOffers,
	getOfferById,
	createOffer,
	updateOffer,
	deleteOffer,
	publishOffer,
	closeOffer,
	archiveOffer,
	restoreOffer,
	updateOfferModerationStatus,
	getOfferSkills,
	addOfferSkills,
	removeOfferSkill,
	getOfferSources,
	addOfferSource,
	updateOfferSource,
	deleteOfferSource
};

export default offersService;
