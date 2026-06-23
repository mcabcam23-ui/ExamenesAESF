/** Posiciones normalizadas (0–1) de burbujas — coincide con plantilla 4×22 horizontal */
const OMR = {
  cols: 4,
  rowsPerCol: 22,
  gridLeft: 0.042,
  gridTop: 0.14,
  gridWidth: 0.86,
  gridHeight: 0.72,
  headerRatio: 0.048,
  letters: ["a", "b", "c", "d"],
  doubtGap: 0.10,
  fillThreshold: 0.26,
  maxScanPx: 1600,
  batchSize: 48,
};

function getBubblePositions(totalQuestions) {
  const positions = [];
  const colW = OMR.gridWidth / OMR.cols;
  const rowH = (OMR.gridHeight - OMR.headerRatio) / OMR.rowsPerCol;
  const optW = colW / 4;

  for (let c = 0; c < OMR.cols; c++) {
    for (let r = 0; r < OMR.rowsPerCol; r++) {
      const qNum = c * OMR.rowsPerCol + r + 1;
      if (qNum > totalQuestions) continue;
      OMR.letters.forEach((letter, li) => {
        positions.push({
          q: qNum,
          letter,
          x: OMR.gridLeft + c * colW + (li + 0.5) * optW,
          y: OMR.gridTop + OMR.headerRatio + (r + 0.55) * rowH,
          r: Math.min(rowH, optW) * 0.22,
        });
      });
    }
  }
  return positions;
}

function prepareScanCanvas(image) {
  let w = image.naturalWidth || image.width;
  let h = image.naturalHeight || image.height;
  const max = OMR.maxScanPx;
  if (w > max || h > max) {
    const scale = max / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(image, 0, 0, w, h);
  return canvas;
}

function sampleFillFromData(pixels, width, height, cx, cy, radius) {
  const data = pixels.data;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width, Math.ceil(cx + radius));
  const y1 = Math.min(height, Math.ceil(cy + radius));
  let dark = 0;
  let count = 0;
  const r2 = radius * radius;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * width + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      dark += 255 - lum;
      count++;
    }
  }
  return count ? dark / count / 255 : 0;
}

function rankAnswers(byQuestion, totalQuestions) {
  const answers = {};
  const doubtful = [];

  for (let q = 1; q <= totalQuestions; q++) {
    const fills = byQuestion[q];
    if (!fills) {
      doubtful.push(q);
      answers[q] = null;
      continue;
    }
    const ranked = OMR.letters
      .map((l) => ({ l, f: fills[l] || 0 }))
      .sort((a, b) => b.f - a.f);
    const top = ranked[0];
    const second = ranked[1];
    const marked = ranked.filter((x) => x.f >= OMR.fillThreshold);

    if (marked.length === 0) {
      doubtful.push(q);
      answers[q] = null;
    } else if (marked.length > 1 || top.f - second.f < OMR.doubtGap) {
      doubtful.push(q);
      answers[q] = top.f >= OMR.fillThreshold ? top.l : null;
    } else {
      answers[q] = top.l;
    }
  }

  return { answers, doubtful };
}

function scanAnswerSheetImage(image, totalQuestions) {
  const canvas = prepareScanCanvas(image);
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const positions = getBubblePositions(totalQuestions);
  const byQuestion = {};

  positions.forEach((p) => {
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height;
    const r = p.r * canvas.width;
    const fill = sampleFillFromData(pixels, canvas.width, canvas.height, cx, cy, r);
    if (!byQuestion[p.q]) byQuestion[p.q] = {};
    byQuestion[p.q][p.letter] = fill;
  });

  const { answers, doubtful } = rankAnswers(byQuestion, totalQuestions);
  return { answers, doubtful, canvas };
}

async function scanAnswerSheetImageAsync(image, totalQuestions, onProgress) {
  const canvas = prepareScanCanvas(image);
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const positions = getBubblePositions(totalQuestions);
  const byQuestion = {};

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height;
    const r = p.r * canvas.width;
    const fill = sampleFillFromData(pixels, canvas.width, canvas.height, cx, cy, r);
    if (!byQuestion[p.q]) byQuestion[p.q] = {};
    byQuestion[p.q][p.letter] = fill;

    if (i > 0 && i % OMR.batchSize === 0) {
      onProgress?.(i / positions.length);
      await yieldToMain();
    }
  }

  onProgress?.(1);
  const { answers, doubtful } = rankAnswers(byQuestion, totalQuestions);
  return { answers, doubtful, canvas };
}

function gradeScanAnswers(answers, answerKey) {
  let correct = 0;
  let wrong = 0;
  let empty = 0;
  const details = [];

  answerKey.forEach((key, i) => {
    const q = i + 1;
    const picked = answers[q] || null;
    if (!picked) {
      empty++;
      details.push({ q, picked, key, ok: false, empty: true });
    } else if (key && picked === key) {
      correct++;
      details.push({ q, picked, key, ok: true, empty: false });
    } else {
      wrong++;
      details.push({ q, picked, key, ok: false, empty: false });
    }
  });

  return { correct, wrong, empty, details };
}
