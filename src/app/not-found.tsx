import Link from "next/link";

export default function NotFound() {
  return (
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
          background: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
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
