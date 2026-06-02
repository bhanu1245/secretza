import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

let count = 0;
for (const file of walk(SRC)) {
  const content = readFileSync(file, "utf8");
  if (/\bSecretza\b/.test(content)) {
    writeFileSync(file, content.replace(/\bSecretza\b/g, "SecretZa"), "utf8");
    count++;
    console.log("updated:", path.relative(process.cwd(), file));
  }
}
console.log(`Done. ${count} files updated.`);
