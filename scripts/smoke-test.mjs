import assert from "node:assert/strict";
import {
  LEVELS,
  buildChallengeUrl,
  buildShareText,
  createGame,
  emitSlot,
  getBestScoreKey,
  normalizeChallengeDate,
  findSolution,
  getShanghaiDateKey,
  getProgress,
  playSolution,
  putPacket,
  startGame
} from "../src/game.js";

assert.equal(
  getShanghaiDateKey(new Date("2026-05-28T16:30:00.000Z")),
  "2026-05-29",
  "date helper uses Asia/Shanghai"
);
assert.equal(
  getBestScoreKey("2026-05-29"),
  "buffer-relay:best:2026-05-29",
  "best-score storage key is date scoped"
);
assert.equal(normalizeChallengeDate("2026-05-29"), "2026-05-29", "valid challenge dates are accepted");
assert.equal(normalizeChallengeDate("2026-02-31", "2026-05-29"), "2026-05-29", "invalid dates fall back");
assert.equal(
  buildChallengeUrl("2026-05-29", "http://localhost:5209/?v=old#debug"),
  "http://localhost:5209/?date=2026-05-29",
  "challenge links keep only the replay date"
);

for (const level of LEVELS) {
  const solution = findSolution(level);
  assert.ok(solution, `${level.name} has a two-slot solution`);
  assert.ok(solution.length <= level.par, `${level.name} can be solved on par`);
}

const game = createGame({ seedText: "2026-05-29" });
assert.equal(game.status, "ready", "new game starts ready");
startGame(game);
assert.equal(game.status, "running", "start moves the game into running state");
assert.equal(putPacket(game, 0), true, "can store the first packet");
assert.equal(putPacket(game, 1), true, "can store the second packet");
assert.equal(emitSlot(game, 1), true, "can emit Slot B");
assert.equal(game.targetIndex, 1, "correct emit advances target");
assert.equal(emitSlot(game, 0), true, "can emit Slot A");
assert.equal(game.status, "level-complete", "first level completes");
assert.ok(game.score > 300, "a clean level gives meaningful score");

const wrong = createGame({ seedText: "2026-05-29" });
startGame(wrong);
putPacket(wrong, 0);
emitSlot(wrong, 0);
assert.equal(wrong.glitches, 1, "wrong emit counts as a glitch");
assert.equal(wrong.status, "lost", "unrecoverable wrong emit desyncs the relay");

const overwritten = createGame({ levelIndex: 1, seedText: "2026-05-29" });
startGame(overwritten);
putPacket(overwritten, 0);
putPacket(overwritten, 0);
assert.equal(overwritten.drops, 1, "overwriting a filled slot counts as a drop");

const finalRun = createGame({ seedText: "2026-05-29" });
startGame(finalRun);
for (let index = 0; index < LEVELS.length; index += 1) {
  const { game: solved, solution } = playSolution(index, { seedText: "2026-05-29" });
  assert.ok(solution.length <= LEVELS[index].par, `${LEVELS[index].name} solution stays compact`);
  assert.ok(
    solved.status === "level-complete" || solved.status === "won",
    `${LEVELS[index].name} finishes through exported actions`
  );
}

const solvedFinal = playSolution(LEVELS.length - 1, { seedText: "2026-05-29" }).game;
assert.equal(solvedFinal.status, "won", "the final level can reach the win state");

const progress = getProgress(game);
assert.equal(progress.levelName, "Warm Cache", "progress exposes level label");

const share = buildShareText(solvedFinal);
assert.match(share, /Buffer Relay 2026-05-29/);
assert.match(share, /stable/);
assert.match(share, /pts/);
const shareWithBest = buildShareText(solvedFinal, { bestScore: solvedFinal.score });
assert.match(shareWithBest, /Best today: \d+ pts/);
const shareWithChallenge = buildShareText(solvedFinal, {
  bestScore: solvedFinal.score,
  bestLabel: "Best for seed",
  challengeUrl: buildChallengeUrl("2026-05-29")
});
assert.match(shareWithChallenge, /Best for seed: \d+ pts/);
assert.match(shareWithChallenge, /Challenge: https:\/\/bte808.github.io\/fun-20260529-a-buffer-relay\/\?date=2026-05-29/);

console.log(
  "Smoke tests passed: Shanghai date, challenge links, best key, solvable levels, actions, scoring, failure, and share text."
);
