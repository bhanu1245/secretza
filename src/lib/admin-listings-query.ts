export type AdminListingsQueryParams = {
  page?: number;
  limit?: number;
  status?: string;
  filter?: string;
  search?: string;
};

export function buildAdminListingsUrl(params: AdminListingsQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.filter) qs.set("filter", params.filter);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  const query = qs.toString();
  return `/api/admin/listings${query ? `?${query}` : ""}`;
}
