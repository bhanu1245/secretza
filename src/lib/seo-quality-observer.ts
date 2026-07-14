/**
 * SEO Quality Engine — Observer / Telemetry
 *
 * Purpose:
 *   Defines the QualityObserver interface contract and provides a no-op
 *   implementation safe for use in tests, development, and any context
 *   where telemetry is not yet wired.
 *
 * Responsibilities:
 *   - Receive engine lifecycle events (QE_INITIALIZED, QE_SCORE_COMPLETE, etc.)
 *   - Receive per-metric gauge/histogram/counter values
 *   - Route to the appropriate backend (console, Prometheus, DataDog, etc.)
 *
 * Extension points:
 *   - Implement QualityObserver with a real backend and inject via QualityEngineConfig
 *   - The engine never imports a concrete observer — always receives one via DI
 *
 * Thread safety:
 *   NoOpQualityObserver is stateless and safe to share across concurrent calls.
 *
 * Usage notes:
 *   Pass NoOpQualityObserver to QualityEngineConfig.observer when telemetry
 *   is not needed. In production, replace with a real sink without touching
 *   any engine code.
 */

import type { QualityObserver } from "@/lib/seo-quality-types";

/**
 * No-operation observer.
 * All methods exist, accept any arguments, and do nothing.
 * Zero logging, zero side effects, zero allocations beyond the call frame.
 */
export class NoOpQualityObserver implements QualityObserver {
  onEvent(_event: string, _payload: Record<string, unknown>): void {
    // intentional no-op
  }

  onMetric(_name: string, _value: number, _tags: Record<string, string>): void {
    // intentional no-op
  }
}

/** Shared singleton — safe to reuse; it has no state. */
export const NO_OP_OBSERVER: QualityObserver = new NoOpQualityObserver();
