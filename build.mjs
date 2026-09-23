// Builds dist/index.html: one card per repo in the org tagged with the
// `most-app` topic that has GitHub Pages turned on. Each card's name, blurb,
// icon and colour come from the app's own deployed page (<title>, meta
// description, favicon, theme-color), plus an optional app-card.png screenshot.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ORG = process.env.ORG ?? "most-apps";
const TOPIC = "most-app";
const token = process.env.GITHUB_TOKEN;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.json();
}

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function attrs(tag) {
  const out = {};
  for (const [, k, v] of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[k.toLowerCase()] = decode(v);
  return out;
}

function readMeta(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gis)].map((m) => attrs(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gis)].map((m) => attrs(m[0]));
  const meta = (name) => metas.find((m) => m.name === name || m.property === name)?.content;
  return {
    title: decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ""),
    description: meta("description") ?? meta("og:description"),
    themeColor: meta("theme-color"),
    icon:
      links.find((l) => l.rel === "apple-touch-icon")?.href ??
      links.find((l) => l.rel?.split(/\s+/).includes("icon"))?.href,
  };
}

// Same-origin apps link by path, so the page works on any host (and in previews).
const localPath = (url) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

async function describe(repo) {
  const pages = await gh(`/repos/${ORG}/${repo.name}/pages`);
  const url = pages.html_url;
  const app = { name: repo.name, url, title: repo.name, description: repo.description ?? "" };
  try {
    const res = await fetch(url);
    const m = readMeta(await res.text());
    Object.assign(app, {
      title: m.title || app.title,
      description: m.description || app.description,
      color: /^#[0-9a-f]{3,8}$/i.test(m.themeColor ?? "") ? m.themeColor : undefined,
      icon: m.icon && new URL(m.icon, url).href,
    });
    const card = await fetch(new URL("app-card.png", url), { method: "HEAD" });
    if (card.ok && card.headers.get("content-type")?.startsWith("image/")) {
      app.screenshot = new URL("app-card.png", url).href;
    }
  } catch (err) {
    console.warn(`${repo.name}: could not read ${url} (${err.message}); using repo details`);
  }
  return app;
}

function card(app) {
  const style = app.color ? ` style="--app: ${app.color}"` : "";
  const icon = app.icon
    ? `<img class="icon" src="${esc(localPath(app.icon))}" alt="" width="56" height="56" />`
    : `<span class="icon icon-letter" aria-hidden="true">${esc(app.title[0]?.toUpperCase() ?? "?")}</span>`;
  const shot = app.screenshot
    ? `<img class="shot" src="${esc(localPath(app.screenshot))}" alt="" loading="lazy" />`
    : "";
  return `      <li>
        <a class="card" href="${esc(localPath(app.url))}"${style}>
          ${shot}
          <div class="card-body">
            ${icon}
            <div>
              <h2>${esc(app.title)}</h2>
              <p>${esc(app.description)}</p>
            </div>
          </div>
          <span class="open">Open <span aria-hidden="true">→</span></span>
        </a>
      </li>`;
}

const repos = [];
for (let page = 1; ; page++) {
  const batch = await gh(`/orgs/${ORG}/repos?per_page=100&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}
const tagged = repos.filter((r) => r.topics?.includes(TOPIC) && r.has_pages && !r.archived);
const apps = (await Promise.all(tagged.map(describe))).sort((a, b) => a.title.localeCompare(b.title));
console.log(`Listing ${apps.length} app(s): ${apps.map((a) => a.title).join(", ") || "none"}`);

const template = await readFile(new URL("./template.html", import.meta.url), "utf8");
const list = apps.length
  ? `<ul class="grid">\n${apps.map(card).join("\n")}\n    </ul>`
  : `<p class="empty">No apps yet.</p>`;
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", template.replace("<!-- APPS -->", list));
