/**
 * Schedule long-running SEO work after the HTTP response (Next.js after()).
 * Falls back to fire-and-forget when outside a request context.
 */
import { after } from "next/server";

export function scheduleSeoBackgroundWork(
  label: string,
  work: () => Promise<unknown>,
): void {
  const run = async () => {
    try {
      console.log(`SEO_BG_START ${label}`);
      await work();
      console.log(`SEO_BG_DONE ${label}`);
    } catch (err) {
      console.error(`SEO_BG_ERROR ${label}`, err);
    }
  };

  try {
    after(() => {
      void run();
    });
  } catch {
    void run();
  }
}
