import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const trackedFilesRaw = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
});

const trackedFiles = trackedFilesRaw
  .split("\u0000")
  .map((item) => item.trim())
  .filter(Boolean);

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".zip",
  ".jar",
  ".ttf",
  ".woff",
  ".woff2",
  ".pdf",
  ".mp4",
  ".webm",
]);

const signatureRules = [
  { name: "OpenAI key", pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: "GitHub personal token", pattern: /ghp_[A-Za-z0-9]{20,}/g },
  { name: "Google API key", pattern: /AIza[0-9A-Za-z\-_]{20,}/g },
  { name: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g },
  { name: "OAuth bearer token", pattern: /ya29\.[A-Za-z0-9\-_]+/g },
  { name: "Private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

const problems = [];

for (const file of trackedFiles) {
  const normalizedFile = file.replace(/\\/g, "/");

  if (/(^|\/)\.env($|[^/])/.test(normalizedFile) && !normalizedFile.endsWith(".env.example")) {
    problems.push(`${file}: tracked env file detected (store runtime env locally, not in git).`);
    continue;
  }

  if (binaryExtensions.has(path.extname(file).toLowerCase())) {
    continue;
  }

  const absolutePath = path.join(repoRoot, file);
  let content = "";

  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  for (const rule of signatureRules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) {
      problems.push(`${file}: possible ${rule.name}.`);
      break;
    }
  }
}

if (problems.length > 0) {
  console.error("Secret scan failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed for ${trackedFiles.length} tracked files.`);
