# Worklog

## Additional Fixes — Missing XTransformPort + Render-in-Render Anti-Pattern

**Date:** 2025-01-21
**Agent:** Main orchestrator

### Fixes Applied

1. **Dashboard.tsx DELETE listing fetch**: Added XTransformPort=3000 to DELETE request.
2. **Dashboard.tsx user listings fetch**: Fixed case-sensitive xTransformPort → XTransformPort.
3. **AuthModal.tsx register fetch**: Added XTransformPort=3000.
4. **AuthModal.tsx forgot-password fetch**: Added XTransformPort=3000.
5. **page.tsx admin guard**: Moved navigate() from render to useEffect.

### Verification
- bun run lint passes with zero errors.
- Dev server starts successfully.
- All client-side fetch calls now include XTransformPort=3000.

## BUG #1 — Dashboard Navigation Snap-Back (Follow-up Fix)

**Date:** 2025-01-21
**Root cause (refined):** Despite the previous fix introducing local `useState` as the source of truth in Dashboard.tsx, the Zustand store (`useAppStore.ts`) still initialized `dashboardPage` from `localStorage` at module load time. On SSR, `typeof window === "undefined"` so it defaulted to `"overview"`, but on client hydration the store re-initialized from `localStorage`. This created a timing conflict: the Zustand store's stale/competing initialization could trigger re-renders that overwrote the Dashboard's local state via the sync `useEffect`. Additionally, `page.tsx` called `navigate("home")` directly during render (a React 18+ strict mode anti-pattern), causing render→side-effect→render loops.

**Fix applied across 3 files:**

### 1. `src/store/useAppStore.ts`
- Removed `localStorage` initialization from `dashboardPage` in the Zustand store. It now always initializes to `"overview"`.
- The store is no longer a competing source of truth — it only receives updates from the Dashboard component via `setDashboardPage`.

### 2. `src/components/secretza/dashboard/Dashboard.tsx`
- Added `hasProcessedNavTab` ref (`useRef(false)`) to prevent the `nav.params.tab` effect from running multiple times and overwriting the user's manual page choice.
- Changed the `nav.params.tab` effect dependencies from `[]` (mount-only) to `[nav.params?.tab]` so it reacts to external navigation, while the ref guard ensures it only processes the first valid tab param.

### 3. `src/app/page.tsx`
- Moved the `navigate("home")` call from the render body into a `useEffect` with `[nav.view, isAuthenticated, navigate]` dependencies, eliminating the render-during-render anti-pattern in React 18+ strict mode.
- Added `useEffect` to the React import.

## BUG #1 — Dashboard Navigation State Not Preserved (Original Fix)

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

## BUG #2 — Edit Listing Opens Create Listing (Follow-up Fix: Fetch URL + Draft Race)

**Date:** 2025-01-21
**Root cause (refined):** Two issues prevented the edit flow from working:

1. **Missing `XTransformPort` on the GET fetch**: The `useEffect` that fetches the existing listing data (line 136) used `fetch(`/api/listings/${editListingId}`)` without `?XTransformPort=3000`. In this environment's gateway setup, the request was routed to the wrong port and failed silently. The form rendered empty (as if creating a new listing).

2. **Draft restore race condition**: The draft restore effect (line 235-271) only checked `draftRestoredRef.current` to decide whether to overwrite form state. While the edit fetch effect sets this ref to `true` at line 177, both effects run in the same initial render cycle. Since `draftRestoredRef.current` starts as `false`, the draft restore could execute and overwrite the form state with stale draft data before (or interleaved with) the edit fetch completing.

**Fix applied to 1 file:**

### 1. `src/components/secretza/listing/CreateListingForm.tsx`
- **Line 136**: Changed `fetch(`/api/listings/${editListingId}`)` → `fetch(`/api/listings/${editListingId}?XTransformPort=3000`)` so the GET request routes to the correct backend port.
- **Line 236**: Added an early return `if (isEditing) return;` at the top of the draft restore effect. This guarantees that when in edit mode, the draft restore effect never runs — regardless of timing or ref state — so the fetched listing data is never overwritten by stale localStorage draft data.
- **Verified**: The submit URL (line 424) already had `?XTransformPort=3000` on both the PUT (edit) and POST (create) paths — no change needed.

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

## BUG #3 — Admin Panel Shows Mock Data (Follow-up Fix: Missing XTransformPort + Hardcoded Percentages)

**Date:** 2025-01-21
**Root cause:** After the initial fix that replaced mock data with real API calls, two issues remained:

1. **Two `fetch()` calls in `AdminPanel.tsx` were missing `?XTransformPort=3000`**, causing them to fail silently in the gateway environment:
   - `AdminListingsPage` (line 666): `fetch("/api/admin/listings")` — the listings table page showed no data.
   - `AdminModerationPage` (line 1035): `fetch("/api/admin/listings?status=pending")` — the moderation queue showed no items.

2. **Hardcoded percentage change values** in dashboard stat cards (lines 286-291) displayed fake metrics like "+12.5%", "+8.2%", "+18.3%" next to real data, making the dashboard look misleading/mock-like.

3. **All `fetch()` calls in `SeoManager.tsx` (13 calls) and `SeoDashboard.tsx` (1 call) were also missing `?XTransformPort=3000`**, causing the SEO admin section to fail silently.

**Fix applied across 3 files:**

### 1. `src/components/secretza/admin/AdminPanel.tsx`
- **Line 666**: Changed `fetch("/api/admin/listings")` → `fetch("/api/admin/listings?XTransformPort=3000")`.
- **Line 1035**: Changed `fetch("/api/admin/listings?status=pending")` → `fetch("/api/admin/listings?status=pending&XTransformPort=3000")`.
- **Lines 286-291**: Removed hardcoded `change` property from all 5 stats card objects (`"+12.5%"`, `"+8.2%"`, `"+5.1%"`, `"+3"`, `"+18.3%"`).
- **Lines 322-330**: Removed the `<span>` that rendered the `ArrowUpRight` icon and `stat.change` text. Stats cards now only show the icon, value, and label.

### 2. `src/components/secretza/admin/SeoManager.tsx`
- Added `XTransformPort=3000` to all 13 fetch calls:
  - `fetchPages()` GET (added via `params.set('XTransformPort', '3000')`)
  - `handleSavePage()` PATCH
  - `handleQuickNoindex()` PATCH
  - `openFaqManager()` GET (single page with FAQs)
  - `handleSaveFaq()` POST (create FAQ)
  - `handleSaveFaq()` PATCH (edit FAQ)
  - `handleReorderFaq()` — both PATCH calls (swap two FAQ sort orders)
  - `handleDeletePage()` DELETE
  - `handleDeleteFaq()` DELETE
  - `handleBulkGenerate()` POST (city SEO pages)
  - `loadCityIntro()` GET
  - `saveCityIntro()` POST

### 3. `src/components/secretza/admin/SeoDashboard.tsx`
- **Line 1057**: Changed `fetch(\`/api/seo/dashboard?days=${days}\`)` → `fetch(\`/api/seo/dashboard?days=${days}&XTransformPort=3000\`)`.

**Verification:** Grep confirmed all 23 `fetch()` calls across the 3 admin files now include `XTransformPort=3000`. No other `fetch("/api/` calls in `src/components/secretza/admin/` are missing the parameter.
