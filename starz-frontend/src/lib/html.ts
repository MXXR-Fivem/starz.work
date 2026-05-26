const htmlEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
};

export const decodeHtmlEntities = (value: string): string =>
    value.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, code: string) => {
        if (code.startsWith("#x") || code.startsWith("#X")) {
            return String.fromCharCode(Number.parseInt(code.slice(2), 16));
        }

        if (code.startsWith("#")) {
            return String.fromCharCode(Number.parseInt(code.slice(1), 10));
        }

        return htmlEntities[code] ?? entity;
    });
