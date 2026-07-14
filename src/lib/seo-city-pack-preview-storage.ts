const STORAGE_KEY = "seo-city-pack-preview";
const TTL_MS = 30 * 60 * 1000;

export type StoredCityPackPreview = {
  jobId: string;
  cityId: string;
  cityName: string;
  savedAt: number;
};

export function saveCityPackPreviewSession(session: Omit<StoredCityPackPreview, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredCityPackPreview = { ...session, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function loadCityPackPreviewSession(): StoredCityPackPreview | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCityPackPreview;
    if (!parsed.jobId || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCityPackPreviewSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
