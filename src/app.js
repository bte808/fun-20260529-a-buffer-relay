import {
  LEVELS,
  TOKENS,
  buildShareText,
  createGame,
  currentLevel,
  currentPacket,
  emitSlot,
  getBestScoreKey,
  getProgress,
  nextLevel,
  nextTarget,
  putPacket,
  resetLevel,
  resetRun,
  startGame,
  tokenLabel
} from "./game.js";

const game = createGame();

const els = {
  app: document.querySelector("#app"),
  status: document.querySelector("#status"),
  level: document.querySelector("#level"),
  score: document.querySelector("#score"),
  best: document.querySelector("#best"),
  combo: document.querySelector("#combo"),
  moves: document.querySelector("#moves"),
  message: document.querySelector("#message"),
  stream: document.querySelector("#stream"),
  target: document.querySelector("#target"),
  slots: Array.from(document.querySelectorAll("[data-slot]")),
  slotButtons: Array.from(document.querySelectorAll("[data-put]")),
  emitButtons: Array.from(document.querySelectorAll("[data-emit]")),
  start: document.querySelector("#start"),
  next: document.querySelector("#next"),
  retry: document.querySelector("#retry"),
  reset: document.querySelector("#reset"),
  hint: document.querySelector("#hint"),
  share: document.querySelector("#share"),
  shareText: document.querySelector("#share-text"),
  canvas: document.querySelector("#relay-canvas")
};

const ctx = els.canvas.getContext("2d");
let animationFrame = 0;
let hintVisible = false;
let bestScore = readBestScore(game.seedText);
let recordedWinningScore = null;

els.start.addEventListener("click", () => {
  startGame(game);
  hintVisible = false;
  recordedWinningScore = null;
  hideShareText();
  render();
});

els.next.addEventListener("click", () => {
  nextLevel(game);
  hintVisible = false;
  render();
});

els.retry.addEventListener("click", () => {
  resetLevel(game);
  hintVisible = false;
  hideShareText();
  render();
});

els.reset.addEventListener("click", () => {
  resetRun(game);
  hintVisible = false;
  recordedWinningScore = null;
  hideShareText();
  render();
});

els.hint.addEventListener("click", () => {
  hintVisible = !hintVisible;
  render();
});

els.share.addEventListener("click", async () => {
  const text = buildShareText(game, { bestScore });
  els.shareText.value = text;
  els.shareText.hidden = false;
  els.shareText.select();

  try {
    await navigator.clipboard.writeText(text);
    game.lastEvent = "Score copied to clipboard.";
  } catch {
    game.lastEvent = "Clipboard blocked. The share text is selected below.";
  }

  render();
});

for (const button of els.slotButtons) {
  button.addEventListener("click", () => {
    putPacket(game, Number(button.dataset.put));
    render();
  });
}

for (const button of els.emitButtons) {
  button.addEventListener("click", () => {
    emitSlot(game, Number(button.dataset.emit));
    render();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLTextAreaElement) {
    return;
  }

  const keyMap = {
    "1": () => putPacket(game, 0),
    "2": () => putPacket(game, 1),
    q: () => emitSlot(game, 0),
    w: () => emitSlot(game, 1),
    Enter: () => (game.status === "ready" ? startGame(game) : game.status === "level-complete" ? nextLevel(game) : null),
    r: () => resetLevel(game)
  };

  const action = keyMap[event.key];
  if (action) {
    event.preventDefault();
    action();
    render();
  }
});

function render() {
  recordBestScore();
  const progress = getProgress(game);
  const level = currentLevel(game);
  const packet = currentPacket(game);
  const expected = nextTarget(game);

  els.app.dataset.status = game.status;
  els.status.textContent = statusLabel(game.status);
  els.level.textContent = `${progress.levelNumber}/${progress.levelCount} ${progress.levelName}`;
  els.score.textContent = String(game.score);
  els.best.textContent = bestScore > 0 ? `${bestScore} pts` : "No run yet";
  els.combo.textContent = String(game.combo);
  els.moves.textContent = `${game.moves}/${level.par}`;
  els.message.textContent = hintVisible ? `${game.lastEvent} Hint: ${level.tip}` : game.lastEvent;

  renderStream(level, packet);
  renderTarget(level, expected);
  renderSlots();
  renderButtons(packet);
  renderShare();
}

function renderStream(level, packet) {
  els.stream.replaceChildren();
  level.stream.forEach((tokenId, index) => {
    const token = makeToken(tokenId, {
      active: index === game.cursor,
      spent: index < game.cursor
    });
    token.title = index === game.cursor ? "Current packet" : "Input packet";
    els.stream.append(token);
  });

  if (!packet) {
    const empty = document.createElement("span");
    empty.className = "empty-note";
    empty.textContent = "Input belt empty";
    els.stream.append(empty);
  }
}

function renderTarget(level, expected) {
  els.target.replaceChildren();
  level.target.forEach((tokenId, index) => {
    const token = makeToken(tokenId, {
      active: tokenId === expected && index === game.targetIndex,
      spent: index < game.targetIndex
    });
    token.title = index === game.targetIndex ? "Next target" : "Target packet";
    els.target.append(token);
  });
}

function renderSlots() {
  els.slots.forEach((slot, index) => {
    slot.replaceChildren();
    const tokenId = game.slots[index];
    if (tokenId) {
      slot.append(makeToken(tokenId, { large: true }));
      slot.dataset.filled = "true";
    } else {
      const empty = document.createElement("span");
      empty.className = "slot-empty";
      empty.textContent = `Slot ${index === 0 ? "A" : "B"}`;
      slot.append(empty);
      slot.dataset.filled = "false";
    }
  });
}

