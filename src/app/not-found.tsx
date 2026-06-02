import Link from "next/link";
import { BRAND_ASSETS, BRAND_COLORS } from "@/lib/brand";

export default function NotFound() {
  return (
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
        style={{ borderRadius: "12px", marginBottom: "24px" }}
      />
      <h1 style={{ fontSize: "48px", fontWeight: 700, marginBottom: "8px" }}>404</h1>
      <h2 style={{ fontSize: "20px", color: "#A1A1AA", marginBottom: "24px" }}>Page Not Found</h2>
      <p style={{ color: "#71717A", marginBottom: "32px", textAlign: "center", maxWidth: "400px" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
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
      </Link>
    </div>
  );
}
