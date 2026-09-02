// AI assistance disclosure: OpenAI Codex helped create this repository-finalization helper.
// Matheus Lira remains responsible for reviewing and submitting the final project.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const videoUrl = process.argv[2];

if (!videoUrl) {
  console.error('Usage: npm run finalize:cs50 -- "https://youtube.com/watch?v=..."');
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(videoUrl);
} catch {
  console.error("The video URL is not valid.");
  process.exit(1);
}

if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  console.error("The video URL must use HTTP or HTTPS.");
  process.exit(1);
}

const projectRoot = resolve(import.meta.dirname, "..");
const readmePath = resolve(projectRoot, "README.md");
const placeholder = "<VIDEO_URL_AFTER_RECORDING>";
const readme = readFileSync(readmePath, "utf8");

if (!readme.includes(placeholder)) {
  console.error("README.md no longer contains the expected video URL placeholder.");
  process.exit(1);
}

writeFileSync(readmePath, readme.replace(placeholder, `<${videoUrl}>`));

const run = (command, args) => {
  console.log(`\n> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit", shell: true });
};

try {
  run("npm", ["run", "lint"]);
  run("npm", ["run", "test:openfinance"]);
  run("npm", ["run", "build"]);
  run("git", ["add", "README.md"]);
  run("git", ["commit", "-m", "Add CS50 video demo URL"]);
  run("git", ["push", "origin", "main"]);
} catch (error) {
  writeFileSync(readmePath, readme);
  console.error("\nFinalization stopped. The README placeholder was restored locally.");
  process.exit(error.status ?? 1);
}

console.log("\nThe video URL is committed and published. The repository is ready for the CS50 final-project form and submit50.");
