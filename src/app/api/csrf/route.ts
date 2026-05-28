import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";

/** Issue a CSRF token and set the matching HttpOnly cookie. */
export async function GET() {
  const token = generateCsrfToken();

  const response = NextResponse.json({ token });
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
  });

  return response;
}
