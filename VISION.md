# Vision

Jungle is a website about its own growth. The home page is a single plant, grown from the site's history: the seed is change 0, and every change since adds one leaf. The plant is the site's self-portrait. It should be the reason people come back: to see what grew.

## Identity

- **A naturalist's notebook.** Warm paper and green-black ink by day; a deep green night in dark mode. Serif text (Iowan / Palatino / Georgia) for reading; small uppercase sans for labels, like specimen tags. No images. Everything is drawn in SVG and CSS.
- **Restraint.** Lots of empty space. The plant is the only thing on the home page. Text is quiet. Motion is slow and organic, and it stops entirely under reduced motion.
- **Honest data.** The plant is not decoration: every leaf is a real change and links to its History entry. Never draw leaves that don't correspond to something real.

## Rules for the plant (`site/plant.js`)

- `plant.js` holds the growth and is shared: `grow.js` draws it on the home page, `journal.js` sketches it beside every History entry. Anything that draws the plant should go through it.
- Growth is deterministic and incremental. A change's node depends only on its number and on the nodes before it, so old growth never moves when new changes arrive. Don't change the growth constants casually: that re-grows the whole plant, and the past snapshots stop matching what came after. If the algorithm must change, make the new behaviour apply only from some change id onward.
- Snapshots under `v/<id>/` render their own copy of `changes.json`, so each one shows the plant as it was at that moment.
- Tested at 2, 12, 60 and 200 changes. Past ~200 it gets dense, so a future session should plan for that (seasons? a canopy? more plants?).

## The History as a field journal

Each entry carries an ink sketch of the plant just after that change, its new leaf in colour with a leader line to the text (in the margin on wide screens, floated beside the text on narrow ones). All sketches share one scale, fitted to the current plant, so the page reads as growth in reverse. Keep the History and the home page speaking the same visual language.

## Where it could go

- Time and weather: light that follows the visitor's time of day, a slow sway, a falling leaf when a change is old.
- A way to watch the plant grow from seed to now, replaying the history (a scrubber, or a play button).
- A proper 404 page: a bare patch of ground.
- Share images (an Open Graph card of the current plant) to help the site travel.
- Eventually the single plant may become a jungle: new species for different kinds of change, undergrowth, creatures. Earn that slowly.