function renderButtons(packet) {
  const running = game.status === "running";
  const canStart = game.status === "ready" || game.status === "lost" || game.status === "won";
  els.start.hidden = !canStart;
  els.next.hidden = game.status !== "level-complete";
  els.retry.hidden = !(game.status === "lost" || game.status === "running");
  els.reset.hidden = game.status === "ready";
  els.hint.disabled = game.status === "won";
  els.share.disabled = game.score === 0;

  for (const button of els.slotButtons) {
    button.disabled = !running || !packet;
    button.querySelector(".button-token").textContent = packet ? TOKENS[packet].short : "--";
  }

  for (const button of els.emitButtons) {
    const slotIndex = Number(button.dataset.emit);
    button.disabled = !running || !game.slots[slotIndex];
    const tokenId = game.slots[slotIndex];
    button.querySelector(".button-token").textContent = tokenId ? TOKENS[tokenId].short : "--";
  }
}

function renderShare() {
  if (els.shareText.hidden) {
    return;
  }

  els.shareText.value = buildShareText(game, { bestScore });
}

function recordBestScore() {
  if (game.status !== "won" || recordedWinningScore === game.score) {
    return;
  }

  recordedWinningScore = game.score;

  if (game.score > bestScore) {
    const previous = bestScore;
    bestScore = game.score;
    const saved = writeBestScore(game.seedText, game.score);
    if (previous > 0) {
      game.lastEvent = saved
        ? `New best today: ${game.score} pts, up from ${previous}.`
        : `New best this tab: ${game.score} pts, up from ${previous}.`;
    } else {
      game.lastEvent = saved
        ? `First best today saved: ${game.score} pts.`
        : `First best this tab: ${game.score} pts.`;
    }
  } else if (game.score === bestScore && bestScore > 0) {
    game.lastEvent = `Matched today's best: ${bestScore} pts.`;
  } else if (bestScore > 0) {
    game.lastEvent = `Final relay stable. Today's best remains ${bestScore} pts.`;
  }
}

function readBestScore(seedText) {
  try {
    const score = Number(window.localStorage.getItem(getBestScoreKey(seedText)));
    return Number.isFinite(score) && score > 0 ? score : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(seedText, score) {
  try {
    window.localStorage.setItem(getBestScoreKey(seedText), String(score));
    return true;
  } catch {
    return false;
  }
}

function hideShareText() {
  els.shareText.hidden = true;
}

function makeToken(tokenId, flags = {}) {
  const meta = TOKENS[tokenId];
  const token = document.createElement("span");
  token.className = "token";
  token.dataset.token = tokenId;
  token.style.setProperty("--token-bg", meta.color);
  token.style.setProperty("--token-ink", meta.ink);
  if (flags.active) token.dataset.active = "true";
  if (flags.spent) token.dataset.spent = "true";
  if (flags.large) token.dataset.large = "true";
  token.innerHTML = `<strong>${meta.short}</strong><span>${meta.label}</span>`;
  return token;
}

function statusLabel(status) {
  return {
    ready: "Ready",
    running: `Next target: ${tokenLabel(nextTarget(game))}`,
    "level-complete": "Relay stable",
    won: "All stable",
    lost: "Desynced"
  }[status];
}

function drawRelay(time = 0) {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  if (els.canvas.width !== Math.floor(width * scale) || els.canvas.height !== Math.floor(height * scale)) {
    els.canvas.width = Math.floor(width * scale);
    els.canvas.height = Math.floor(height * scale);
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#111414";
  ctx.fillRect(0, 0, width, height);

  const y = height * 0.52;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#e8e2cf";
  ctx.beginPath();
  ctx.moveTo(16, y);
  ctx.lineTo(width - 16, y);
  ctx.stroke();

  const stream = currentLevel(game).stream;
  const offset = ((time / 28) % 58) - 58;
  stream.forEach((tokenId, index) => {
    const meta = TOKENS[tokenId];
    const x = 26 + index * 58 + offset;
    if (x < -40 || x > width + 40) return;
    roundedRect(x, y - 24, 42, 42, 10, meta.color);
    ctx.fillStyle = meta.ink;
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.short, x + 21, y - 3);
  });

  game.slots.forEach((tokenId, index) => {
    const boxX = width * (index === 0 ? 0.34 : 0.66) - 34;
    const boxY = 18;
    roundedRect(boxX, boxY, 68, 48, 12, "#f6f0de");
    ctx.fillStyle = "#242220";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(index === 0 ? "A" : "B", boxX + 34, boxY + 16);
    if (tokenId) {
      const meta = TOKENS[tokenId];
      roundedRect(boxX + 15, boxY + 22, 38, 20, 8, meta.color);
      ctx.fillStyle = meta.ink;
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillText(meta.short, boxX + 34, boxY + 33);
    }
  });

  animationFrame = requestAnimationFrame(drawRelay);
}

function roundedRect(x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.fill();
}

render();
animationFrame = requestAnimationFrame(drawRelay);

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationFrame));
window.__BUFFER_RELAY_DEBUG__ = {
  game,
  render,
  putPacket: (slotIndex) => {
    const result = putPacket(game, slotIndex);
    render();
    return result;
  },
  emitSlot: (slotIndex) => {
    const result = emitSlot(game, slotIndex);
    render();
    return result;
  },
  start: () => {
    startGame(game);
    render();
  }
};
