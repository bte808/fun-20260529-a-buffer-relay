export const TOKENS = {
  spark: {
    id: "spark",
    label: "Spark",
    short: "SP",
    color: "#ff6b7a",
    ink: "#2d060b"
  },
  pulse: {
    id: "pulse",
    label: "Pulse",
    short: "PU",
    color: "#64d2c8",
    ink: "#042421"
  },
  gate: {
    id: "gate",
    label: "Gate",
    short: "GA",
    color: "#f7c948",
    ink: "#2b2100"
  },
  echo: {
    id: "echo",
    label: "Echo",
    short: "EC",
    color: "#9b8cff",
    ink: "#120b3a"
  },
  flux: {
    id: "flux",
    label: "Flux",
    short: "FL",
    color: "#7ed957",
    ink: "#0d2505"
  }
};

export const LEVELS = [
  {
    id: "warm-cache",
    name: "Warm Cache",
    stream: ["spark", "pulse"],
    target: ["pulse", "spark"],
    par: 4,
    tip: "Load both packets first, then emit the newer one before the older one."
  },
  {
    id: "double-flip",
    name: "Double Flip",
    stream: ["pulse", "gate", "echo", "spark"],
    target: ["gate", "pulse", "spark", "echo"],
    par: 8,
    tip: "The target is hiding in two reversed pairs."
  },
  {
    id: "tiny-mlp",
    name: "Tiny MLP",
    stream: ["echo", "flux", "spark", "gate", "pulse", "echo"],
    target: ["flux", "echo", "gate", "spark", "echo", "pulse"],
    par: 12,
    tip: "Treat each two-packet window like a tiny reusable memory layer."
  },
  {
    id: "radio-burst",
    name: "Radio Burst",
    stream: ["gate", "spark", "flux", "pulse", "echo", "gate"],
    target: ["spark", "gate", "pulse", "flux", "gate", "echo"],
    par: 12,
    tip: "Wait for both packets in a pair before you transmit."
  },
  {
    id: "relay-final",
    name: "Relay Final",
    stream: ["spark", "pulse", "gate", "echo", "flux", "spark", "echo", "pulse"],
    target: ["pulse", "spark", "echo", "gate", "spark", "flux", "pulse", "echo"],
    par: 16,
    tip: "Every pair can be flipped cleanly if neither slot is overwritten."
  }
];

export function getShanghaiDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

export function getBestScoreKey(seedText = getShanghaiDateKey()) {
  return `buffer-relay:best:${seedText}`;
}

export function createGame(options = {}) {
  return {
    status: "ready",
    seedText: options.seedText || getShanghaiDateKey(),
    levelIndex: options.levelIndex || 0,
    cursor: 0,
    targetIndex: 0,
    slots: [null, null],
    moves: 0,
    drops: 0,
    glitches: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    completedLevels: 0,
    lastEvent: "Press Start Relay, then keep only two packets alive.",
    timeline: []
  };
}

export function currentLevel(game) {
  return LEVELS[game.levelIndex];
}

export function currentPacket(game) {
  const level = currentLevel(game);
  return level.stream[game.cursor] || null;
}

export function nextTarget(game) {
  const level = currentLevel(game);
  return level.target[game.targetIndex] || null;
}

export function startGame(game) {
  if (game.status === "ready" || game.status === "lost" || game.status === "won") {
    resetRun(game);
  }

  game.status = "running";
  game.lastEvent = "Relay armed. Store the first packet in Slot A or Slot B.";
  return game;
}

export function resetRun(game) {
  game.status = "ready";
  game.levelIndex = 0;
  game.completedLevels = 0;
  game.score = 0;
  resetLevelState(game);
  game.lastEvent = "Fresh relay loaded. Press Start Relay.";
  return game;
}

export function resetLevel(game) {
  resetLevelState(game);
  game.status = "running";
  game.lastEvent = `${currentLevel(game).name} restarted.`;
  return game;
}

export function nextLevel(game) {
  if (game.status !== "level-complete") {
    return false;
  }

  game.levelIndex += 1;
  if (game.levelIndex >= LEVELS.length) {
    game.status = "won";
    game.levelIndex = LEVELS.length - 1;
    game.lastEvent = "All relays are stable. Final score locked.";
    return true;
  }

  resetLevelState(game);
  game.status = "running";
  game.lastEvent = `${currentLevel(game).name} online.`;
  return true;
}

