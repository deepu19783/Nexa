import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const output = resolve(root, "dist");
const publicFiles = [
  "index.html",
  "login.html",
  "signup.html",
  "reset-password.html",
  "assets",
  "css",
  "js",
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of publicFiles) {
  cpSync(resolve(root, entry), resolve(output, entry), { recursive: true });
}

console.log(`Static site built in ${output}`);
