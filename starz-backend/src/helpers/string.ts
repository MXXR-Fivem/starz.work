export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const sanitizeOptionalText = (value?: string): string | null => {
	if (!value) {
		return null;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : null;
};

export const normalizeSkill = (
	skill: string,
	options?: { collapseWhitespace?: boolean }
): { name: string; normalizedName: string } => {
	const name = skill.trim();
	const normalizedName = name.toLowerCase();

	return {
		name,
		normalizedName: options?.collapseWhitespace
			? normalizedName.replace(/\s+/g, " ")
			: normalizedName
	};
};
