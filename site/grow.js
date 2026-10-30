// Draws the plant on the home page from the site's own history: one leaf per change.
// The growth itself lives in plant.js.

(function () {
  const figure = document.querySelector("[data-plant]");
  if (!figure) return;
  const svg = figure.querySelector("svg");
  const label = figure.querySelector("figcaption");
  const NS = "http://www.w3.org/2000/svg";
  const { grow, leafPath, leafAngle, stemPath, bounds } = window.JunglePlant;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }

  function render(changes) {
    const nodes = grow(changes.length);
    const total = nodes.length;
    const delay = (i) => ((i / Math.max(total - 1, 1)) * 1.6).toFixed(2) + "s";
    const stems = el("g", { class: "stems" }, svg);
    const leaves = el("g", { class: "leaves" }, svg);

    nodes.forEach((n, i) => {
      const change = changes[i];
      const name = `Change ${change.id}: ${change.title}`;
      const link = el("a", { href: `history/#change-${change.id}`, "aria-label": name, class: "leaf-link" }, leaves);
      link.dataset.label = `Change ${change.id} · ${change.title}`;
      if (!n.parent) {
        // The seed: change 0, just under the ground.
        el("ellipse", { cx: 0, cy: 7, rx: 6, ry: 4, class: "seed", style: `--d:0s` }, link);
        return;
      }
      el("path", {
        d: stemPath(n),
        pathLength: 1,
        class: "stem",
        style: `--d:${delay(i - 1)};--w:${(1.4 + Math.sqrt(n.weight) * 0.7).toFixed(2)}`,
      }, stems);
      const rot = (leafAngle(n) * 180) / Math.PI;
      const g = el("g", { transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)}) rotate(${rot.toFixed(1)})` }, link);
      el("path", { d: leafPath(n.leafLen), class: "leaf", style: `--h:${n.hue.toFixed(0)};--d:${delay(i)}` }, g);
      el("path", { d: `M1 0L${(n.leafLen * 0.82).toFixed(1)} 0`, class: "vein", style: `--d:${delay(i)}` }, g);
      if (i === total - 1) link.classList.add("newest");
    });

    // The ground, drawn after the bounds are known.
    const { minX, maxX, minY, maxY } = bounds(nodes, total);
    const pad = 12;
    svg.prepend(el("path", { d: `M${minX - pad} 0H${maxX + pad}`, class: "ground" }));
    const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
    svg.setAttribute("viewBox", vb.map((v) => v.toFixed(1)).join(" "));
    svg.style.setProperty("--vw", vb[2]);
    svg.style.setProperty("--vh", vb[3]);

    const latest = changes[changes.length - 1];
    const rest = `${changes.length} ${changes.length === 1 ? "change" : "changes"} · last grew ${formatDate(latest.date)}`;
    label.textContent = rest;
    const show = (e) => {
      const a = e.target.closest && e.target.closest(".leaf-link");
      if (a) label.textContent = a.dataset.label;
    };
    const reset = () => {
      label.textContent = rest;
    };
    leaves.addEventListener("pointerover", show);
    leaves.addEventListener("focusin", show);
    leaves.addEventListener("pointerleave", reset);
    leaves.addEventListener("focusout", reset);
    figure.classList.add("grown");
  }

  fetch("changes.json")
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      label.textContent = "The plant could not be grown just now.";
    });
})();
