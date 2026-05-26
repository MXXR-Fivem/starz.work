import createHttpError from "./httpError";

export interface Coordinates {
	lat: number;
	lng: number;
}

interface NominatimSearchResult {
	lat?: string;
	lon?: string;
}

const DEFAULT_GEOCODING_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_CITY_RADIUS_KM = 10;

export const getDefaultCityRadiusKm = (): number => {
	const rawValue = process.env.GEOCODING_DEFAULT_RADIUS_KM?.trim();

	if (!rawValue) {
		return DEFAULT_CITY_RADIUS_KM;
	}

	const value = Number(rawValue);
	return Number.isFinite(value) && value > 0 ? value : DEFAULT_CITY_RADIUS_KM;
};

export const geocodeCity = async (city: string): Promise<Coordinates> => {
	const query = city.trim();

	if (!query) {
		throw createHttpError(400, "city must not be empty");
	}

	const baseUrl = process.env.GEOCODING_URL?.trim() || DEFAULT_GEOCODING_URL;
	const url = new URL(baseUrl);
	url.searchParams.set("q", query);
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("limit", "1");

	const countryCodes = process.env.GEOCODING_COUNTRY_CODES?.trim();
	if (countryCodes) {
		url.searchParams.set("countrycodes", countryCodes);
	}

	const timeoutMs = Number(process.env.GEOCODING_TIMEOUT_MS ?? 5000);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 5000);

	try {
		const response = await fetch(url, {
			headers: {
				"Accept": "application/json",
				"Accept-Language": "fr",
				"User-Agent": process.env.GEOCODING_USER_AGENT || "starz-work-backend/1.0"
			},
			signal: controller.signal
		});

		if (!response.ok) {
			throw createHttpError(502, "Unable to geocode city");
		}

		const results = (await response.json()) as NominatimSearchResult[];
		const firstResult = results[0];
		const lat = Number(firstResult?.lat);
		const lng = Number(firstResult?.lon);

		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			throw createHttpError(404, "City not found");
		}

		return { lat, lng };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw createHttpError(504, "City geocoding timed out");
		}

		if (typeof error === "object" && error !== null && "statusCode" in error) {
			throw error;
		}

		throw createHttpError(502, "Unable to geocode city");
	} finally {
		clearTimeout(timeout);
	}
};
