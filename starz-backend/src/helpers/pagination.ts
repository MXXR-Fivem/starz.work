export interface PaginationQuery {
	page: number;
	size: number;
}

export const buildPagination = (query: PaginationQuery, total: number) => ({
	page: query.page,
	size: query.size,
	total,
	totalPages: Math.ceil(total / query.size)
});
