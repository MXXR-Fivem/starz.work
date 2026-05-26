export const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.floor(parsed);
};
