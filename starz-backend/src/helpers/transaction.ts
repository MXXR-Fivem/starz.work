import type { PoolConnection } from "mysql2/promise";

import pool from "../config/database";

export const withTransaction = async <T>(
	transactionHandler: (connection: PoolConnection) => Promise<T>
): Promise<T> => {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();
		const result = await transactionHandler(connection);
		await connection.commit();
		return result;
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

export default withTransaction;
