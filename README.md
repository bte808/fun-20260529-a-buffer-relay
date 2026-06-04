# Buffer Relay

Buffer Relay is a tiny browser puzzle about routing a packet stream through only two memory slots.
Store incoming packets, emit the right slot, and match the target output before the relay desyncs.

Public demo: https://bte808.github.io/fun-20260529-a-buffer-relay/

## What it can do

- Presents five short relay puzzles with a clear start -> store/emit -> feedback -> score loop.
- Runs as a dependency-free static page: HTML, CSS, and vanilla JavaScript.
- Uses a testable game engine with deterministic levels and a tiny solver check.
- Works with mouse, touch, and keyboard controls.
- Copies a date-scoped challenge link such as `?date=2026-05-29` so another player can replay the same run label.
- Provides a compact share text for the final score, local best, and challenge URL.
- Saves the best completed score for each challenge date in local browser storage.

## Why it is useful

It turns an abstract systems idea into a quick tactile challenge. The game makes limited memory feel concrete:
you only have two slots, and every overwrite can make the target sequence impossible.

## Why it is fun

The puzzles are small enough to learn in one round but still reward planning. Clean pair flips build combo points,
wrong emits create glitches, and perfect runs feel like snapping a tiny packet machine into sync.

## Why it is worth starring

- It is a complete no-build browser toy that can be inspected, forked, and hosted as-is.
- The rules are compact but teach a real constraint: two live buffers are enough only when you plan the emit order.
- Challenge links and local-best storage make it easy to compare clean runs without accounts, servers, or tracking.

## 2026-06-04 Maintenance Update

This pass makes Buffer Relay public-demo ready: date-scoped `?date=YYYY-MM-DD` links load the same challenge label, `Copy challenge` shares the replay URL without exposing a solution path, final share text includes the challenge URL and seed-scoped best score, and the repo now points visitors to the GitHub Pages demo.

## Inspiration

The idea was inspired by public browsing on 2026-05-29:

- Show HN had a static-allocation MLP inference project using a two-slot ring buffer:
  https://news.ycombinator.com/item?id=48318304
- Recent GitHub search results showed continued interest in zero-dependency browser games and canvas toys,
  including small JavaScript game projects created in late May 2026.

Only the general concept of "small memory, visible interaction" was borrowed. The code, design, levels, and copy here
are original.

## Core gameplay

1. Press `Start Relay`.
2. Store the current input packet into Slot A or Slot B.
3. Emit a slot when it matches the next target packet.
4. Clear all target packets with as few drops and glitches as possible.

Keyboard shortcuts:

- `1`: store current packet in Slot A
- `2`: store current packet in Slot B
- `Q`: emit Slot A
- `W`: emit Slot B
- `Enter`: start or advance
- `R`: retry the current level

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:5209
```

To replay a labeled challenge date, open:

```text
http://localhost:5209/?date=2026-05-29
```

You can also open `index.html` directly in a modern browser.

## Validation

```bash
npm run check
npm test
```

The smoke test verifies the Asia/Shanghai date helper, every level's two-slot solvability, core actions, failure
handling, scoring, challenge links, and share text.

## Later ideas

- Add a daily generated relay after the five hand-built levels.
- Add a ghost replay that shows the par solution after a failed attempt.
- Add an optional timed arcade mode.
