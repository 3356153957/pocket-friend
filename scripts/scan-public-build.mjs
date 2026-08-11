import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sensitiveRules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ["bearer-token", /\bbearer\s+[A-Za-z0-9._~+/=-]{20,}/i],
  ["jwt-token", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ["provider-secret", /\bsk-[A-Za-z0-9_-]{16,}\b/],
  ["demo-credential", /\bpocket2026\b/i],
  ["secret-assignment", /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ["legacy-sites-host", /\b[a-z0-9-]+\.[a-z0-9]+\.chatgpt\.site\b/i],
  ["private-service-port", /:43(?:10|11)\b/i],
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);

export function findSensitiveMatches(contents) {
  return sensitiveRules
    .filter(([, pattern]) => pattern.test(contents))
    .map(([name]) => name);
}

async function listTextFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTextFiles(root, path));
    } else if (
      textExtensions.has(extname(entry.name).toLowerCase())
      || entry.name === "_headers"
      || entry.name === "_redirects"
    ) {
      files.push(path);
    }
  }
  return files;
}

export async function scanPublicBuild(root) {
  const absoluteRoot = resolve(root);
  const files = await listTextFiles(absoluteRoot);
  const findings = [];

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const rule of findSensitiveMatches(contents)) {
      findings.push({ file: relative(absoluteRoot, file), rule });
    }
  }

  return { filesScanned: files.length, findings };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) {
    console.error("Usage: node scripts/scan-public-build.mjs <build-directory>");
    process.exitCode = 2;
  } else {
    const result = await scanPublicBuild(root);
    if (result.findings.length > 0) {
      console.error("Public build scan failed. Sensitive values are redacted:");
      for (const finding of result.findings) {
        console.error(`- ${finding.file}: ${finding.rule}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`Public build scan passed: ${result.filesScanned} text files, 0 findings.`);
    }
  }
}
