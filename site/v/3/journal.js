// Sketches the plant beside each History entry, as it stood just after that change,
// with the leaf that change grew drawn in colour. Every sketch shares one scale, so
// scrolling down the page shrinks the plant back to its seed.

(function () {
  const entries = [...document.querySelectorAll(".change[id^='change-']")];
  if (!entries.length || !window.JunglePlant) return;
  const list = entries[0].parentElement;
  const NS = "http://www.w3.org/2000/svg";
  const { grow, placedLeafPath, leafAngle, stemPath, bounds } = window.JunglePlant;
  const PAD = 8;
  const MAX_W = 150, MAX_H = 240, MAX_SCALE = 1.5;
  // Where the leader line ends, in pixels from the sketch's top right corner:
  // just short of the text column, level with the entry's heading.
  const LEADER_X = 36, LEADER_Y = 7;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function box(nodes, count) {
    const b = bounds(nodes, count);
    return { x: b.minX - PAD, y: b.minY - PAD, w: b.maxX - b.minX + PAD * 2, h: b.maxY - b.minY + PAD * 2 };
  }

  // The plant after `count` changes, drawn at `scale` pixels per unit:
  // earlier leaves in outline, the newest in colour.
  function draw(svg, nodes, count, scale) {
    const b = box(nodes, count);
    el("path", { d: `M${b.x.toFixed(1)} 0H${(b.x + b.w).toFixed(1)}`, class: "sk-ground" }, svg);
    el("ellipse", { cx: 0, cy: 7, rx: 6, ry: 4, class: count === 1 ? "sk-seed sk-new" : "sk-seed" }, svg);
    if (count === 1) return;
    const newest = nodes[count - 1];
    let stems = "", leaves = "";
    for (let i = 1; i < count; i++) {
      stems += stemPath(nodes[i]);
      if (i < count - 1) leaves += placedLeafPath(nodes[i]);
    }
    el("path", { d: stems, class: "sk-stem" }, svg);
    if (leaves) el("path", { d: leaves, class: "sk-leaf" }, svg);
    // A leader line from the new leaf across to the entry's heading, as on a botanical plate.
    const a = leafAngle(newest);
    const at = (t) => `${(newest.x + Math.cos(a) * t).toFixed(1)} ${(newest.y + Math.sin(a) * t).toFixed(1)}`;
    const end = `${(b.x + b.w + LEADER_X / scale).toFixed(1)} ${(b.y + LEADER_Y / scale).toFixed(1)}`;
    el("path", { d: `M${at(newest.leafLen * 0.5)}L${end}`, class: "sk-leader" }, svg);
    el("path", { d: placedLeafPath(newest), class: "sk-new", style: `--h:${newest.hue.toFixed(0)}` }, svg);
    el("path", { d: `M${at(1)}L${at(newest.leafLen * 0.82)}`, class: "sk-vein" }, svg);
  }

  function sketch(changes) {
    const nodes = grow(changes.length);
    const whole = box(nodes, nodes.length);
    const scale = Math.min(MAX_SCALE, MAX_W / whole.w, MAX_H / whole.h);
    list.style.setProperty("--k", scale.toFixed(3));
    list.classList.add("sketched");

    const pending = new Map();
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((seen) => {
          for (const s of seen) {
            if (!s.isIntersecting) continue;
            observer.unobserve(s.target);
            draw(s.target, nodes, pending.get(s.target), scale);
            pending.delete(s.target);
          }
        }, { rootMargin: "800px 0px" })
      : null;

    for (const entry of entries) {
      const id = Number(entry.id.slice("change-".length));
      if (!(id >= 0 && id < nodes.length)) continue;
      const b = box(nodes, id + 1);
      const svg = el("svg", {
        class: "specimen",
        viewBox: [b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(" "),
        "aria-hidden": "true",
        focusable: "false",
      });
      entry.style.setProperty("--sw", b.w.toFixed(1));
      entry.style.setProperty("--sh", b.h.toFixed(1));
      entry.prepend(svg);
      if (observer) {
        pending.set(svg, id + 1);
        observer.observe(svg);
      } else {
        draw(svg, nodes, id + 1, scale);
      }
    }
  }

  fetch("../changes.json")
    .then((r) => r.json())
    .then(sketch)
    .catch(() => {});
})();
