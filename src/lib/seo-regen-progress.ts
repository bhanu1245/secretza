/**
 * Per-item regeneration progress — in-memory stages for live UI updates.
 */
export type RegenStageId =
  | "generating_intro"
  | "generating_faqs"
  | "rewriting_duplicates"
  | "optimizing_keywords"
  | "rewriting_faqs"
  | "rewriting_cta"
  | "calculating_scores"
  | "evaluating_improvement"
  | "saving"
  | "discarding"
  | "complete";

export type RegenStageStatus = "pending" | "running" | "complete" | "skipped";

export type RegenStage = {
  id: RegenStageId;
  label: string;
  status: RegenStageStatus;
};

const DEFAULT_STAGES: Array<{ id: RegenStageId; label: string }> = [
  { id: "generating_intro", label: "Generating intro" },
  { id: "generating_faqs", label: "Generating FAQs" },
  { id: "rewriting_duplicates", label: "Rewriting duplicated paragraphs" },
  { id: "optimizing_keywords", label: "Optimizing keywords" },
  { id: "rewriting_faqs", label: "Rewriting FAQs" },
  { id: "rewriting_cta", label: "Rewriting CTA" },
  { id: "calculating_scores", label: "Recalculating uniqueness" },
  { id: "evaluating_improvement", label: "Evaluating improvement" },
  { id: "saving", label: "Saving content" },
];

const progressMap = new Map<string, { stages: RegenStage[]; updatedAt: number }>();

function cloneDefaultStages(): RegenStage[] {
  return DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" as RegenStageStatus }));
}

export function initItemProgress(itemId: string): RegenStage[] {
  const stages = cloneDefaultStages();
  progressMap.set(itemId, { stages, updatedAt: Date.now() });
  return stages;
}

export function setItemStage(itemId: string, stageId: RegenStageId, status: RegenStageStatus): void {
  let entry = progressMap.get(itemId);
  if (!entry) {
    entry = { stages: cloneDefaultStages(), updatedAt: Date.now() };
    progressMap.set(itemId, entry);
  }

  const idx = entry.stages.findIndex((s) => s.id === stageId);
  if (idx >= 0) {
    entry.stages[idx]!.status = status;
    if (status === "running") {
      for (let i = 0; i < idx; i++) {
        if (entry.stages[i]!.status === "pending") entry.stages[i]!.status = "complete";
      }
    }
  }
  entry.updatedAt = Date.now();
}

export function completeItemProgress(itemId: string, saved: boolean): RegenStage[] {
  const entry = progressMap.get(itemId) ?? { stages: cloneDefaultStages(), updatedAt: Date.now() };
  for (const stage of entry.stages) {
    if (stage.status === "pending" || stage.status === "running") {
      stage.status = "skipped";
    }
  }
  entry.stages.push({
    id: saved ? "saving" : "discarding",
    label: saved ? "Saved automatically" : "Discarded — no improvement",
    status: "complete",
  });
  entry.stages.push({ id: "complete", label: "Complete", status: "complete" });
  entry.updatedAt = Date.now();
  progressMap.set(itemId, entry);
  return entry.stages;
}

export function getItemProgress(itemId: string): RegenStage[] | null {
  return progressMap.get(itemId)?.stages ?? null;
}

export function clearItemProgress(itemId: string): void {
  progressMap.delete(itemId);
}

export function clearAllItemProgress(): void {
  progressMap.clear();
}
