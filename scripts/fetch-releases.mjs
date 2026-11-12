// Refreshes src/releases.json from GitHub before a build, so every deploy carries the
// newest notes. Offline or rate-limited, it keeps the file it has and the build goes on.
import { readFile, writeFile } from "node:fs/promises";
import { REPO, fromApi } from "../src/releases.js";

const file = new URL("../src/releases.json", import.meta.url);

try {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "zeus-landing-page" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const releases = (await response.json()).filter((r) => !r.draft && r.published_at).map(fromApi);
  if (!releases.length) throw new Error("no releases in the answer");
  releases.sort((a, b) => b.date.localeCompare(a.date));
  const next = `${JSON.stringify(releases, null, 2)}\n`;
  const before = await readFile(file, "utf8").catch(() => "");
  if (next !== before) await writeFile(file, next);
  console.log(`releases: ${releases.length} from GitHub, latest ${releases[0].tag}`);
} catch (error) {
  console.warn(`releases: kept src/releases.json (${error.message})`);
}
