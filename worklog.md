# Worklog

## BUG #1 — Dashboard Navigation State Not Preserved

**Date:** 2025-01-21
**File changed:** `src/components/secretza/dashboard/Dashboard.tsx`
**Root cause:** The Dashboard component derived its current page from the Zustand store (`useNavigationStore((s) => s.dashboardPage)`). During HMR / React Strict Mode, the store could re-initialize and reset `dashboardPage` to its initial value (`"overview"`), causing the page to snap back from "listings" to "overview". Additionally, the Header's "My Listings" button passed `{ tab: "listings" }` via `navigate()`, but the Dashboard never read `nav.params.tab`.

**Fix applied:**
1. Replaced `const currentPage = useNavigationStore((s) => s.dashboardPage)` with a **local `useState`** initialized from `localStorage`, making the Dashboard self-contained and immune to store resets.
2. Replaced `const setCurrentPage = useNavigationStore((s) => s.setDashboardPage)` with a local `setCurrentPage` (from `useState`) that persists to both `localStorage` and the Zustand store via a `useEffect` sync.
3. Added a mount-only `useEffect` that reads `nav.params.tab` so that external navigation (e.g., Header's "My Listings" button calling `navigate("dashboard", { tab: "listings" })`) correctly sets the dashboard page.
4. Removed the debug `useEffect` with `console.log("Dashboard page:", currentPage)`.

**Files NOT changed (confirmed no changes needed):**
- `src/components/secretza/layout/Header.tsx` — already calls `navigate("dashboard", { tab: "listings" })` which is now handled.
- `src/store/useAppStore.ts` — `dashboardPage` and `setDashboardPage` remain in the store for cross-component use; the Dashboard simply no longer depends on the store as its source of truth.

## BUG #2 — Edit Listing Opens Create Listing

**Date:** 2025-01-21
**Root cause:** When the user clicks "Edit" on a listing in the Dashboard, the `handleEdit` function navigates to the `"post-ad"` view with `{ listingId, mode: "edit" }` params, but the `CreateListingForm` was rendered without receiving these params. Additionally, the form had no edit mode logic at all (no data fetching, no PUT support), and the API had no PUT endpoint for updating listings.

**Fix applied across 3 files:**

### 1. `src/app/page.tsx`
- Passed `editListingId={nav.params.listingId || null}` and `editMode={nav.params.mode === "edit"}` as props to `CreateListingForm`.
- Fixed the Back button: when `nav.params.mode === "edit"`, clicking Back now navigates to `"dashboard"` instead of `"home"`.

### 2. `src/app/api/listings/[id]/route.ts`
- Added `import { getServerSession } from "next-auth"` and `import { authOptions } from "@/lib/auth"`.
- Added a new `PUT` handler that:
  - Authenticates the user via `getServerSession(authOptions)`.
  - Verifies the listing exists and belongs to the authenticated user (returns 404 if not).
  - Validates category, country, state, and city (same logic as the POST handler in `/api/listings/route.ts`).
  - Generates a new slug from the updated title.
  - Updates all editable fields: title, description, categorySlug, countrySlug, stateSlug, citySlug, tags, contact fields, and images.
  - Associates any newly uploaded image IDs with the listing.
  - Returns `{ success: true, listing: { id, slug, status } }`.

### 3. `src/components/secretza/listing/CreateListingForm.tsx`
- Added `CreateListingFormProps` interface with optional `editListingId` and `editMode` props.
- Added `isEditing` derived boolean and `isLoadingListing` state.
- Added a `useEffect` that fetches the existing listing via `GET /api/listings/${editListingId}` when in edit mode, populating all form fields (title, category, country, state, city, description, contact fields) and existing images (from `listingImages` or legacy `images` array). Pre-accepts terms for edits. Sets `draftRestoredRef.current = true` to prevent the draft restore effect from overwriting fetched data.
- Added a loading state UI (spinner + "Loading listing data...") shown while fetching.
- Modified `handleSubmit` to use `PUT /api/listings/${editListingId}` when editing, `POST /api/listings` when creating.
- Updated all user-facing text conditionally: heading shows "Edit Listing" vs "Create Listing", submit button shows "Update Listing" vs "Submit Listing", success screen shows "Listing Updated!" vs "Listing Submitted!", toast messages are edit-aware.
- No UI styling changes were made. The create flow is completely untouched — all edit-mode code is gated behind the `isEditing` boolean.

## BUG #3 — Admin Panel Shows Mock Data

**Date:** 2025-01-21
**Root cause:** The Admin Panel (`AdminPanel.tsx`) used hardcoded mock data instead of real database data. Specifically: `adminStats` and `formatNumber` were imported from `@/lib/mock-data`, `revenueData` was a hardcoded array of 8 months, `mockAdminUsers` was an array of 10 fake users, and `pendingItems` was always an empty array. Real API routes (`/api/admin/stats`, `/api/admin/users`, `/api/admin/listings`) existed but were not being used for the dashboard stats, user list, or revenue chart.

**Fix applied across 3 files:**

### 1. `src/lib/utils.ts`
- Added `formatNumber(num: number): string` helper function (moved from `@/lib/mock-data` to make it reusable without importing mock data).

### 2. `src/app/api/admin/stats/route.ts`
- Added monthly revenue aggregation: fetches all completed payments from the last 8 months, groups them by month using a `Map`, and returns the result as `monthlyRevenue` array in the API response.
- Each entry contains `{ month, revenue, listings }`.

### 3. `src/components/secretza/admin/AdminPanel.tsx`
- **Removed mock imports**: Replaced `import { adminStats, formatNumber } from "@/lib/mock-data"` with `import { formatNumber } from "@/lib/utils"`.
- **Removed hardcoded arrays**: Deleted the `revenueData` constant (8 fake months) and `mockAdminUsers` constant (10 fake users).
- **Added `AdminStatsData` interface** for type-safe API response handling.
- **AdminDashboardPage** now:
  - Fetches real stats from `/api/admin/stats?XTransformPort=3000` via `useEffect` + `useState`.
  - Displays a loading skeleton (5 pulsing cards) while stats are loading.
  - Uses `stats.totalUsers`, `stats.totalListings`, etc. for stat cards.
  - Uses `stats.monthlyRevenue` from the API for the revenue chart (falls back to empty array if no data).
  - Fetches pending listings from `/api/admin/listings?XTransformPort=3000&status=pending&limit=5` for the moderation queue (was always empty before).
  - Moderation queue now shows real pending listings with title and category, or an empty state message.
  - Pending review count uses `stats?.pendingReview ?? 0` instead of `adminStats.pendingReview`.
- **AdminUsersPage** now:
  - Fetches real users from `/api/admin/users?XTransformPort=3000&limit=50` via `useEffect` + `useState`.
  - Maps API response `users` (with `_count.listings`) to match the expected `User & { listings: number }` shape.
  - Shows a loading spinner while fetching.
  - Total user count uses `usersTotal` from the API response instead of `adminStats.totalUsers`.
- **All API calls use `?XTransformPort=3000`** suffix for port forwarding.
- **No visual design changes** — same dark theme, card styles, and layout preserved.
- **AdminSidebar, admin navigation, and other admin pages** were not modified.
