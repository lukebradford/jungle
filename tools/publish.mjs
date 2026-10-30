#!/usr/bin/env node
// Records a change in the history, snapshots the site, commits, and pushes.
//
//   node tools/publish.mjs --title "Short title" --summary "What changed and why." \
//     [--detail "One specific change"]... [--co-author "Name <email>"] [--no-push]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const manifest = path.join(site, "changes.json");
const historyPage = path.join(site, "history", "index.html");
const START = "<!-- changes:start -->";
const END = "<!-- changes:end -->";

function parseArgs(argv) {
  const args = { details: [], push: true };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${flag} needs a value`);
      return v;
    };
    if (flag === "--title") args.title = value();
    else if (flag === "--summary") args.summary = value();
    else if (flag === "--detail") args.details.push(value());
    else if (flag === "--co-author") args.coAuthor = value();
    else if (flag === "--no-push") args.push = false;
    else fail(`Unknown argument: ${flag}`);
  }
  if (!args.title || !args.summary) fail("--title and --summary are required");
  return args;
}

function fail(message) {
  console.error(`publish: ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Every HTML file in the live site, excluding snapshots, as paths relative to site/.
function liveHtmlFiles(dir = site, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (relPath !== "v") out.push(...liveHtmlFiles(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".html")) {
      out.push(relPath);
    }
  }
  return out;
}

// The persistent controls must survive every change: History above About, on every page.
function checkInvariants() {
  const problems = [];
  for (const rel of liveHtmlFiles()) {
    if (rel === "404.html") continue;
    const html = fs.readFileSync(path.join(site, rel), "utf8");
    const nav = html.match(/<[^>]*data-persistent-controls[^>]*>([\s\S]*?)<\/nav>/);
    if (!nav) {
      problems.push(`${rel}: missing the persistent controls (data-persistent-controls)`);
      continue;
    }
    const h = nav[1].search(/>\s*History\s*</);
    const a = nav[1].search(/>\s*About\s*</);
    if (h < 0 || a < 0 || h > a) problems.push(`${rel}: persistent controls must contain History then About`);
  }
  const history = fs.readFileSync(historyPage, "utf8");
  if (!history.includes(START) || !history.includes(END)) {
    problems.push(`history/index.html: missing ${START} / ${END} markers`);
  }
  if (problems.length) fail(`invariants violated:\n  ${problems.join("\n  ")}`);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderEntry(change, latestId) {
  const live = change.id === latestId;
  const details = change.details?.length
    ? `\n        <ul>\n${change.details.map((d) => `          <li>${escapeHtml(d)}</li>`).join("\n")}\n        </ul>`
    : "";
  const link = live
    ? `<a href="../">This is the live site</a>`
    : `<a href="../v/${change.id}/">View the site as it was</a>`;
  return `      <li class="change" id="change-${change.id}" value="${change.id}">
        <h2>${escapeHtml(change.title)}</h2>
        <p class="meta">Change ${change.id} · <time datetime="${change.date}">${formatDate(change.date)}</time></p>
        <p>${escapeHtml(change.summary)}</p>${details}
        <p>${link}</p>
      </li>`;
}

function renderHistory(changes) {
  const latestId = changes.at(-1).id;
  const entries = [...changes].reverse().map((c) => renderEntry(c, latestId)).join("\n");
  const html = fs.readFileSync(historyPage, "utf8");
  const before = html.slice(0, html.indexOf(START) + START.length);
  const after = html.slice(html.indexOf(END));
  fs.writeFileSync(historyPage, `${before}\n${entries}\n${after}`);
}

// Rewrites relative links that point into v/ so they still resolve from inside a snapshot.
function rewriteSnapshotLinks(html, liveDir, snapDir) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (whole, attr, url) => {
    if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url) || url === "") return whole;
    const [, pathPart, suffix = ""] = url.match(/^([^?#]*)(.*)$/);
    const resolved = path.posix.normalize(path.posix.join(liveDir, pathPart));
    if (resolved !== "v" && !resolved.startsWith("v/")) return whole;
    let rel = path.posix.relative(snapDir, resolved) || ".";
    if (pathPart.endsWith("/") && !rel.endsWith("/")) rel += "/";
    return `${attr}="${rel}${suffix}"`;
  });
}

function snapshotBanner(change, prefix) {
  return `<div data-jungle-snapshot style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;padding:10px 16px;background:#111;color:#eee;font:13px/1.4 system-ui,-apple-system,sans-serif">
  <span>Jungle as it was after change ${change.id}: ${escapeHtml(change.title)}</span>
  <a href="${prefix}history/#change-${change.id}" style="color:inherit">History</a>
  <a href="${prefix}" style="color:inherit">Go to the live site</a>
</div>
`;
}

function snapshot(change) {
  const dest = path.join(site, "v", String(change.id));
  fs.rmSync(dest, { recursive: true, force: true });
  for (const name of fs.readdirSync(site)) {
    if (name !== "v") fs.cpSync(path.join(site, name), path.join(dest, name), { recursive: true });
  }
  for (const rel of liveHtmlFiles()) {
    const file = path.join(dest, rel);
    const liveDir = path.posix.dirname(rel);
    const snapDir = path.posix.join("v", String(change.id), liveDir);
    const prefix = "../".repeat(snapDir.split("/").length);
    let html = fs.readFileSync(file, "utf8");
    html = rewriteSnapshotLinks(html, liveDir, snapDir);
    html = html.replace(/<head>(\s*<meta charset[^>]*>)?/i, (m) => `${m}\n  <meta name="robots" content="noindex">`);
    html = html.replace(/<\/body>/i, `${snapshotBanner(change, prefix)}</body>`);
    fs.writeFileSync(file, html);
  }
}

const args = parseArgs(process.argv.slice(2));
checkInvariants();

const changes = JSON.parse(fs.readFileSync(manifest, "utf8"));
const change = {
  id: changes.length,
  date: new Date().toISOString(),
  title: args.title,
  summary: args.summary,
  details: args.details,
};
changes.push(change);
fs.writeFileSync(manifest, JSON.stringify(changes, null, 2) + "\n");
renderHistory(changes);
snapshot(change);

const message = [
  `Change ${change.id}: ${change.title}`,
  "",
  change.summary,
  ...(change.details.length ? ["", ...change.details.map((d) => `- ${d}`)] : []),
  ...(args.coAuthor ? ["", `Co-Authored-By: ${args.coAuthor}`] : []),
].join("\n");
git("add", "-A");
git("commit", "-q", "-m", message);
console.log(`Committed change ${change.id}: ${change.title}`);

if (!args.push) {
  console.log("Skipped push (--no-push).");
} else if (!git("remote")) {
  console.log("No git remote configured; skipped push.");
} else {
  execFileSync("git", ["push", "-q"], { cwd: root, stdio: "inherit" });
  console.log("Pushed. The site will redeploy in a minute or two.");
}
