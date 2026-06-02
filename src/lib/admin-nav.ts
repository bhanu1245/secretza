/** Canonical admin entry URL — use for all redirects and links. */
export const ADMIN_HOME = "/admin";

export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "moderator";
}
