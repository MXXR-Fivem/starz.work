export const formatContractType = (contractType?: string | null): string => {
    if (!contractType) {
        return "";
    }

    return contractType
        .replace(/Permanent contract/gi, "CDI")
        .replace(/^Permanent$/gi, "CDI")
        .replace(/Fixed term contract/gi, "CDD")
        .replace(/^Fixed term$/gi, "CDD")
        .replace(/Internship/gi, "Stage")
        .replace(/Apprenticeship/gi, "Alternance")
        .replace(/part(?:[-_\s]*)time/gi, "Alternance");
};

export const formatRemotePolicy = (remotePolicy?: string | null): string => {
    if (!remotePolicy) {
        return "";
    }

    return remotePolicy
        .replace(/full(?:[-\s]*)time/gi, "Télétravail complet")
        .replace(/full/gi, "Télétravail complet")
        .replace(/partial(?:[-\s]*)time/gi, "Télétravail partiel")
        .replace(/partial/gi, "Télétravail partiel")
        .replace(/none/gi, "Sur site")
        .replace(/no/gi, "Sur site")
        .replace(/yes/gi, "Télétravail");
};

type SalaryPeriod = "yearly" | "daily";

const annualAmount = (value: number): number => value < 1000 ? value * 1000 : value;

export const formatSalary = ({
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryPeriod = "yearly",
}: {
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    salaryPeriod?: SalaryPeriod | null;
}): string | null => {
    if (!salaryMin && !salaryMax) return null;

    const currency = salaryCurrency || "EUR";
    const suffix = salaryPeriod === "daily" ? " / jour" : " / an";
    const normalizeAmount = salaryPeriod === "daily" ? (value: number) => value : annualAmount;
    const formatAmount = (value: number) => normalizeAmount(value).toLocaleString();

    if (salaryMin && salaryMax) {
        return `${formatAmount(salaryMin)} - ${formatAmount(salaryMax)} ${currency}${suffix}`;
    }

    if (salaryMin) {
        return `À partir de ${formatAmount(salaryMin)} ${currency}${suffix}`;
    }

    return `Jusqu'à ${formatAmount(salaryMax!)} ${currency}${suffix}`;
};
