import request from "supertest";

import pool from "../../src/config/database";
import app from "../../src/app";

const password = "Password123!";
const offerId = 1;
const invitedUserId = 4;

const resetMutableTables = async (): Promise<void> => {
	await pool.query("DELETE FROM notifications");
	await pool.query("DELETE FROM applications");
	await pool.query("DELETE FROM company_invitations");
	await pool.query("DELETE FROM moderation_logs");
	await pool.query("DELETE FROM refresh_tokens");
	await pool.query("DELETE FROM sessions");
	await pool.query(
		`
			UPDATE users
			SET orga_id = NULL,
				company_role = NULL,
				status = 'en_recherche',
				banned_at = NULL,
				ban_reason = NULL
			WHERE id = ?
		`,
		[invitedUserId]
	);
};

const login = async (email: string): Promise<string> => {
	const response = await request(app)
		.post("/auth/login")
		.send({ email, password });

	expect(response.status).toBe(200);
	expect(response.body.success).toBe(true);

	const accessToken = response.body.data?.tokens?.accessToken;
	expect(typeof accessToken).toBe("string");

	return accessToken;
};

const auth = (accessToken: string): string => `Bearer ${accessToken}`;

describe("application flow with database", () => {
	beforeEach(async () => {
		await resetMutableTables();
	});

	afterAll(async () => {
		await resetMutableTables();
		await pool.end();
	});

	test("user applies to an offer and recruiter accepts the application", async () => {
		const userToken = await login("user@example.com");
		const recruiterToken = await login("recruiter@example.com");

		const profileResponse = await request(app)
			.get("/me")
			.set("Authorization", auth(userToken));

		expect(profileResponse.status).toBe(200);
		expect(profileResponse.body.data.user.email).toBe("user@example.com");

		const offersResponse = await request(app).get("/offers?size=5");
		expect(offersResponse.status).toBe(200);
		expect(offersResponse.body.data.items.some((offer: { id: number }) => offer.id === offerId)).toBe(true);

		const applicationResponse = await request(app)
			.post("/applications")
			.set("Authorization", auth(userToken))
			.send({
				offerId,
				coverLetter: "Je souhaite candidater a cette offre de test."
			});

		expect(applicationResponse.status).toBe(201);
		expect(applicationResponse.body.data.application.status).toBe("submitted");
		const applicationId = applicationResponse.body.data.application.id;
		expect(typeof applicationId).toBe("number");

		const companyApplicationsResponse = await request(app)
			.get(`/company/offers/${offerId}/applications`)
			.set("Authorization", auth(recruiterToken));

		expect(companyApplicationsResponse.status).toBe(200);
		expect(companyApplicationsResponse.body.data.items).toHaveLength(1);
		expect(companyApplicationsResponse.body.data.items[0].id).toBe(applicationId);

		const viewedApplicationResponse = await request(app)
			.get(`/company/offers/${offerId}/applications/${applicationId}`)
			.set("Authorization", auth(recruiterToken));

		expect(viewedApplicationResponse.status).toBe(200);
		expect(viewedApplicationResponse.body.data.application.status).toBe("viewed");

		const acceptedApplicationResponse = await request(app)
			.patch(`/company/offers/${offerId}/applications/${applicationId}/status`)
			.set("Authorization", auth(recruiterToken))
			.send({ status: "accepted" });

		expect(acceptedApplicationResponse.status).toBe(200);
		expect(acceptedApplicationResponse.body.data.application.status).toBe("accepted");

		const notificationsResponse = await request(app)
			.get("/notifications")
			.set("Authorization", auth(userToken));

		expect(notificationsResponse.status).toBe(200);
		expect(
			notificationsResponse.body.data.items.some(
				(notification: { event: string }) => notification.event === "application_update"
			)
		).toBe(true);
	});

	test("company owner invites a user and invited user accepts", async () => {
		const recruiterToken = await login("recruiter@example.com");
		const invitedToken = await login("invited@example.com");

		const invitationResponse = await request(app)
			.post("/company/invitations")
			.set("Authorization", auth(recruiterToken))
			.send({ email: "invited@example.com" });

		expect(invitationResponse.status).toBe(201);
		expect(invitationResponse.body.data.invitation.status).toBe("pending");
		const invitationId = invitationResponse.body.data.invitation.id;

		const notificationsResponse = await request(app)
			.get("/notifications")
			.set("Authorization", auth(invitedToken));

		expect(notificationsResponse.status).toBe(200);
		expect(notificationsResponse.body.data.items[0].event).toBe("company_invite");

		const acceptResponse = await request(app)
			.post(`/company/invitations/${invitationId}/accept`)
			.set("Authorization", auth(invitedToken));

		expect(acceptResponse.status).toBe(200);
		expect(acceptResponse.body.data.invitation.status).toBe("accepted");

		const membersResponse = await request(app)
			.get("/company/members")
			.set("Authorization", auth(recruiterToken));

		expect(membersResponse.status).toBe(200);
		expect(
			membersResponse.body.data.members.some((member: { id: number }) => member.id === invitedUserId)
		).toBe(true);
	});

	test("user can mark notifications as seen", async () => {
		const recruiterToken = await login("recruiter@example.com");
		const invitedToken = await login("invited@example.com");

		await request(app)
			.post("/company/invitations")
			.set("Authorization", auth(recruiterToken))
			.send({ email: "invited@example.com" })
			.expect(201);

		const unseenResponse = await request(app)
			.get("/notifications?seen=false")
			.set("Authorization", auth(invitedToken));

		expect(unseenResponse.status).toBe(200);
		expect(unseenResponse.body.data.items).toHaveLength(1);

		const seenResponse = await request(app)
			.patch("/notifications/seen")
			.set("Authorization", auth(invitedToken))
			.send({ all: true });

		expect(seenResponse.status).toBe(200);
		expect(seenResponse.body.data.updatedCount).toBe(1);

		const remainingUnseenResponse = await request(app)
			.get("/notifications?seen=false")
			.set("Authorization", auth(invitedToken));

		expect(remainingUnseenResponse.status).toBe(200);
		expect(remainingUnseenResponse.body.data.items).toHaveLength(0);
	});

	test("staff can ban a user and banned user cannot login", async () => {
		const adminToken = await login("admin@example.com");

		const banResponse = await request(app)
			.patch(`/staff/users/${invitedUserId}/ban`)
			.set("Authorization", auth(adminToken))
			.send({ reason: "Compte de test banni" });

		expect(banResponse.status).toBe(200);
		expect(banResponse.body.data.user.bannedAt).not.toBeNull();

		const loginResponse = await request(app)
			.post("/auth/login")
			.send({ email: "invited@example.com", password });

		expect(loginResponse.status).toBe(403);
		expect(loginResponse.body.message).toBe("User account is banned");
	});
});
