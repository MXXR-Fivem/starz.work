import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../../config/database";
import { toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import { buildPagination } from "../../helpers/pagination";
import type {
	MarkNotificationsSeenPayload,
	NotificationEvent,
	NotificationsQuery
} from "./notifications.schemas";

interface NotificationRow extends RowDataPacket {
	id: number;
	event: NotificationEvent;
	event_data: string | Record<string, unknown>;
	seen_at: Date | string | null;
	created_at: Date | string;
}

interface CountRow extends RowDataPacket {
	total: number;
}

interface CreateNotificationPayload {
	userId: number;
	event: NotificationEvent;
	eventData: Record<string, unknown>;
}

const parseEventData = (value: NotificationRow["event_data"]): Record<string, unknown> => {
	if (typeof value !== "string") {
		return value;
	}

	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
};

const mapNotification = (row: NotificationRow) => ({
	id: row.id,
	event: row.event,
	eventData: parseEventData(row.event_data),
	seen: row.seen_at !== null,
	seenAt: toIsoDateOrNull(row.seen_at),
	createdAt: toIsoDateOrNow(row.created_at)
});

export const createNotification = async ({
	userId,
	event,
	eventData
}: CreateNotificationPayload): Promise<void> => {
	await pool.query<ResultSetHeader>(
		`
			INSERT INTO notifications (user_id, event, event_data)
			VALUES (?, ?, ?)
		`,
		[userId, event, JSON.stringify(eventData)]
	);
};

export const listNotifications = async (userId: number, query: NotificationsQuery) => {
	const whereClauses = ["user_id = ?"];
	const params: unknown[] = [userId];

	if (query.seen !== undefined) {
		whereClauses.push(query.seen ? "seen_at IS NOT NULL" : "seen_at IS NULL");
	}

	const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
	const [countRows] = await pool.query<CountRow[]>(
		`SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<NotificationRow[]>(
		`
			SELECT id, event, event_data, seen_at, created_at
			FROM notifications
			${whereSql}
			ORDER BY created_at DESC, id DESC
			LIMIT ? OFFSET ?
		`,
		[...params, query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapNotification),
		pagination: buildPagination(query, total)
	};
};

export const markNotificationsSeen = async (
	userId: number,
	payload: MarkNotificationsSeenPayload
) => {
	if (payload.all) {
		const [result] = await pool.query<ResultSetHeader>(
			"UPDATE notifications SET seen_at = COALESCE(seen_at, NOW()) WHERE user_id = ? AND seen_at IS NULL",
			[userId]
		);

		return { updatedCount: result.affectedRows };
	}

	const ids = Array.from(new Set(payload.ids ?? []));
	const placeholders = ids.map(() => "?").join(", ");
	const [result] = await pool.query<ResultSetHeader>(
		`
			UPDATE notifications
			SET seen_at = COALESCE(seen_at, NOW())
			WHERE user_id = ? AND id IN (${placeholders})
		`,
		[userId, ...ids]
	);

	return { updatedCount: result.affectedRows };
};

const notificationsService = {
	createNotification,
	listNotifications,
	markNotificationsSeen
};

export default notificationsService;
