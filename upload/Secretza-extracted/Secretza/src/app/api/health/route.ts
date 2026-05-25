import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemHealth, monitorApiHealth } from "@/lib/monitoring";

/**
 * GET /api/health — Unauthenticated health check endpoint.
 *
 * Returns system health status including:
 * - Database connectivity (via a simple Prisma query)
 * - Memory usage and process uptime
 * - Overall status: healthy | degraded | unhealthy
 * - Response time measurement
 */
export async function GET() {
  const requestStart = Date.now();

  try {
    // Gather system health stats (memory, uptime, process info)
    const systemHealth = getSystemHealth();

    // Check database connectivity with a lightweight query
    let dbStatus: {
      status: "healthy" | "degraded" | "unhealthy";
      latencyMs?: number;
      error?: string;
    };

    try {
      const dbStart = Date.now();
      await db.$queryRaw`SELECT 1 as ok`;
      const dbLatency = Date.now() - dbStart;
      dbStatus = {
        status: dbLatency < 1000 ? "healthy" : "degraded",
        latencyMs: dbLatency,
      };
    } catch (err) {
      dbStatus = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Database connection failed",
      };
    }

    // Check other critical dependencies
    let dependencies: Array<{
      name: string;
      status: "healthy" | "degraded" | "unhealthy";
      latencyMs?: number;
      error?: string;
    }>;

    try {
      const depHealth = await monitorApiHealth();
      dependencies = depHealth;
    } catch {
      dependencies = [];
    }

    // Determine overall status
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (dbStatus.status === "unhealthy") {
      overallStatus = "unhealthy";
    } else if (
      dbStatus.status === "degraded" ||
      systemHealth.memory.usage > 85
    ) {
      overallStatus = "degraded";
    }

    // Check if any dependency is unhealthy
    const hasUnhealthyDep = dependencies.some(
      (d) => d.status === "unhealthy",
    );
    const hasDegradedDep = dependencies.some(
      (d) => d.status === "degraded",
    );

    if (hasUnhealthyDep && overallStatus !== "unhealthy") {
      overallStatus = "unhealthy";
    } else if (hasDegradedDep && overallStatus === "healthy") {
      overallStatus = "degraded";
    }

    const responseTime = Date.now() - requestStart;

    return NextResponse.json(
      {
        status: overallStatus,
        uptime: systemHealth.uptime,
        memory: systemHealth.memory,
        process: systemHealth.process,
        db: dbStatus,
        dependencies,
        responseTime,
        timestamp: systemHealth.timestamp,
      },
      {
        status: overallStatus === "unhealthy" ? 503 : overallStatus === "degraded" ? 200 : 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Response-Time": `${responseTime}ms`,
        },
      },
    );
  } catch (err) {
    const responseTime = Date.now() - requestStart;
    // If the health check itself fails, return unhealthy
    return NextResponse.json(
      {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Health check failed",
        responseTime,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
