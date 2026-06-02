"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { BRAND_ASSETS, BRAND_COLORS } from "@/lib/brand";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: BRAND_COLORS.darkBg,
          color: "#F5F5F7",
          padding: "24px",
        }}>
          <img
            src={BRAND_ASSETS.logoIconDark}
            alt="SecretZa"
            width={48}
            height={48}
            style={{ borderRadius: "12px", marginBottom: "16px" }}
          />
          <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>Something went wrong</h1>
          <p style={{ color: "#A1A1AA", marginBottom: "24px" }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: BRAND_COLORS.gradient,
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            Go Home
          </a>
        </div>
      </body>
    </html>
  );
}
