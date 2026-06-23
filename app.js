const DATA = window.QUESTIONS_DATA;
const OFFICIAL = DATA?.meta?.officialExam;
const FAILED_KEY = "rcf_failed_questions";

const $ = (sel) => document.querySelector(sel);

const state = {
  config: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  finished: false,
  sessionFailedIds: new Set(),
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcMaxErrors(n) {
  return Math.round(((OFFICIAL?.maxErrors ?? 12) / (OFFICIAL?.questions ?? 60)) * n);
}

function isCorrect(q, letter) {
  if (!letter) return false;
  if (q.correct?.toUpperCase() === "NADA") return false;
  const l = letter.toLowerCase();
  if (q.correctLetters?.length) return q.correctLetters.includes(l);
  return q.correct?.toLowerCase().startsWith(l);
}

function getPool(books) {
  return DATA.questions.filter((q) => books.includes(q.book));
}

function pickQuestions(config) {
  const pool = getPool(config.books);
  if (!pool.length) return [];
  const count = Math.min(config.numQuestions, pool.length);

  if (config.proportional && config.books.length > 1) {
    const byBook = {};
    config.books.forEach((b) => {
      byBook[b] = shuffle(pool.filter((q) => q.book === b));
    });
    const per = Math.floor(count / config.books.length);
    let rem = count - per * config.books.length;
    let sel = [];
    config.books.forEach((b) => {
      let n = per + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      sel.push(...byBook[b].slice(0, Math.min(n, byBook[b].length)));
    });
    if (sel.length < count) {
      const used = new Set(sel.map((q) => q.id));
      sel.push(...shuffle(pool.filter((q) => !used.has(q.id))).slice(0, count - sel.length));
    }
    return shuffle(sel);
  }

  return shuffle(pool).slice(0, count);
}

function showView(id) {
  if (typeof showAppView === "function") showAppView(id);
  else {
    ["viewConfig", "viewExam", "viewResults"].forEach((v) => {
      const el = $(`#${v}`);
      el.hidden = v !== id;
    });
    document.body.classList.toggle("body--exam", id === "viewExam");
  }
}

function getExamNumberLabel(index) {
  return `${index + 1}ª`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQuestionBlock(q, opts = {}) {
  const { answered, showCorrection, selected, examIndex } = opts;
  const label = examIndex != null ? getExamNumberLabel(examIndex) : (q.numberLabel ?? q.number);
  const suf = q.optionSuffix ?? ")";
  const letters = ["a", "b", "c", "d"].filter((l) => q.options[l]);

  let html = `<p class="pregunta-num"><span class="pregunta-num__n">${esc(label)}.-</span> ${esc(q.text)}</p>`;

  if (q.images?.length) {
    html += `<div class="figuras">`;
    q.images.forEach((src) => {
      const url = typeof assetUrl === "function" ? assetUrl(src) : src;
      html += `<figure class="figura"><img src="${esc(url)}" alt="Figura" loading="lazy"></figure>`;
    });
    html += `</div>`;
  }

  html += `<div class="opciones">`;
  letters.forEach((letter) => {
    let cls = "opcion";
    const checked = selected === letter;
    if (checked) cls += " opcion--elegida";
    if (showCorrection) {
      if (isCorrect(q, letter)) cls += " opcion--correcta";
      else if (checked) cls += " opcion--incorrecta";
    }
    const disabled = showCorrection ? "disabled" : "";
    const mark = checked ? "checked" : "";
    html += `<label class="${cls}"><input type="radio" name="resp" value="${letter}" ${mark} ${disabled}><span class="opcion__letra">${letter}${suf}</span><span class="opcion__texto">${esc(q.options[letter])}</span></label>`;
  });
  html += `</div>`;

  if (showCorrection && answered) {
    const ok = isCorrect(q, selected);
    html += ok
      ? `<div class="correccion correccion--ok">Correcto. Respuesta: <strong>${esc(q.correct)}</strong></div>`
      : `<div class="correccion correccion--mal">Incorrecto. Has marcado <strong>${esc(selected)}</strong>. Respuesta correcta: <strong>${esc(q.correct)}</strong></div>`;
  }

  return html;
}

/** empty | answered | correct | wrong */
function getQuestionStatus(index) {
  const ans = state.answers[index];
  if (!ans) return "empty";
  const isPractice = state.config?.mode === "practice";
  const graded = isPractice || state.finished;
  if (!graded) return "answered";
  return isCorrect(state.questions[index], ans) ? "correct" : "wrong";
}

function canShowGrades() {
  return state.config?.mode === "practice" || state.finished;
}

function renderQuestionMap() {
  const map = $("#questionMap");
  const summary = $("#mapSummary");
  if (!map) return;

  const total = state.questions.length;
  let answered = 0;
  let correct = 0;
  let wrong = 0;

  map.innerHTML = state.questions
    .map((q, i) => {
      const status = getQuestionStatus(i);
      if (status !== "empty") answered++;
      if (status === "correct") correct++;
      if (status === "wrong") wrong++;

      let cls = "mapa-btn";
      if (i === state.currentIndex) cls += " mapa-btn--current";
      if (status === "correct") cls += " mapa-btn--ok";
      else if (status === "wrong") cls += " mapa-btn--fail";
      else if (status === "answered") cls += " mapa-btn--answered";
      else cls += " mapa-btn--empty";

      return `<button type="button" class="${cls}" data-index="${i}" title="Pregunta ${i + 1} (Libro ${q.book} · ${q.numberLabel ?? q.number})">${i + 1}</button>`;
    })
    .join("");

  if (canShowGrades()) {
    summary.textContent = `${correct}✓ ${wrong}✗ · ${total - answered} pendientes`;
  } else {
    summary.textContent = `${answered}/${total} respondidas`;
  }
}

function renderBookGrid() {
  const grid = $("#bookGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const meta = DATA.meta.books[String(i)];
    grid.innerHTML += `<label><input type="checkbox" name="book" value="${i}" checked> ${meta.title} (${meta.count})</label><br>`;
  }
}

function getSelectedBooks() {
  return [...document.querySelectorAll('input[name="book"]:checked')].map((el) => Number(el.value));
}

function updatePoolInfo() {
  const books = getSelectedBooks();
  const pool = getPool(books);
  const num = Number($("#numQuestionsInput").value) || 60;
  const maxErr = calcMaxErrors(num);
  $("#passHint").textContent = maxErr;
  $("#poolInfo").textContent = pool.length
    ? `${pool.length} preguntas disponibles. Cada examen elige ${num} al azar. Para aprobar: mínimo ${num - maxErr} aciertos de ${num} (${Math.round((OFFICIAL?.passRate ?? 0.8) * 100)}%).`
    : "Selecciona al menos un libro.";
}

function readConfig() {
  return {
    mode: document.querySelector('input[name="mode"]:checked').value,
    numQuestions: Number($("#numQuestionsInput").value) || 60,
    books: getSelectedBooks(),
    proportional: $("#proportionalBooks").checked,
  };
}

function startSession(questionsOverride, modeOverride) {
  const config = readConfig();
  if (modeOverride) config.mode = modeOverride;

  let picked;
  if (questionsOverride) {
    picked = questionsOverride;
    config.numQuestions = picked.length;
  } else {
    if (!config.books.length) { alert("Selecciona al menos un libro."); return; }
    picked = pickQuestions(config);
    if (!picked.length) { alert("No hay preguntas con esa configuración."); return; }
  }

  state.config = config;
  state.questions = picked;
  state.currentIndex = 0;
  state.answers = {};
  state.finished = false;
  state.sessionFailedIds = new Set();

  showView("viewExam");
  renderExam();
}

function getStats() {
  let correct = 0, wrong = 0, skipped = 0;
  state.questions.forEach((q, i) => {
    const a = state.answers[i];
    if (!a) skipped++;
    else if (isCorrect(q, a)) correct++;
    else wrong++;
  });
  return { correct, wrong, skipped, total: state.questions.length };
}

function renderLiveScore() {
  const el = $("#liveScore");
  if (!el) return;

  const { mode } = state.config;
  const total = state.questions.length;
  const isPractice = mode === "practice";

  if (isPractice || state.finished) {
    const s = getStats();
    el.hidden = false;
    el.className = "marcador-live marcador-live--graded";
    el.innerHTML = `
      <span class="marcador-live__chip marcador-live__chip--ok">
        <span class="marcador-live__label">Aciertos</span>
        <span class="marcador-live__num">${s.correct}</span>
      </span>
      <span class="marcador-live__chip marcador-live__chip--fail">
        <span class="marcador-live__label">Fallos</span>
        <span class="marcador-live__num">${s.wrong}</span>
      </span>
      <span class="marcador-live__chip marcador-live__chip--pending">
        <span class="marcador-live__label">Pendientes</span>
        <span class="marcador-live__num">${s.skipped}</span>
      </span>`;
    return;
  }

  const answered = Object.keys(state.answers).length;
  const pending = total - answered;
  el.hidden = false;
  el.className = "marcador-live marcador-live--exam";
  el.innerHTML = `
    <span class="marcador-live__chip marcador-live__chip--answered">
      <span class="marcador-live__label">Respondidas</span>
      <span class="marcador-live__num">${answered}</span>
    </span>
    <span class="marcador-live__chip marcador-live__chip--pending">
      <span class="marcador-live__label">Pendientes</span>
      <span class="marcador-live__num">${pending}</span>
    </span>
    <span class="marcador-live__total">de ${total}</span>`;
}

function renderExam() {
  const { mode } = state.config;
  const idx = state.currentIndex;
  const total = state.questions.length;
  const q = state.questions[idx];
  const selected = state.answers[idx];
  const isPractice = mode === "practice";
  const showCorrection = isPractice && selected;

  const books = [...new Set(state.questions.map((x) => x.book))];
  const cab = books.length === 1 ? `EXAMEN RCF: Libro ${books[0]}` : "EXAMEN RCF";

  $("#examInfo").textContent = `${cab} — ${isPractice ? "PRÁCTICA" : "EXAMEN"}`;
  $("#examProgress").textContent = `${idx + 1} / ${total}`;

  renderLiveScore();

  $("#questionPanel").innerHTML = `
    <header class="doc-header">
      <div class="doc-header__top">AESF — EXAMEN TIPO TEST</div>
      <div class="doc-header__title">${cab}</div>
      <div class="doc-header__meta">Reglamento de Circulación Ferroviaria (RCF)</div>
    </header>
    <div class="doc-body">
      ${formatQuestionBlock(q, { selected, showCorrection, answered: !!selected, examIndex: idx })}
    </div>
    <footer class="doc-footer">Pregunta ${idx + 1} de ${total}</footer>
  `;

  $("#questionPanel").querySelectorAll('input[name="resp"]').forEach((input) => {
    input.addEventListener("change", () => selectAnswer(input.value));
  });

  $("#prevBtn").disabled = idx === 0;
  $("#nextBtn").disabled = idx >= total - 1;

  const legendAnswered = document.querySelector(".mapa-leyenda__item:nth-child(2)");
  if (legendAnswered) {
    legendAnswered.hidden = mode === "practice";
  }

  renderQuestionMap();
}

function selectAnswer(letter) {
  if (state.finished) return;
  state.answers[state.currentIndex] = letter;
  const q = state.questions[state.currentIndex];
  if (state.config.mode === "practice") {
    if (isCorrect(q, letter)) {
      removeFromFailed(q.id, true);
    } else if (!state.sessionFailedIds.has(q.id)) {
      addToFailedStore(q);
      state.sessionFailedIds.add(q.id);
    }
  }
  renderExam();
}

function confirmFinish() {
  const s = getStats();
  const pending = s.skipped;
  let msg = "¿Finalizar el examen y ver la corrección?";
  if (pending > 0) {
    msg = `Tienes ${pending} pregunta(s) sin responder. ¿Finalizar igualmente y ver la corrección?`;
  }
  return confirm(msg);
}

function finishExam() {
  if (!confirmFinish()) return;
  state.finished = true;
  saveFailedQuestions();
  showResults();
}

function getFailedStore() {
  try {
    return JSON.parse(localStorage.getItem(FAILED_KEY) || "{}");
  } catch {
    return {};
  }
}

function addToFailedStore(q) {
  const store = getFailedStore();
  const now = new Date().toISOString();
  store[q.id] = {
    id: q.id,
    book: q.book,
    numberLabel: q.numberLabel ?? q.number,
    text: q.text.slice(0, 120),
    failCount: (store[q.id]?.failCount ?? 0) + 1,
    lastFailed: now,
  };
  localStorage.setItem(FAILED_KEY, JSON.stringify(store));
  scheduleRenderFailedSection();
}

let _failedSectionTimer;
function scheduleRenderFailedSection() {
  clearTimeout(_failedSectionTimer);
  _failedSectionTimer = setTimeout(renderFailedSection, 300);
}

function saveFailedQuestions() {
  state.questions.forEach((q, i) => {
    const ans = state.answers[i];
    if (!ans || isCorrect(q, ans)) return;
    if (state.sessionFailedIds.has(q.id)) return;
    addToFailedStore(q);
    state.sessionFailedIds.add(q.id);
  });
}

function removeFromFailed(id, silent) {
  const store = getFailedStore();
  if (!store[id]) return;
  delete store[id];
  localStorage.setItem(FAILED_KEY, JSON.stringify(store));
  renderFailedSection();
}

function clearFailedStore() {
  if (!confirm("¿Vaciar todo el historial de preguntas falladas?")) return;
  localStorage.removeItem(FAILED_KEY);
  renderFailedSection();
}

function getFailedQuestionsForExam() {
  const store = getFailedStore();
  const ids = Object.keys(store);
  return DATA.questions.filter((q) => ids.includes(q.id));
}

function renderFailedSection() {
  const store = getFailedStore();
  const entries = Object.values(store).sort(
    (a, b) => new Date(b.lastFailed) - new Date(a.lastFailed)
  );
  const countEl = $("#failedCount");
  const listEl = $("#failedList");
  const emptyEl = $("#failedEmpty");
  const startBtn = $("#startFailedBtn");

  if (countEl) countEl.textContent = entries.length;
  if (!listEl) return;

  if (!entries.length) {
    listEl.innerHTML = "";
    emptyEl.hidden = false;
    startBtn.disabled = true;
    return;
  }

  emptyEl.hidden = true;
  startBtn.disabled = false;
  listEl.innerHTML = entries
    .slice(0, 50)
    .map(
      (e) => `
      <li class="failed-list__item">
        <span class="failed-list__meta">Libro ${e.book} · ${esc(String(e.numberLabel))} · ${e.failCount}×</span>
        <span class="failed-list__text">${esc(e.text)}…</span>
        <button type="button" class="btn btn--sm failed-list__del" data-id="${esc(e.id)}" title="Quitar del repaso">×</button>
      </li>`
    )
    .join("");

  listEl.querySelectorAll(".failed-list__del").forEach((btn) => {
    btn.addEventListener("click", () => removeFromFailed(btn.dataset.id));
  });
}

function startFailedReview() {
  const qs = getFailedQuestionsForExam();
  if (!qs.length) {
    alert("No hay preguntas falladas guardadas.");
    return;
  }
  startSession(shuffle([...qs]), "practice");
}

function showResults() {
  showView("viewResults");
  const s = getStats();
  const maxErr = calcMaxErrors(s.total);
  const passed = s.wrong + s.skipped <= maxErr;

  $("#resultsHero").innerHTML = `
    <p class="resultado-linea ${passed ? "resultado-linea--ok" : "resultado-linea--mal"}">
      ${passed ? "APTO" : "NO APTO"}
    </p>
    <p class="resultado-linea">Aciertos: <strong>${s.correct}</strong> de ${s.total}</p>
    <p class="resultado-linea">Fallos: ${s.wrong} | Sin responder: ${s.skipped}</p>
    <p class="resultado-linea">Máximo de fallos permitido: ${maxErr}</p>
    ${s.wrong ? `<p class="nota">${s.wrong} pregunta(s) fallada(s) guardadas en Repaso.</p>` : ""}
  `;

  const panel = $("#reviewPanel");
  if (panel) panel.innerHTML = `<div class="hoja"><p class="nota">Cargando revisión…</p></div>`;
  requestAnimationFrame(() => {
    setTimeout(() => renderReview("all"), 0);
  });
}

function renderReview(filter) {
  const panel = $("#reviewPanel");
  const items = state.questions
    .map((q, i) => ({ q, i, ans: state.answers[i] }))
    .filter(({ q, ans }) => filter !== "wrong" || !ans || !isCorrect(q, ans));

  if (!items.length) {
    panel.innerHTML = `<div class="hoja"><p>${filter === "wrong" ? "Sin fallos." : "Sin preguntas."}</p></div>`;
    return;
  }

  panel.innerHTML = items
    .map(({ q, ans, i }) => {
      const ok = ans && isCorrect(q, ans);
      const cls = !ans || !ok ? "review-item--fallo" : "review-item--acierto";
      return `
      <div class="review-item ${cls}">
        <p class="review-meta">Pregunta ${i + 1} — Libro ${q.book} · ${esc(q.numberLabel ?? q.number)}${ok ? " — CORRECTA" : " — INCORRECTA"}</p>
        ${formatQuestionBlock(q, { selected: ans, showCorrection: true, answered: true, examIndex: i })}
      </div>`;
    })
    .join("");
}

function init() {
  if (!DATA?.questions?.length) {
    document.body.innerHTML = `<div class="error-carga"><strong>Error:</strong> No se cargaron las preguntas.</div>`;
    return;
  }

  renderBookGrid();
  updatePoolInfo();
  renderFailedSection();
  if (typeof initExamScan === "function") initExamScan();

  $("#numQuestionsInput").addEventListener("input", updatePoolInfo);
  $("#bookGrid").addEventListener("change", updatePoolInfo);

  $("#questionMap")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".mapa-btn");
    if (!btn) return;
    state.currentIndex = Number(btn.dataset.index);
    renderExam();
    $("#questionPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#presetOfficial").addEventListener("click", () => {
    document.querySelector('input[name="mode"][value="exam"]').checked = true;
    $("#numQuestionsInput").value = 60;
    document.querySelectorAll('input[name="book"]').forEach((el) => { el.checked = true; });
    $("#proportionalBooks").checked = true;
    updatePoolInfo();
  });

  $("#startBtn").addEventListener("click", () => startSession());
  $("#exportPdfBtn").addEventListener("click", async () => {
    if (isAppBusy?.()) return;
    const entry = await exportExamPdfFromConfig(pickQuestions, readConfig);
    if (entry && typeof onPdfExported === "function") onPdfExported(entry);
  });
  $("#exportPdfExamBtn").addEventListener("click", async () => {
    if (isAppBusy?.()) return;
    const entry = await exportCurrentExamPdf(state);
    if (entry && typeof onPdfExported === "function") onPdfExported(entry);
  });
  $("#startFailedBtn").addEventListener("click", startFailedReview);
  $("#clearFailedBtn").addEventListener("click", clearFailedStore);

  $("#prevBtn").addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderExam();
    }
  });

  $("#nextBtn").addEventListener("click", () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderExam();
    }
  });

  $("#finishBtn").addEventListener("click", finishExam);

  $("#exitExamBtn").addEventListener("click", () => {
    if (confirm("¿Salir del examen? Se perderá el progreso actual.")) showView("viewConfig");
  });

  $("#reviewWrongBtn").addEventListener("click", () => renderReview("wrong"));
  $("#reviewAllBtn").addEventListener("click", () => renderReview("all"));
  $("#retryFailedBtn").addEventListener("click", startFailedReview);
  $("#newSessionBtn").addEventListener("click", () => showView("viewConfig"));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