export function putPacket(game, slotIndex) {
  if (!canAct(game) || !isSlot(slotIndex)) {
    return false;
  }

  const packet = currentPacket(game);
  if (!packet) {
    game.lastEvent = "No packet is waiting on the input belt.";
    return false;
  }

  const previous = game.slots[slotIndex];
  if (previous) {
    game.drops += 1;
    game.combo = 0;
    game.score = Math.max(0, game.score - 25);
    pushEvent(game, `Dropped ${tokenLabel(previous)} from Slot ${slotName(slotIndex)}.`);
  }

  game.slots[slotIndex] = packet;
  game.cursor += 1;
  game.moves += 1;
  game.score += 6;
  game.lastEvent = `${tokenLabel(packet)} loaded into Slot ${slotName(slotIndex)}.`;
  pushEvent(game, game.lastEvent);
  updateFailureState(game);
  return true;
}

export function emitSlot(game, slotIndex) {
  if (!canAct(game) || !isSlot(slotIndex)) {
    return false;
  }

  const packet = game.slots[slotIndex];
  if (!packet) {
    game.lastEvent = `Slot ${slotName(slotIndex)} is empty.`;
    return false;
  }

  const expected = nextTarget(game);
  game.slots[slotIndex] = null;
  game.moves += 1;

  if (packet === expected) {
    game.targetIndex += 1;
    game.combo += 1;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    const parBonus = Math.max(0, currentLevel(game).par - game.moves + 1) * 4;
    game.score += 100 + game.combo * 12 + parBonus;
    game.lastEvent = `${tokenLabel(packet)} matched the target. Combo ${game.combo}.`;
    pushEvent(game, game.lastEvent);
    if (game.targetIndex >= currentLevel(game).target.length) {
      finishLevel(game);
    }
  } else {
    game.glitches += 1;
    game.combo = 0;
    game.score = Math.max(0, game.score - 45);
    game.lastEvent = `${tokenLabel(packet)} was sent, but target wanted ${tokenLabel(expected)}.`;
    pushEvent(game, game.lastEvent);
    updateFailureState(game);
  }

  return true;
}

export function getProgress(game) {
  const level = currentLevel(game);
  return {
    levelNumber: game.levelIndex + 1,
    levelCount: LEVELS.length,
    levelName: level.name,
    cursor: game.cursor,
    streamTotal: level.stream.length,
    targetIndex: game.targetIndex,
    targetTotal: level.target.length,
    moves: game.moves,
    par: level.par,
    score: game.score,
    status: game.status
  };
}

export function buildShareText(game, options = {}) {
  const result =
    game.status === "won"
      ? "stable"
      : game.status === "level-complete"
        ? "level stable"
        : game.status === "lost"
          ? "desynced"
          : "in progress";

  const lines = [
    `Buffer Relay ${game.seedText}`,
    `${result} - ${game.score} pts`,
    `${game.completedLevels}/${LEVELS.length} relays cleared`,
    `${game.moves} moves, ${game.drops} drops, ${game.glitches} glitches, best combo ${game.bestCombo}`
  ];

  if (Number.isFinite(options.bestScore) && options.bestScore > 0) {
    lines.push(`Best today: ${options.bestScore} pts`);
  }

  return lines.join("\n");
}

export function findSolution(level) {
  const start = {
    cursor: 0,
    targetIndex: 0,
    slots: [null, null],
    actions: []
  };
  const queue = [start];
  const visited = new Set([stateKey(start)]);
  const maxActions = level.stream.length * 3 + level.target.length * 2;

  while (queue.length) {
    const state = queue.shift();
    if (state.targetIndex >= level.target.length) {
      return state.actions;
    }

    if (state.actions.length > maxActions) {
      continue;
    }

    const nextStates = [];
    if (state.cursor < level.stream.length) {
      for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
        const slots = state.slots.slice();
        slots[slotIndex] = level.stream[state.cursor];
        nextStates.push({
          cursor: state.cursor + 1,
          targetIndex: state.targetIndex,
          slots,
          actions: state.actions.concat({ type: "put", slotIndex })
        });
      }
    }

    const expected = level.target[state.targetIndex];
    for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
      if (state.slots[slotIndex] === expected) {
        const slots = state.slots.slice();
        slots[slotIndex] = null;
        nextStates.push({
          cursor: state.cursor,
          targetIndex: state.targetIndex + 1,
          slots,
          actions: state.actions.concat({ type: "emit", slotIndex })
        });
      }
    }

    for (const next of nextStates) {
      const key = stateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return null;
}

