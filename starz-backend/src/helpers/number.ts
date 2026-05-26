export const toPercent = (value: number, total: number): number =>
	total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;

export const roundTo = (value: number, digits = 2): number => Number(value.toFixed(digits));
