import {
	isExpired,
	toIsoDate,
	toIsoDateOrNull,
	toIsoDateOrNow
} from "../../src/helpers/date";
import { parsePositiveInteger } from "../../src/helpers/env";
import { roundTo, toPercent } from "../../src/helpers/number";
import { buildPagination } from "../../src/helpers/pagination";
import {
	normalizeEmail,
	normalizeSkill,
	sanitizeOptionalText
} from "../../src/helpers/string";
import {
	assertUploadSignature,
	sanitizeUploadFilename
} from "../../src/helpers/upload";
import { booleanLikeSchema } from "../../src/helpers/zod";
import {
	htmlToText,
	normalizeSkill as normalizeWeloveDevsSkill,
	normalizeSalary,
	parseBooleanLike,
	toCurrencyCode,
	toDateOrNull,
	toNumberOrNull,
	toPositiveInteger,
	toStringOrNull,
	toTrimmedString
} from "../../src/services/welovedevsSync";

describe("helper normalizers and parsers", () => {
	test("normalizeEmail trims and lowercases emails", () => {
		expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
	});

	test("normalizeSkill trims and can collapse duplicated whitespace", () => {
		expect(normalizeSkill("  Node   JS  ", { collapseWhitespace: true })).toEqual({
			name: "Node   JS",
			normalizedName: "node js"
		});
	});

	test("sanitizeOptionalText returns null for empty text", () => {
		expect(sanitizeOptionalText("   ")).toBeNull();
		expect(sanitizeOptionalText("  hello  ")).toBe("hello");
	});

	test("parsePositiveInteger floors valid values and falls back on invalid values", () => {
		expect(parsePositiveInteger("42.9", 10)).toBe(42);
		expect(parsePositiveInteger("-1", 10)).toBe(10);
		expect(parsePositiveInteger(undefined, 10)).toBe(10);
	});

	test("number helpers format dashboard metrics", () => {
		expect(toPercent(1, 3)).toBe(33.33);
		expect(toPercent(1, 0)).toBe(0);
		expect(roundTo(12.345)).toBe(12.35);
	});

	test("booleanLikeSchema normalizes query booleans", () => {
		expect(booleanLikeSchema.parse("true")).toBe(true);
		expect(booleanLikeSchema.parse("0")).toBe(false);
		expect(booleanLikeSchema.safeParse("maybe").success).toBe(false);
	});
});

describe("date helpers", () => {
	const isoDate = "2026-05-01T10:20:30.000Z";

	test("toIsoDate and toIsoDateOrNull normalize valid dates", () => {
		expect(toIsoDate(new Date(isoDate))).toBe(isoDate);
		expect(toIsoDateOrNull(isoDate)).toBe(isoDate);
	});

	test("toIsoDateOrNull returns null for null or invalid dates", () => {
		expect(toIsoDateOrNull(null)).toBeNull();
		expect(toIsoDateOrNull("not-a-date")).toBeNull();
	});

	test("toIsoDateOrNow returns an ISO string for invalid dates", () => {
		expect(toIsoDateOrNow("not-a-date")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("isExpired treats null as active and invalid values as expired", () => {
		expect(isExpired(null)).toBe(false);
		expect(isExpired("not-a-date")).toBe(true);
	});
});

describe("pagination helper", () => {
	test("buildPagination calculates total pages", () => {
		expect(buildPagination({ page: 0, size: 20 }, 45)).toEqual({
			page: 0,
			size: 20,
			total: 45,
			totalPages: 3
		});
	});

	test("buildPagination handles empty result sets", () => {
		expect(buildPagination({ page: 2, size: 20 }, 0)).toEqual({
			page: 2,
			size: 20,
			total: 0,
			totalPages: 0
		});
	});
});

describe("upload helpers", () => {
	test("sanitizeUploadFilename keeps only the basename and safe characters", () => {
		expect(sanitizeUploadFilename("../../CV Théo Busiris.pdf")).toBe("CV_Théo_Busiris.pdf");
		expect(sanitizeUploadFilename("../../My CV #1.pdf")).toBe("My_CV__1.pdf");
		expect(sanitizeUploadFilename("   ")).toBeUndefined();
	});

	test("assertUploadSignature accepts matching file signatures", () => {
		expect(() => assertUploadSignature(Buffer.from("%PDF-1.7"), "pdf", "document")).not.toThrow();
		expect(() => assertUploadSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "jpg", "image")).not.toThrow();
	});

	test("assertUploadSignature rejects mismatched file signatures", () => {
		expect(() => assertUploadSignature(Buffer.from("fake"), "pdf", "document")).toThrow(
			"Uploaded file content does not match its type"
		);
	});
});

describe("WeLoveDevs sync normalization helpers", () => {
	test("toTrimmedString and toStringOrNull normalize unknown text", () => {
		expect(toTrimmedString("  Hello  ")).toBe("Hello");
		expect(toTrimmedString(42)).toBeUndefined();
		expect(toStringOrNull("abcdef", 3)).toBe("abc");
		expect(toStringOrNull("   ")).toBeNull();
	});

	test("numeric and boolean normalizers are conservative", () => {
		expect(toNumberOrNull("42.5")).toBe(42.5);
		expect(toNumberOrNull("nope")).toBeNull();
		expect(toPositiveInteger("12", 5)).toBe(12);
		expect(toPositiveInteger("12.5", 5)).toBe(5);
		expect(parseBooleanLike(true)).toBe(true);
		expect(parseBooleanLike("1")).toBe(true);
		expect(parseBooleanLike("0")).toBe(false);
	});

	test("toCurrencyCode normalizes known currency formats", () => {
		expect(toCurrencyCode("eur")).toBe("EUR");
		expect(toCurrencyCode("€")).toBe("EUR");
		expect(toCurrencyCode("usd/month")).toBe("EUR");
		expect(toCurrencyCode("USD")).toBe("USD");
	});

	test("htmlToText preserves useful description line breaks", () => {
		expect(htmlToText("<h2>Mission</h2><p>Hello<br>World</p><ul><li>Node</li><li>React</li></ul>"))
			.toContain("Mission\nHello\nWorld\n- Node\n- React");
	});

	test("normalizeSalary separates daily and yearly WeLoveDevs salaries", () => {
		expect(normalizeSalary({ daily: { min: 450, max: 650, currency: "EUR" } })).toEqual({
			min: 450,
			max: 650,
			currency: "EUR",
			period: "daily"
		});
		expect(normalizeSalary({ currency: "USD", daily: { min: 450, max: 650 } }).currency).toBe("USD");
		expect(normalizeSalary({ annualMin: 45000, annualMax: 60000, currency: "USD" })).toEqual({
			min: 45000,
			max: 60000,
			currency: "USD",
			period: "yearly"
		});
		expect(normalizeSalary({ min: 500, max: 700, unit: "day", currency: "€" }).period).toBe("daily");
	});

	test("toDateOrNull accepts seconds, milliseconds, microseconds and ISO dates", () => {
		const mayFirst2026Ms = Date.UTC(2026, 4, 1, 0, 0, 0);

		expect(toDateOrNull(mayFirst2026Ms / 1_000)?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(toDateOrNull(mayFirst2026Ms)?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(toDateOrNull(mayFirst2026Ms * 1_000)?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(toDateOrNull("2026-05-01T00:00:00.000Z")?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(toDateOrNull("not-a-date")).toBeNull();
	});

	test("normalizeSkill collapses whitespace for external skills", () => {
		expect(normalizeWeloveDevsSkill("  Type   Script  ")).toBe("type script");
	});
});
