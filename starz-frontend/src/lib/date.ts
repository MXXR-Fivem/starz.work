const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const frenchDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const padDatePart = (value: string) => value.padStart(2, "0");

const isValidIsoDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const cleanIsoDate = (value: string | null) => {
    if (!value) {
        return "";
    }

    const date = value.slice(0, 10);
    return isoDatePattern.test(date) && isValidIsoDate(date) ? date : "";
};

export const formatDateForFrenchInput = (value: string | null) => {
    const date = cleanIsoDate(value);

    if (!date) {
        return "";
    }

    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
};

export const parseFrenchDateInput = (value: string) => {
    const date = value.trim();

    if (!date) {
        return "";
    }

    if (isoDatePattern.test(date)) {
        return isValidIsoDate(date) ? date : null;
    }

    const match = date.match(frenchDatePattern);

    if (!match) {
        return null;
    }

    const [, day, month, year] = match;
    const isoDate = `${year}-${padDatePart(month)}-${padDatePart(day)}`;

    return isValidIsoDate(isoDate) ? isoDate : null;
};
