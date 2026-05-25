"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

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
          background: "#0B0B0F",
          color: "#F5F5F7",
          padding: "24px",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
            marginBottom: "16px",
          }}>
            <span style={{ color: "white", fontWeight: "bold", fontSize: "24px" }}>S</span>
          </div>
          <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>Something went wrong</h1>
          <p style={{ color: "#A1A1AA", marginBottom: "24px" }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
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
