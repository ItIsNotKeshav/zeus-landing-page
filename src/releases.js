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

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Releases read like the app's own chats: a list of versions on the left (avatar, name,
// preview, date, a count badge) and the open one as a conversation card on the right,
// its notes as message bubbles under day-chip headings.
function prepare(release) {
  const { summary, sections } = parseBody(release.body);
  const added = count(sections, "new");
  const fixed = count(sections, "fixed");
  return { summary: summary || FIRST_RELEASE, sections, added, fixed, v: version(release.tag), id: slug(release.tag) };
}

export function renderRow(release, { latest = false, selected = false } = {}) {
  const r = prepare(release);
  const [major, minor] = r.v.split(".");
  const badge = r.added ? `<span class="rb-badge" aria-label="${r.added} new">${r.added}</span>` : "";
  return `<button type="button" class="rb-row${selected ? " is-selected" : ""}" role="tab" id="${r.id}-tab" aria-controls="${r.id}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-tag="${escape(release.tag)}">
  <span class="rb-avatar${latest ? " is-latest" : ""}" aria-hidden="true">${major}.${minor}</span>
  <span class="rb-name">Zeus ${escape(r.v)}${latest ? ' <span class="rb-latest">Latest</span>' : ""}${release.prerelease ? ' <span class="rb-latest is-beta">Beta</span>' : ""}</span>
  <time class="rb-time" datetime="${escape(release.date)}">${shortDate(release.date)}</time>
  <span class="rb-preview">${inline(r.summary).replace(/<a [^>]*>|<\/a>/g, "")}</span>
  ${badge}
</button>`;
}

export function renderPane(release, { selected = false } = {}) {
  const r = prepare(release);
  const tally = [r.added && `${r.added} new`, r.fixed && `${r.fixed} fixed`].filter(Boolean).join(", ");
  const bubbles = r.sections
    .map((section) => {
      const chip = section.title ? `<p class="rb-chip" data-kind="${escape(section.title.toLowerCase())}">${inline(section.title)}</p>` : "";
      const items = section.blocks.flatMap((block) => (block.type === "ul" ? block.items : [block.text]));
      return chip + items.map((item) => `<p class="rb-bubble">${inline(item)}</p>`).join("");
    })
    .join("");
  return `<article class="rb-pane${selected ? " is-active" : ""}" role="tabpanel" id="${r.id}" aria-labelledby="${r.id}-tab" data-tag="${escape(release.tag)}">
  <header class="rb-head">
    <span class="rb-avatar" aria-hidden="true">${r.v.split(".").slice(0, 2).join(".")}</span>
    <div class="rb-head-text">
      <h3>Zeus ${escape(r.v)}</h3>
      <p>${formatDate(release.date)}${tally ? ` · ${tally}` : ""}</p>
    </div>
    <a class="rb-open" href="${escape(release.url)}">On GitHub</a>
  </header>
  <div class="rb-scroll" data-lenis-prevent>
    <p class="rb-bubble rb-lead">${inline(r.summary)}</p>
    ${bubbles}
  </div>
</article>`;
}

export function renderBrowser(releases) {
  const rows = releases.map((release, i) => renderRow(release, { latest: i === 0, selected: i === 0 })).join("\n");
  const panes = releases.map((release, i) => renderPane(release, { selected: i === 0 })).join("\n");
  return `<div class="rb-list" role="tablist" aria-label="Zeus releases" aria-orientation="vertical" data-lenis-prevent>
${rows}
</div>
<div class="rb-panes">
${panes}
</div>`;
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
