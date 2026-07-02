const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * @typedef {Object} Pagination
 * @property {number} page
 * @property {number} pageSize
 * @property {number} offset
 * @property {number} limit
 */

/**
 * Creates a normalized pagination object for future read endpoints.
 *
 * This helper is generic infrastructure and is not used by existing routes.
 *
 * @param {{ page?: number|string, pageSize?: number|string }} [input]
 * @returns {Pagination}
 */
function createPagination(input = {}) {
  const parsedPage = Number(input.page ?? DEFAULT_PAGE);
  const parsedPageSize = Number(input.pageSize ?? DEFAULT_PAGE_SIZE);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : DEFAULT_PAGE;
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(Math.floor(parsedPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  createPagination,
};
