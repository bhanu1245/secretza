import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";

const root = process.cwd();
const standaloneNext = path.join(root, ".next", "standalone", ".next");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneNext, "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(root, ".next", "standalone", "public");

if (!existsSync(staticSrc)) {
  console.warn("copy-standalone-assets: .next/static not found — skipping");
  process.exit(0);
}

mkdirSync(standaloneNext, { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
cpSync(publicSrc, publicDest, { recursive: true });
console.log("copy-standalone-assets: copied static + public into standalone output");
