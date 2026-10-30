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
    breeze(nodes, stems, leaves);
  }

  // Wind. Every stem segment and every leaf is a damped spring: a slow breeze leans
  // them, and a pointer passing through pushes them aside. A segment carries everything
  // that grew from it, so the tips move most and the thick old stem hardly at all.
  function breeze(nodes, stemGroup, leafGroup) {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const n = nodes.length;
    if (n < 2) return;
    const stems = [null, ...stemGroup.children];
    const leaves = [...leafGroup.children].map((a) => a.querySelector("g"));
    const parent = new Int32Array(n);
    const rest = nodes.map((d) => (d.parent ? Math.atan2(d.y - d.parent.y, d.x - d.parent.x) : 0));
    const len = nodes.map((d) => (d.parent ? Math.hypot(d.x - d.parent.x, d.y - d.parent.y) : 0));
    nodes.forEach((d, i) => {
      d.i = i;
      parent[i] = d.parent ? d.parent.i : -1;
    });
    // Bend of each stem segment and flutter of each leaf, in radians, with their velocities.
    const bend = new Float64Array(n), bendV = new Float64Array(n);
    const flut = new Float64Array(n), flutV = new Float64Array(n);
    // Where each node is now, and how far its segment has turned in all.
    const X = new Float64Array(n), Y = new Float64Array(n), turn = new Float64Array(n);
    const left = Math.min(...nodes.map((d) => d.x));

    // Stiffer segments for heavier stems; smaller leaves flutter faster.
    const stemW = nodes.map((d) => (d.parent ? 2 * Math.PI * (0.5 + (d.leafTilt - 0.8) * 0.5) : 0));
    const leafW = nodes.map((d) => (d.parent ? 2 * Math.PI * (1.2 + ((38 - d.leafLen) / 14) * 0.7) : 0));
    const give = nodes.map((d) => (d.parent ? 0.03 / Math.sqrt(d.weight) : 0));

    // A slow, uneven breeze from the left, arriving at each node a little later the further right it is.
    const gust = (t) => 0.2 + 0.45 * Math.sin(0.17 * t) + 0.3 * Math.sin(0.41 * t + 1.3) + 0.12 * Math.sin(1.07 * t + 0.4);

    function step(h, t, calm) {
      for (let i = 1; i < n; i++) {
        const tl = t - (nodes[i].x - left) / 50;
        const w = gust(tl) * calm;
        const sw = stemW[i];
        bendV[i] += (sw * sw * (w * give[i] - bend[i]) - 0.36 * sw * bendV[i]) * h;
        bend[i] = Math.max(-0.3, Math.min(0.3, bend[i] + bendV[i] * h));
        const lw = leafW[i];
        const lift = (w * 0.5 + 0.3 * Math.sin(2.1 * tl + i * 1.7) * calm) * 0.07;
        flutV[i] += (lw * lw * (lift - flut[i]) - 0.24 * lw * flutV[i]) * h;
        flut[i] = Math.max(-0.9, Math.min(0.9, flut[i] + flutV[i] * h));
      }
    }

    function place() {
      for (let i = 1; i < n; i++) {
        const p = parent[i];
        turn[i] = turn[p] + bend[i];
        const a = rest[i] + turn[i];
        X[i] = X[p] + Math.cos(a) * len[i];
        Y[i] = Y[p] + Math.sin(a) * len[i];
      }
    }

    function draw() {
      for (let i = 1; i < n; i++) {
        const d = nodes[i], p = parent[i];
        const a = d.a + turn[i] + Math.PI / 2;
        const mx = (X[p] + X[i]) / 2 + Math.cos(a) * d.bend;
        const my = (Y[p] + Y[i]) / 2 + Math.sin(a) * d.bend;
        stems[i].setAttribute("d", `M${X[p].toFixed(2)} ${Y[p].toFixed(2)}Q${mx.toFixed(2)} ${my.toFixed(2)} ${X[i].toFixed(2)} ${Y[i].toFixed(2)}`);
        const rot = ((leafAngle(d) + turn[i] + flut[i]) * 180) / Math.PI;
        leaves[i].setAttribute("transform", `translate(${X[i].toFixed(2)} ${Y[i].toFixed(2)}) rotate(${rot.toFixed(2)})`);
      }
    }

    // A pointer moving through the plant pushes whatever it passes, harder the faster it goes.
    let last = null;
    function push(e) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const prev = last;
      last = { x: pt.x, y: pt.y, t: e.timeStamp };
      if (!prev || e.timeStamp - prev.t > 120 || e.timeStamp <= prev.t) return;
      const dx = pt.x - prev.x, dy = pt.y - prev.y;
      const k = Math.min(1, Math.hypot(dx, dy) / ((e.timeStamp - prev.t) / 1000) / 400);
      const R = 36;
      for (let i = 1; i < n; i++) {
        const la = leafAngle(nodes[i]) + turn[i] + flut[i];
        const half = nodes[i].leafLen / 2;
        const dist = Math.min(
          Math.hypot(pt.x - X[i], pt.y - Y[i]),
          Math.hypot(pt.x - X[i] - Math.cos(la) * half, pt.y - Y[i] - Math.sin(la) * half)
        );
        if (dist >= R) continue;
        const f = (1 - dist / R) ** 2 * k;
        const sa = rest[i] + turn[i];
        bendV[i] += (dy * Math.cos(sa) - dx * Math.sin(sa)) * f * 0.016;
        flutV[i] += (dy * Math.cos(la) - dx * Math.sin(la)) * f * 0.07;
      }
    }

    // A leaf reached by keyboard stirs, as if touched.
    function stir(e) {
      const a = e.target.closest && e.target.closest(".leaf-link");
      const i = a ? [...leafGroup.children].indexOf(a) : -1;
      if (i > 0) flutV[i] += 2.5;
    }

    let frame = 0, start = 0, then = 0;
    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (!start) start = then = now;
      // Slow motion needs no more than about sixty frames a second.
      if (now - then < 15) return;
      const t = (now - start) / 1000;
      // The breeze rises once the plant has finished growing in.
      const calm = Math.min(1, Math.max(0, (t - 1.5) / 3));
      let dt = Math.min(0.05, (now - then) / 1000);
      then = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 120);
        step(h, t, calm);
        dt -= h;
      }
      place();
      draw();
    }

    function still() {
      cancelAnimationFrame(frame);
      frame = start = 0;
      last = null;
      bend.fill(0); bendV.fill(0); flut.fill(0); flutV.fill(0);
      place();
      draw();
      removeEventListener("pointermove", push);
      leafGroup.removeEventListener("focusin", stir);
    }

    function blow() {
      if (frame) return;
      frame = requestAnimationFrame(tick);
      addEventListener("pointermove", push, { passive: true });
      leafGroup.addEventListener("focusin", stir);
    }

    const follow = () => (motion.matches ? still() : blow());
    motion.addEventListener("change", follow);
    follow();
  }

  // Revalidate, so a returning visitor always sees the newest leaf.
  fetch("changes.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      label.textContent = "The plant could not be grown just now.";
    });
})();
