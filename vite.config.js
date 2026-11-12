import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { renderBrowser, version, formatDate } from "./src/releases.js";

// Writes the release notes into the page at build time, so they read without script
// and search engines see them. main.js later adds anything published since.
function releaseNotes() {
  return {
    name: "zeus-release-notes",
    transformIndexHtml(html) {
      const releases = JSON.parse(readFileSync(new URL("./src/releases.json", import.meta.url), "utf8"));
      const latest = releases[0];
      return html
        .replace("<!--releases-->", renderBrowser(releases))
        .replaceAll("%LATEST_VERSION%", version(latest.tag))
        .replaceAll("%LATEST_DATE%", formatDate(latest.date))
        .replaceAll("%LATEST_DATE_ISO%", latest.date)
        .replaceAll("%RELEASE_COUNT%", String(releases.length));
    },
  };
}

export default defineConfig({
  plugins: [releaseNotes()],
  build: { chunkSizeWarningLimit: 900 },
});
