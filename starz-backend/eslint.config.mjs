import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"node_modules/**",
			"coverage/**",
			"uploads/**",
			"dist/**"
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			globals: {
				Buffer: "readonly",
				console: "readonly",
				process: "readonly",
				require: "readonly",
				__dirname: "readonly",
				setInterval: "readonly",
				setTimeout: "readonly"
			}
		},
		rules: {
			"no-useless-assignment": "off",
			"no-undef": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					"argsIgnorePattern": "^_",
					"varsIgnorePattern": "^_",
					"caughtErrorsIgnorePattern": "^_"
				}
			]
		}
	},
	{
		files: ["**/*.js", "**/*.mjs"],
		languageOptions: {
			globals: {
				module: "readonly",
				process: "readonly"
			}
		},
		rules: {
			"no-undef": "off",
			"@typescript-eslint/no-require-imports": "off"
		}
	}
);