export function playSolution(levelIndex) {
  const game = createGame({ levelIndex });
  game.status = "running";
  const solution = findSolution(currentLevel(game));
  if (!solution) {
    return { game, solution: null };
  }

  for (const action of solution) {
    if (action.type === "put") {
      putPacket(game, action.slotIndex);
    } else {
      emitSlot(game, action.slotIndex);
    }
  }

  return { game, solution };
}

function resetLevelState(game) {
  game.cursor = 0;
  game.targetIndex = 0;
  game.slots = [null, null];
  game.moves = 0;
  game.drops = 0;
  game.glitches = 0;
  game.combo = 0;
  game.timeline = [];
}

function canAct(game) {
  return game.status === "running";
}

function finishLevel(game) {
  const level = currentLevel(game);
  const moveBonus = Math.max(0, level.par - game.moves) * 25;
  const cleanBonus = game.drops === 0 && game.glitches === 0 ? 150 : 0;
  game.score += 200 + moveBonus + cleanBonus;
  game.completedLevels = Math.max(game.completedLevels, game.levelIndex + 1);
  game.status = game.levelIndex === LEVELS.length - 1 ? "won" : "level-complete";
  game.lastEvent =
    game.status === "won"
      ? "Final relay stable. You cleared the whole board."
      : `${level.name} stable. Continue to the next relay.`;
  pushEvent(game, game.lastEvent);
}

function updateFailureState(game) {
  if (game.status !== "running") {
    return;
  }

  if (canCompleteFromGame(game)) {
    return;
  }

  game.status = "lost";
  game.lastEvent = "Relay desynced. The remaining target cannot be recovered.";
  pushEvent(game, game.lastEvent);
}

function canCompleteFromGame(game) {
  const level = currentLevel(game);
  const start = {
    cursor: game.cursor,
    targetIndex: game.targetIndex,
    slots: game.slots.slice(),
    actions: []
  };
  const queue = [start];
  const visited = new Set([stateKey(start)]);
  const maxActions = (level.stream.length - game.cursor) * 3 + (level.target.length - game.targetIndex) * 2;

  while (queue.length) {
    const state = queue.shift();
    if (state.targetIndex >= level.target.length) {
      return true;
    }

    if (state.actions.length > maxActions) {
      continue;
    }

    const nextStates = [];
    if (state.cursor < level.stream.length) {
      for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
        const slots = state.slots.slice();
        slots[slotIndex] = level.stream[state.cursor];
        nextStates.push({
          cursor: state.cursor + 1,
          targetIndex: state.targetIndex,
          slots,
          actions: state.actions.concat({ type: "put", slotIndex })
        });
      }
    }

    const expected = level.target[state.targetIndex];
    for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
      if (state.slots[slotIndex] === expected) {
        const slots = state.slots.slice();
        slots[slotIndex] = null;
        nextStates.push({
          cursor: state.cursor,
          targetIndex: state.targetIndex + 1,
          slots,
          actions: state.actions.concat({ type: "emit", slotIndex })
        });
      }
    }

    for (const next of nextStates) {
      const key = stateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return false;
}

function pushEvent(game, message) {
  game.timeline = game.timeline.concat(message).slice(-6);
}

function stateKey(state) {
  return `${state.cursor}|${state.targetIndex}|${state.slots[0] || "_"}|${state.slots[1] || "_"}`;
}

function isSlot(slotIndex) {
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < 2;
}

function slotName(slotIndex) {
  return slotIndex === 0 ? "A" : "B";
}

export function tokenLabel(tokenId) {
  return tokenId && TOKENS[tokenId] ? TOKENS[tokenId].label : "none";
}
