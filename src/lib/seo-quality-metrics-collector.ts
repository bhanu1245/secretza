/**
 * SEO Quality Engine — Metrics Collector (Orchestrator)
 *
 * Purpose:
 *   Orchestrates the provider wave pipeline to produce a single immutable
 *   QualityMetrics snapshot from raw page content.
 *
 * Responsibilities:
 *   - Execute registered MetricsProvider instances in wave order
 *   - Merge partial metric outputs into one complete QualityMetrics object
 *   - Enforce provider dependency ordering via executionOrder waves
 *   - Emit timing events to the QualityObserver
 *
 * Extension points:
 *   - Register new providers via the providers array in QualityEngineConfig
 *   - No collector logic changes are needed when a provider is added
 *   - Providers declare their own executionOrder; the collector groups and runs them
 *
 * Thread safety:
 *   SeoMetricsCollector holds no mutable state between calls.
 *   The L1 request-scoped cache is local to each collect() invocation.
 *
 * Usage notes:
 *   This class is NOT yet connected to the production flow.
 *   collect() throws NotImplementedError until Phase 2B provider implementation.
 *   Do not call collect() from production code until Phase 2B is complete.
 */

import type {
  MetricsCollectorInput,
  QualityMetrics,
  MetricsProvider,
  QualityObserver,
} from "@/lib/seo-quality-types";

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`SeoMetricsCollector.${method}() is not yet implemented. Requires Phase 2B providers.`);
    this.name = "NotImplementedError";
  }
}

export class SeoMetricsCollector {
  private readonly providers: MetricsProvider[];
  private readonly observer: QualityObserver;

  constructor(providers: MetricsProvider[], observer: QualityObserver) {
    this.providers = [...providers].sort((a, b) => a.executionOrder - b.executionOrder);
    this.observer = observer;
  }

  /**
   * Collect all QualityMetrics from the given input by running registered providers
   * in wave order.
   *
   * NOT YET IMPLEMENTED — throws NotImplementedError.
   * Will be implemented in Phase 2B when providers are built.
   *
   * @throws {NotImplementedError}
   */
  collect(_input: MetricsCollectorInput): QualityMetrics {
    this.observer.onEvent("QE_METRICS_COLLECT_CALLED", {
      status: "not_implemented",
      providerCount: this.providers.length,
    });
    throw new NotImplementedError("collect");
  }
}
