import fs from "node:fs";
import path from "node:path";
import type { Express, Router } from "express";

const ROUTES_FILE_PATTERN = /\.routes\.(ts|js)$/;

const resolveRoutesModulePath = (moduleDirectoryPath: string): string | null => {
	const entries = fs.readdirSync(moduleDirectoryPath, { withFileTypes: true });
	const routesFile = entries.find((entry) => entry.isFile() && ROUTES_FILE_PATTERN.test(entry.name));

	if (!routesFile) {
		return null;
	}

	return path.join(moduleDirectoryPath, routesFile.name.replace(/\.(ts|js)$/, ""));
};

interface RoutesModule {
	basePath?: string;
	default?: Router;
	router?: Router;
}

const isRoutesModule = (value: RoutesModule | Router): value is RoutesModule =>
	typeof value === "object" && value !== null;

export const registerModuleRoutes = (app: Express): void => {
	const modulesRootPath = path.resolve(__dirname);
	const moduleEntries = fs.readdirSync(modulesRootPath, { withFileTypes: true });

	for (const moduleEntry of moduleEntries) {
		if (!moduleEntry.isDirectory()) {
			continue;
		}

		const moduleName = moduleEntry.name;
		const moduleDirectoryPath = path.join(modulesRootPath, moduleName);
		const routesModulePath = resolveRoutesModulePath(moduleDirectoryPath);

		if (!routesModulePath) {
			continue;
		}

		try {
			const routesModule = require(routesModulePath) as RoutesModule | Router;
			const router = isRoutesModule(routesModule)
				? routesModule.default ?? routesModule.router ?? routesModule
				: routesModule;
			const mountPath = isRoutesModule(routesModule)
				? routesModule.basePath ?? `/${moduleName}`
				: `/${moduleName}`;

			if (typeof router === "function") {
				app.use(mountPath, router);
			}
		} catch (error) {
			console.warn(`[routes] Failed to load module '${moduleName}'`, error);
		}
	}
};

export default registerModuleRoutes;
