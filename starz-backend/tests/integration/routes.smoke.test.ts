import request from "supertest";

import app from "../../src/app";

jest.mock("../../src/config/database", () => ({
	__esModule: true,
	default: {
		query: jest.fn(async (sql: unknown) => {
			const query = String(sql);

			if (query.includes("COUNT(")) {
				return [[{ total: 0 }]];
			}

			return [[]];
		})
	}
}));

interface SmokeRoute {
	method: "get" | "post" | "patch" | "put" | "delete";
	path: string;
	expectedStatus: number;
	body?: Record<string, unknown>;
}

const route = (
	method: SmokeRoute["method"],
	path: string,
	expectedStatus: number,
	body?: Record<string, unknown>
): SmokeRoute => ({
	method,
	path,
	expectedStatus,
	body
});

const smokeRoutes: SmokeRoute[] = [
	route("get", "/health", 200),
	route("post", "/auth/register", 400, {}),
	route("post", "/auth/login", 400, {}),
	route("get", "/auth/oauth/google/url", 400),
	route("post", "/auth/oauth/google", 400, {}),
	route("post", "/auth/logout", 401, {}),
	route("post", "/auth/refresh", 401, {}),
	route("get", "/auth/sessions", 401),
	route("delete", "/auth/sessions/1", 401),
	route("delete", "/auth/sessions", 401),
	route("post", "/auth/verify-email", 400, {}),
	route("post", "/auth/resend-verification", 400, {}),
	route("post", "/auth/forgot-password", 400, {}),
	route("post", "/auth/reset-password", 400, {}),
	route("get", "/me", 401),
	route("get", "/me/data", 401),
	route("patch", "/me", 401, {}),
	route("delete", "/me", 401),
	route("put", "/me/profile-photo", 401),
	route("put", "/me/cv", 401),
	route("post", "/me/oauth/google", 401, {}),
	route("patch", "/me/password", 401, {}),
	route("get", "/me/favorites", 401),
	route("post", "/me/favorites", 401, {}),
	route("delete", "/me/favorites/1", 401),
	route("get", "/applications", 401),
	route("post", "/applications", 401, {}),
	route("get", "/applications/expired", 401),
	route("get", "/applications/1", 401),
	route("patch", "/applications/1/withdraw", 401),
	route("get", "/notifications", 401),
	route("patch", "/notifications/seen", 401, {}),
	route("get", "/company", 401),
	route("get", "/company/data", 401),
	route("post", "/company", 401, {}),
	route("patch", "/company", 401, {}),
	route("put", "/company/logo", 401),
	route("get", "/company/members", 401),
	route("delete", "/company/members/1", 401),
	route("get", "/company/invitations", 401),
	route("post", "/company/invitations", 401, {}),
	route("post", "/company/invitations/1/accept", 401),
	route("post", "/company/invitations/1/decline", 401),
	route("get", "/company/offers", 401),
	route("post", "/company/offers", 401, {}),
	route("patch", "/company/offers/1", 401, {}),
	route("patch", "/company/offers/1/close", 401),
	route("get", "/company/offers/1/applications", 401),
	route("get", "/company/offers/1/applications/1", 401),
	route("patch", "/company/offers/1/applications/1/status", 401, {}),
	route("get", "/staff/data", 401),
	route("get", "/staff/users", 401),
	route("get", "/staff/users/1", 401),
	route("patch", "/staff/users/1/ban", 401, {}),
	route("patch", "/staff/users/1/unban", 401),
	route("delete", "/staff/users/1", 401),
	route("get", "/staff/companies", 401),
	route("get", "/staff/companies/1", 401),
	route("patch", "/staff/companies/1", 401, {}),
	route("delete", "/staff/companies/1", 401),
	route("get", "/staff/offers", 401),
	route("patch", "/staff/offers/1", 401, {}),
	route("delete", "/staff/offers/1", 401),
	route("patch", "/staff/offers/1/moderation-status", 401, {}),
	route("get", "/offers", 200),
	route("get", "/offers/1", 404),
	route("post", "/offers", 401, {}),
	route("patch", "/offers/1", 401, {}),
	route("delete", "/offers/1", 401),
	route("patch", "/offers/1/publish", 401),
	route("patch", "/offers/1/close", 401),
	route("patch", "/offers/1/archive", 401),
	route("patch", "/offers/1/restore", 401),
	route("patch", "/offers/1/moderation-status", 401, {}),
	route("get", "/offers/1/skills", 404),
	route("post", "/offers/1/skills", 401, {}),
	route("delete", "/offers/1/skills/1", 401),
	route("get", "/offers/1/sources", 404),
	route("post", "/offers/1/sources", 401, {}),
	route("patch", "/offers/1/sources/1", 401, {}),
	route("delete", "/offers/1/sources/1", 401)
];

describe("route smoke tests", () => {
	test.each(smokeRoutes)("$method $path returns $expectedStatus", async ({ method, path, expectedStatus, body }) => {
		const response = await request(app)[method](path).send(body);

		expect(response.status).toBe(expectedStatus);
		expect(response.body).toHaveProperty("success");
	});
});
