/**
 * Auto Improve — chains partial optimizations until uniqueness target met.
 */
import { db } from "@/lib/db";
import { applyStudioOptimize, type StudioOptimizeAction } from "@/lib/seo-studio-optimize";
import { UNIQUENESS_PREFERRED } from "@/lib/seo-regen-save-policy";
import {
  completeItemProgress,
  initItemProgress,
  setItemStage,
} from "@/lib/seo-regen-progress";

const AUTO_IMPROVE_ACTIONS: StudioOptimizeAction[] = [
  "rewrite_intro",
  "reduce_repetition",
  "keyword_density",
];

const MAX_AUTO_IMPROVE_ROUNDS = 5;

export async function runAutoImprove(input: {
  seoPageId: string;
  pageType: string;
  pageSlug: string;
  runId: string;
  itemId: string;
  createdBy?: { id: string; email: string };
  targetUniqueness?: number;
}) {
  const target = input.targetUniqueness ?? UNIQUENESS_PREFERRED;
  initItemProgress(input.itemId);

  const page = await db.seoPage.findUnique({
    where: { id: input.seoPageId },
    select: { uniquenessScore: true, seoQualityScore: true },
  });
  const startUnique = page?.uniquenessScore ?? 0;
  const startSeo = page?.seoQualityScore ?? 0;

  let currentUnique = startUnique;
  let currentSeo = startSeo;
  let lastRollbackId: string | null = null;
  const stepsApplied: string[] = [];

  for (let round = 0; round < MAX_AUTO_IMPROVE_ROUNDS; round++) {
    if (currentUnique >= target) break;

    for (const action of AUTO_IMPROVE_ACTIONS) {
      if (currentUnique >= target) break;

      const stageMap: Record<StudioOptimizeAction, Parameters<typeof setItemStage>[1]> = {
        rewrite_intro: "generating_intro",
        reduce_repetition: "rewriting_duplicates",
        keyword_density: "optimizing_keywords",
      };
      setItemStage(input.itemId, stageMap[action], "running");

      const result = await applyStudioOptimize({
        seoPageId: input.seoPageId,
        pageType: input.pageType,
        pageSlug: input.pageSlug,
        action,
        runId: input.runId,
        createdBy: input.createdBy,
      });

      setItemStage(input.itemId, stageMap[action], "complete");

      if (result.unchanged) continue;

      stepsApplied.push(action);
      if (result.rollbackVersionId) lastRollbackId = result.rollbackVersionId;

      const afterU = result.after.uniqueness ?? currentUnique;
      const afterS = result.after.seoScore ?? currentSeo;
      currentUnique = afterU;
      currentSeo = afterS;
    }

    setItemStage(input.itemId, "calculating_scores", "running");
    setItemStage(input.itemId, "calculating_scores", "complete");
  }

  const improved = currentUnique > startUnique || currentSeo > startSeo;
  completeItemProgress(input.itemId, improved);

  return {
    success: true,
    startUnique,
    startSeo,
    currentUnique,
    currentSeo,
    target,
    metTarget: currentUnique >= target,
    stepsApplied,
    rollbackVersionId: lastRollbackId,
    improved,
  };
}
