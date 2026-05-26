module.exports = {
	testEnvironment: "node",
	setupFiles: ["<rootDir>/tests/setup.ts"],
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	transform: {
		"^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
	},
	clearMocks: true
};
