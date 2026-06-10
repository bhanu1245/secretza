"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3, Loader2, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildGeoCascadeUrl } from "@/lib/admin-geo-form";

type GeoItem = { id: string; name: string; countryId?: string; stateId?: string };

type RankingAction = "recalculate" | "premium" | "city" | null;

export default function AdminRankingTools() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [confirmAction, setConfirmAction] = useState<RankingAction>(null);
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [runningAction, setRunningAction] = useState<RankingAction>(null);

  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityCount, setCityCount] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingCount, setLoadingCount] = useState(false);

  const isBusy = runningAction !== null;

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/admin/geo/countries?limit=100");
    const data = await res.json();
    if (res.ok) setCountries(data.items || []);
  }, []);

  useEffect(() => {
    if (cityDialogOpen) void loadCountries();
  }, [cityDialogOpen, loadCountries]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setCityId("");
      setCityCount(null);
      setCityName("");
      return;
    }
    const url = buildGeoCascadeUrl("states", { countryId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setStates(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [countryId]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId("");
      setCityCount(null);
      setCityName("");
      return;
    }
    const url = buildGeoCascadeUrl("cities", { stateId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setCities(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [stateId]);

  useEffect(() => {
    if (!cityId) {
      setCityCount(null);
      setCityName("");
      return;
    }
    const selected = cities.find((c) => c.id === cityId);
    setCityName(selected?.name || "");
    setLoadingCount(true);
    fetch(`/api/admin/listings/refresh-city-rankings?cityId=${encodeURIComponent(cityId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load count");
        setCityCount(data.count ?? 0);
        setCityName(data.cityName || selected?.name || "");
      })
      .catch(() => {
        setCityCount(null);
        toast.error("Failed to load listing count for city");
      })
      .finally(() => setLoadingCount(false));
  }, [cityId, cities]);

  const runRecalculate = async () => {
    setRunningAction("recalculate");
    setConfirmAction(null);
    try {
      const res = await fetch("/api/admin/listings/recalculate-rankings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success(`Successfully recalculated rankings for ${data.processed} listings.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to recalculate rankings");
    } finally {
      setRunningAction(null);
    }
  };

  const runPremiumRefresh = async () => {
    setRunningAction("premium");
    setConfirmAction(null);
    try {
      const res = await fetch("/api/admin/listings/refresh-premium-rankings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success(`Successfully refreshed premium rankings for ${data.processed} listings.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh premium rankings");
    } finally {
      setRunningAction(null);
    }
  };

  const runCityRefresh = async () => {
    if (!cityId) {
      toast.error("Select a city first");
      return;
    }
    setRunningAction("city");
    try {
      const res = await fetch("/api/admin/listings/refresh-city-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const label = data.cityName || cityName || "selected city";
      toast.success(`Successfully refreshed rankings for ${data.processed} ${label} listings.`);
      setCityDialogOpen(false);
      setCountryId("");
      setStateId("");
      setCityId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh city rankings");
    } finally {
      setRunningAction(null);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-white/10 bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] outline-none";

  if (!isAdmin) return null;

  return (
    <>
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#7C3AED]/15 p-2">
              <BarChart3 className="size-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#F5F5F7]">Ranking Tools</h3>
              <p className="text-sm text-[#A1A1AA] mt-1">
                Maintenance tools for ranking recovery and ranking recalculation.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setConfirmAction("recalculate")}
              className="border-white/10 bg-[#0B0B0F] text-[#F5F5F7] hover:bg-white/[0.04]"
            >
              {runningAction === "recalculate" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="size-4 mr-2" />
              )}
              {runningAction === "recalculate" ? "Recalculating..." : "Recalculate Rankings"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setConfirmAction("premium")}
              className="border-white/10 bg-[#0B0B0F] text-[#F5F5F7] hover:bg-white/[0.04]"
            >
              {runningAction === "premium" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              {runningAction === "premium" ? "Refreshing Premium Rankings..." : "Refresh Premium Rankings"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setCityDialogOpen(true)}
              className="border-white/10 bg-[#0B0B0F] text-[#F5F5F7] hover:bg-white/[0.04]"
            >
              {runningAction === "city" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="size-4 mr-2" />
              )}
              {runningAction === "city" ? "Refreshing City Rankings..." : "Refresh City Rankings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmAction === "recalculate"} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Recalculate Rankings</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              This will recompute ranking scores for all listings using the current ranking engine.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isBusy}
              className="border-white/10 bg-transparent text-[#A1A1AA]"
            >
              Cancel
            </Button>
            <Button type="button" onClick={runRecalculate} disabled={isBusy} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAction === "premium"} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Refresh Premium Rankings</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              This will refresh ranking position for all active premium listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isBusy}
              className="border-white/10 bg-transparent text-[#A1A1AA]"
            >
              Cancel
            </Button>
            <Button type="button" onClick={runPremiumRefresh} disabled={isBusy} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cityDialogOpen} onOpenChange={(open) => !isBusy && setCityDialogOpen(open)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Refresh City Rankings</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              This will refresh ranking position for all listings in the selected city.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Country</label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className={fieldClass}
                disabled={isBusy || loadingGeo}
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">State</label>
              <select
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                className={fieldClass}
                disabled={!countryId || isBusy || loadingGeo}
              >
                <option value="">Select state</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">City</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className={fieldClass}
                disabled={!stateId || isBusy || loadingGeo}
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {cityId && (
              <div className="rounded-lg bg-[#1E1E2A] p-3 text-sm space-y-1">
                <p className="text-[#A1A1AA]">
                  Selected City: <span className="text-[#F5F5F7] font-medium">{cityName || "—"}</span>
                </p>
                <p className="text-[#A1A1AA]">
                  Affected Listings:{" "}
                  <span className="text-[#F5F5F7] font-medium">
                    {loadingCount ? "Loading..." : cityCount ?? "—"}
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCityDialogOpen(false)}
              disabled={isBusy}
              className="border-white/10 bg-transparent text-[#A1A1AA]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={runCityRefresh}
              disabled={isBusy || !cityId || loadingCount}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
            >
              {runningAction === "city" ? "Refreshing City Rankings..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
