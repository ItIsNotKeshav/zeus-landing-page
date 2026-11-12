// Release notes, rendered from the GitHub release bodies (a small Markdown subset).
// The build renders them into the page (vite.config.js); in the browser, main.js uses
// the same functions to add any release published after the last deploy.

export const REPO = "ItIsNotKeshav/Zeus";

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline Markdown: code, bold, italics, links and bare URLs, on escaped text.
function inline(text) {
  const codes = [];
  let out = escape(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, lead, url) => {
      const label = url.replace(/^https:\/\/github\.com\/ItIsNotKeshav\/Zeus\//, "").replace(/^https?:\/\//, "");
      return `${lead}<a href="${url}">${label}</a>`;
    });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

// Splits a release body into its opening summary and titled sections.
export function parseBody(body) {
  const lines = (body || "").replace(/\r\n?/g, "\n").split("\n");
  const sections = [];
  let current = { title: "", blocks: [] };
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) current.blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) current.blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const item = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      sections.push(current);
      current = { title: heading[1], blocks: [] };
    } else if (item) {
      flushPara();
      (list ||= []).push(item[1]);
    } else if (!line) {
      flushPara();
      flushList();
    } else if (list) {
      list[list.length - 1] += ` ${line}`;
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();
  sections.push(current);

  const intro = sections.shift();
  const first = intro.blocks.findIndex((block) => block.type === "p" && !/^\*\*Full Changelog\*\*/.test(block.text));
  const summary = first >= 0 ? intro.blocks.splice(first, 1)[0].text : "";
  if (intro.blocks.length) sections.unshift(intro);
  return { summary, sections: sections.filter((s) => s.blocks.length) };
}

const count = (sections, title) =>
  sections.filter((s) => s.title.toLowerCase() === title).reduce((n, s) => n + s.blocks.reduce((m, b) => m + (b.items?.length || 0), 0), 0);

export const version = (tag) => tag.replace(/^v/, "");
export const slug = (tag) => `release-${version(tag).replace(/\./g, "-")}`;
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const FIRST_RELEASE = "The first Zeus release, built on ZapFast.";

export function renderRelease(release, { latest = false, open = false } = {}) {
  const { summary, sections } = parseBody(release.body);
  const id = slug(release.tag);
  const added = count(sections, "new");
  const fixed = count(sections, "fixed");
  const tally = [added && `${added} new`, fixed && `${fixed} fixed`].filter(Boolean).join(" · ");
  const body = sections
    .map((section) => {
      const blocks = section.blocks
        .map((block) =>
          block.type === "ul"
            ? `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`
            : `<p>${inline(block.text)}</p>`,
        )
        .join("");
      const title = section.title ? `<h4 class="release-kind" data-kind="${escape(section.title.toLowerCase())}">${inline(section.title)}</h4>` : "";
      return `<div class="release-section">${title}${blocks}</div>`;
    })
    .join("");
  const badges = [latest && `<span class="release-badge">Latest</span>`, release.prerelease && `<span class="release-badge is-beta">Beta</span>`]
    .filter(Boolean)
    .join("");
  return `<article class="release${open ? " is-open" : ""}" id="${id}" data-tag="${escape(release.tag)}" data-reveal>
  <h3 class="release-title">
    <button type="button" class="release-head" aria-expanded="${open}" aria-controls="${id}-notes">
      <span class="release-ver">${escape(version(release.tag))}</span>${badges}
      <time class="release-date" datetime="${escape(release.date)}">${formatDate(release.date)}</time>
      <span class="release-sum">${inline(summary || FIRST_RELEASE)}</span>
      ${tally ? `<span class="release-tally">${tally}</span>` : ""}
      <svg class="release-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </h3>
  <div class="release-notes" id="${id}-notes" role="region" aria-label="Zeus ${escape(version(release.tag))} release notes">
    <div class="release-inner">
      ${body}
      <p class="release-link"><a href="${escape(release.url)}">Downloads and full notes on GitHub</a></p>
    </div>
  </div>
</article>`;
}

export function renderReleases(releases) {
  return releases.map((release, i) => renderRelease(release, { latest: i === 0, open: i === 0 })).join("\n");
}

// The GitHub API's shape, reduced to what the page uses.
export const fromApi = (r) => ({
  tag: r.tag_name,
  name: r.name || `Zeus ${version(r.tag_name)}`,
  date: r.published_at,
  url: r.html_url,
  prerelease: Boolean(r.prerelease),
  body: r.body || "",
});
