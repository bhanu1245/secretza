export type AdminPaymentsQueryParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export function buildAdminPaymentsUrl(params: AdminPaymentsQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  const query = qs.toString();
  return `/api/admin/payments/manual${query ? `?${query}` : ""}`;
}
