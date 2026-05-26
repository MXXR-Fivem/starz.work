process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_value_for_smoke_tests";
process.env.SWAGGER_ENABLED = "false";

if (process.env.JEST_DB_TEST === "true") {
	process.env.DB_NAME = process.env.TEST_DB_NAME ?? "job_aggregator_test";
	process.env.DB_USER = process.env.TEST_DB_USER ?? "root";
	process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? "root";
	process.env.DB_HOST = process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? "localhost";
	process.env.DB_PORT = process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? "3307";
}
