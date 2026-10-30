// The plant's growth, shared by the home page (grow.js) and the History (journal.js).
// Growth is deterministic and incremental: a change's node is placed using only its
// number and the nodes before it, so earlier growth never moves when new changes arrive.
// Don't change the constants here: that re-grows the whole plant.

window.JunglePlant = (function () {
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

  // A leaf lying along the x axis from its base at the origin.
  function leafPath(l) {
    const w = l * 0.36;
    return `M0 0C${l * 0.25} ${-w} ${l * 0.7} ${-w} ${l} 0C${l * 0.7} ${w} ${l * 0.25} ${w} 0 0Z`;
  }

  // The angle a node's leaf points, in radians.
  function leafAngle(n) {
    return n.a + n.side * n.leafTilt;
  }

  // The same leaf, placed on its node, in plant coordinates.
  function placedLeafPath(n) {
    const l = n.leafLen;
    const w = l * 0.36;
    const c = Math.cos(leafAngle(n));
    const s = Math.sin(leafAngle(n));
    const p = (x, y) => `${(n.x + x * c - y * s).toFixed(1)} ${(n.y + x * s + y * c).toFixed(1)}`;
    return `M${p(0, 0)}C${p(l * 0.25, -w)} ${p(l * 0.7, -w)} ${p(l, 0)}C${p(l * 0.7, w)} ${p(l * 0.25, w)} ${p(0, 0)}Z`;
  }

  // The stem from a node's parent to the node, with its slight bend.
  function stemPath(n) {
    const p = n.parent;
    const mx = (p.x + n.x) / 2 + Math.cos(n.a + Math.PI / 2) * n.bend;
    const my = (p.y + n.y) / 2 + Math.sin(n.a + Math.PI / 2) * n.bend;
    return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
  }

  // The extent of the first `count` nodes, leaves included, with room for the seed below ground.
  function bounds(nodes, count) {
    let minX = -24, maxX = 24, minY = 0;
    const maxY = 16;
    for (let i = 1; i < count; i++) {
      const n = nodes[i];
      const reach = n.leafLen + 4;
      minX = Math.min(minX, n.x - reach);
      maxX = Math.max(maxX, n.x + reach);
      minY = Math.min(minY, n.y - reach);
    }
    return { minX, maxX, minY, maxY };
  }

  return { grow, leafPath, leafAngle, placedLeafPath, stemPath, bounds };
})();
