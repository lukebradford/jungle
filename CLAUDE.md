# Jungle

Jungle is an experiment in agentic web design: a public website (live at https://lukebradford.github.io/jungle/, repo `lukebradford/jungle`) that started out blank and is grown entirely by agent sessions run in this directory. The original brief is in `spec.txt`.

## When the user types "Continue"

This is the core loop. You have full creative ownership of the site; the user will not tell you what to build.

1. **Orient.**
   - Read `VISION.md`, the most recent entries in `site/changes.json`, and `git log --oneline -15`.
   - Look at the site as a visitor would. Serve it with `python3 -m http.server 8000 -d site` (in the background) and view it in a browser if browser tools are available, at desktop and mobile widths, including the History and About pages. Otherwise read the source carefully.
   - Check the latest deploy succeeded: `gh run list --limit 3`. If it failed, fixing that comes first.
2. **Ask yourself**, honestly and specifically about what is actually there:
   > What can I do to make this website more beautiful, detailed, compelling, engaging, polished, unique, performant, clear, user-friendly, easy to navigate, easy to use, subtle, surprising, mobile-friendly, reliable, secure, accessible, cohesive, functional, well designed, and technically impressive? What are the bugs I can identify and fix? What would draw more people in to increase the reach of the site? What is my vision for the future of this project?
3. **Decide** on one or more specific, contained sets of changes. Each set should be something a visitor could notice and describe in a sentence. Prefer one excellent change over several shallow ones. Fix real bugs you found before adding new things.
4. **Implement** the first set. Verify it in the browser (desktop and mobile, light and dark if relevant, keyboard navigation, no console errors, no broken links, snapshot pages still work under `site/v/`).
5. **Update `VISION.md`** if your thinking about where the site is going has changed. It is your memory between sessions: keep it current, short, and opinionated.
6. **Publish** the set:
   ```
   node tools/publish.mjs --title "Short title" --summary "One or two sentences, written for visitors, on what changed and why." \
     --detail "Specific change" --detail "Another specific change" --co-author "<your model name> <noreply@anthropic.com>"
   ```
   This checks invariants, appends to `site/changes.json`, renders the History page, snapshots the site into `site/v/<id>/`, commits everything, and pushes. GitHub Actions then deploys `site/` to GitHub Pages.
7. Repeat steps 4–6 for any further sets. Each set becomes its own History entry.
8. **Confirm the deploy**: `gh run watch` on the latest run, then fetch the live URL to confirm the change is there.
9. **Report** to the user in a few lines: what you changed, why, and the live link.

## Invariants

- **Persistent controls.** Every page has "History" and "About" in the top left, History above About, inside an element with the `data-persistent-controls` attribute. Their look can evolve; their presence, order, and position cannot. `publish.mjs` refuses to publish if they are missing.
- **About** stays a brief description of how the project works for a general audience, without technical mechanics (no mention of git, scripts, hosting, models, or this file).
- **History** is generated. Never edit `site/changes.json`, the region between `<!-- changes:start -->` and `<!-- changes:end -->` in `site/history/index.html`, or anything under `site/v/` by hand. To change how entries render, edit `renderEntry` in `tools/publish.mjs`; the page around the markers is yours to design. Past entries are a permanent record: don't rewrite them.
- **Static and relative.** `site/` is deployed as-is: plain HTML, CSS, and JS with no build step. All internal links and asset paths must be relative (no leading `/`), because the site is served from a subpath and every snapshot is a copy of the site at `v/<id>/`. Vendor any dependencies into `site/`; don't load third-party scripts, fonts, trackers, or analytics from other origins.
- **Lean.** Every publish copies the whole site into a snapshot, so keep assets small: prefer SVG, CSS, and code over large images, and compress anything binary.
- **Honest.** No fabricated testimonials, stats, people, or claims. Content can be invented as art or fiction, but never presented as fact.

## Taste

- The site began as nothing. Let it grow like something alive: each change should build on what is there and make the whole more coherent, not bolt on an unrelated feature.
- Develop a distinct identity. Avoid the generic look of AI-generated landing pages: no hero-plus-three-cards, no stock gradients, no buzzwords.
- Subtlety and craft over volume. Details, motion, typography, and small surprises matter.
- Performance and accessibility are part of the design, not afterthoughts: semantic HTML, real contrast, `prefers-reduced-motion`, fast first paint.

## Layout

- `site/` — the deployed website. `index.html` (home), `about/`, `history/`, `style.css`, `changes.json`, and `v/<id>/` snapshots.
- `tools/publish.mjs` — records and publishes a change.
- `VISION.md` — the agent's evolving vision for the site.
- `.github/workflows/deploy.yml` — deploys `site/` to GitHub Pages on every push to `main`.
