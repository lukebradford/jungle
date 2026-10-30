// Grows the plant on the home page from the site's own history: one leaf per change.
// Growth is deterministic and incremental: a change's leaf is placed using only its
// number, so earlier growth never moves when new changes are added.

(function () {
  const figure = document.querySelector("[data-plant]");
  if (!figure) return;
  const svg = figure.querySelector("svg");
  const label = figure.querySelector("figcaption");
  const NS = "http://www.w3.org/2000/svg";
  const UP = -Math.PI / 2;

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function grow(count) {
    const nodes = [{ x: 0, y: 0, a: UP, depth: 0, parent: null, children: [] }];
    for (let i = 1; i < count; i++) {
      const r = rng(i);
      const tips = nodes.filter((n) => n.children.length === 0);
      let parent;
      if (i === 1) parent = nodes[0];
      else if (r() < 0.3) {
        const forks = nodes.filter((n) => n.depth >= 2 && n.children.length === 1);
        parent = forks.length ? forks[Math.floor(r() * forks.length)] : tips[tips.length - 1];
      } else {
        // Favour the most recent tips, so growth reads as a continuing reach upward.
        const k = Math.min(tips.length - 1, Math.floor(r() * r() * tips.length));
        parent = tips[tips.length - 1 - k];
      }
      let a = parent.a + (r() - 0.5) * 0.6;
      if (parent.children.length) a += (parent.children[0].a > parent.a ? -1 : 1) * (0.55 + r() * 0.35);
      a += (UP - a) * 0.22;
      a = Math.max(-Math.PI + 0.35, Math.min(-0.35, a));
      const len = 40 + r() * 16 - Math.min(parent.depth, 10);
      const node = {
        x: parent.x + Math.cos(a) * len,
        y: parent.y + Math.sin(a) * len,
        a,
        depth: parent.depth + 1,
        parent,
        children: [],
        bend: (r() - 0.5) * 14,
        side: r() < 0.5 ? -1 : 1,
        leafLen: 24 + r() * 14,
        leafTilt: 0.8 + r() * 0.5,
        hue: 92 + r() * 46,
      };
      parent.children.push(node);
      nodes.push(node);
    }
    // Stems thicken with everything that has grown from them.
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      n.weight = 1 + n.children.reduce((s, c) => s + c.weight, 0);
    }
    return nodes;
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function leafPath(l) {
    const w = l * 0.36;
    return `M0 0C${l * 0.25} ${-w} ${l * 0.7} ${-w} ${l} 0C${l * 0.7} ${w} ${l * 0.25} ${w} 0 0Z`;
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

    let minX = -24, maxX = 24, minY = 0, maxY = 16;
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
      const p = n.parent;
      const mx = (p.x + n.x) / 2 + Math.cos(n.a + Math.PI / 2) * n.bend;
      const my = (p.y + n.y) / 2 + Math.sin(n.a + Math.PI / 2) * n.bend;
      el("path", {
        d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`,
        pathLength: 1,
        class: "stem",
        style: `--d:${delay(i - 1)};--w:${(1.4 + Math.sqrt(n.weight) * 0.7).toFixed(2)}`,
      }, stems);
      const rot = ((n.a + n.side * n.leafTilt) * 180) / Math.PI;
      const g = el("g", { transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)}) rotate(${rot.toFixed(1)})` }, link);
      el("path", { d: leafPath(n.leafLen), class: "leaf", style: `--h:${n.hue.toFixed(0)};--d:${delay(i)}` }, g);
      el("path", { d: `M1 0L${(n.leafLen * 0.82).toFixed(1)} 0`, class: "vein", style: `--d:${delay(i)}` }, g);
      if (i === total - 1) link.classList.add("newest");
      const reach = n.leafLen + 4;
      minX = Math.min(minX, n.x - reach);
      maxX = Math.max(maxX, n.x + reach);
      minY = Math.min(minY, n.y - reach);
    });

    // The ground, drawn after the bounds are known.
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
