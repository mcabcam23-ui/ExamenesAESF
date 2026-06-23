/** Exámenes archivados: ver, reimprimir, escanear y corregir manualmente */
const scanState = {
  entry: null,
  questions: [],
  answers: {},
  doubtful: [],
  previewUrl: null,
};

function showAppView(id) {
  ["viewConfig", "viewExam", "viewResults", "viewArchive", "viewScan"].forEach((v) => {
    const el = document.getElementById(v);
    if (el) el.hidden = v !== id;
  });
  document.body.classList.toggle("body--exam", id === "viewExam");
}

function renderArchivedExams() {
  const list = document.getElementById("archivedList");
  const empty = document.getElementById("archivedEmpty");
  if (!list) return;

  const exams = getArchivedExams();
  if (!exams.length) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  const countEl = document.getElementById("archivedCount");
  if (countEl) countEl.textContent = String(exams.length);

  list.innerHTML = exams
    .map(
      (e) => `
    <li class="archived-item" data-id="${esc(e.id)}">
      <div class="archived-item__info">
        <strong>${esc(e.title)}</strong>
        <span class="archived-item__meta">${e.total} preg. · ${esc(formatArchiveDate(e.createdAt))}</span>
      </div>
      <div class="archived-item__actions">
        <button type="button" class="btn btn--sm" data-action="view">Ver</button>
        <button type="button" class="btn btn--sm" data-action="scan">Escanear</button>
        <button type="button" class="btn btn--sm" data-action="print">PDF</button>
        <button type="button" class="btn btn--sm btn--danger" data-action="delete" title="Eliminar">✕</button>
      </div>
    </li>`
    )
    .join("");
}

function openArchivedExamView(id) {
  const entry = getArchivedExam(id);
  if (!entry) return;
  const questions = resolveArchivedQuestions(entry);
  const panel = document.getElementById("archiveQuestionPanel");
  const title = document.getElementById("archiveViewTitle");
  if (!panel || !questions.length) return;

  if (title) {
    title.textContent = `${entry.title} — ${entry.total} preguntas (${formatArchiveDate(entry.createdAt)})`;
  }

  scanState.entry = entry;
  showAppView("viewArchive");
  loadArchivedQuestionsChunked(panel, questions, entry);
}

async function loadArchivedQuestionsChunked(panel, questions, entry) {
  panel.innerHTML = `<p class="nota archive-loading">Cargando ${questions.length} preguntas…</p>`;
  const BATCH = 10;

  for (let i = 0; i < questions.length; i += BATCH) {
    if (i === 0) panel.innerHTML = "";
    const chunk = questions.slice(i, i + BATCH);
    const html = chunk
      .map((q, j) => {
        const idx = i + j;
        const key = entry.answerKey[idx];
        const keyLabel = key ? key.toUpperCase() : "—";
        return `
      <div class="archive-q">
        <p class="archive-q__meta">Pregunta ${idx + 1} · Libro ${q.book} · Clave: ${esc(keyLabel)}</p>
        ${formatQuestionBlock(q, { examIndex: idx, showCorrection: false })}
      </div>`;
      })
      .join("");
    panel.insertAdjacentHTML("beforeend", html);
    await yieldToMain();
  }
}

function reprintArchivedExam(id) {
  const entry = getArchivedExam(id);
  if (!entry) return;
  const questions = resolveArchivedQuestions(entry);
  if (!questions.length) {
    alert("No se encontraron las preguntas de este examen.");
    return;
  }
  openExamPrintWindow(questions, entry.config, entry);
}

function startScanForExam(id) {
  const entry = getArchivedExam(id);
  if (!entry) return;
  scanState.entry = entry;
  scanState.questions = resolveArchivedQuestions(entry);
  scanState.answers = {};
  scanState.doubtful = [];
  if (scanState.previewUrl) {
    URL.revokeObjectURL(scanState.previewUrl);
    scanState.previewUrl = null;
  }

  const title = document.getElementById("scanTitle");
  if (title) {
    title.textContent = `${entry.title} — ${entry.total} preguntas`;
  }

  resetScanPanels();
  showAppView("viewScan");
}

function resetScanPanels() {
  const step1 = document.getElementById("scanStepCapture");
  const step2 = document.getElementById("scanStepReview");
  const step3 = document.getElementById("scanStepResults");
  const preview = document.getElementById("scanPreview");
  const fileInput = document.getElementById("scanFileInput");

  if (step1) step1.hidden = false;
  if (step2) step2.hidden = true;
  if (step3) step3.hidden = true;
  if (preview) preview.innerHTML = "";
  if (fileInput) fileInput.value = "";
}

function processScanFile(file) {
  if (!file || !scanState.entry || isAppBusy?.()) return;

  const status = document.getElementById("scanStatus");
  if (status) status.textContent = "Analizando imagen…";

  const img = new Image();
  const url = URL.createObjectURL(file);
  if (scanState.previewUrl) URL.revokeObjectURL(scanState.previewUrl);
  scanState.previewUrl = url;

  img.onload = async () => {
    try {
      await withBusy("Analizando hoja de respuestas…", async () => {
        const result = await scanAnswerSheetImageAsync(
          img,
          scanState.entry.total,
          (p) => {
            if (status) status.textContent = `Analizando… ${Math.round(p * 100)}%`;
          }
        );
        scanState.answers = { ...result.answers };
        scanState.doubtful = [...result.doubtful];

        const preview = document.getElementById("scanPreview");
        if (preview && result.canvas) {
          result.canvas.style.maxWidth = "100%";
          result.canvas.className = "scan-preview-canvas";
          preview.innerHTML = "";
          preview.appendChild(result.canvas);
        }
      });

      if (status) status.textContent = "";
      if (scanState.doubtful.length) showDoubtReview();
      else finishScanGrading();
    } catch {
      if (status) status.textContent = "";
      alert("Error al analizar la imagen. Prueba con otra foto.");
    }
  };
  img.onerror = () => {
    if (status) status.textContent = "";
    alert("No se pudo cargar la imagen.");
  };
  img.src = url;
}

function showDoubtReview() {
  document.getElementById("scanStepCapture").hidden = true;
  document.getElementById("scanStepReview").hidden = false;
  document.getElementById("scanStepResults").hidden = true;

  const list = document.getElementById("scanDoubtList");
  const hint = document.getElementById("scanDoubtHint");
  if (hint) {
    hint.textContent =
      scanState.doubtful.length === 1
        ? "1 pregunta con duda — indica la respuesta correcta:"
        : `${scanState.doubtful.length} preguntas con duda — corrígelas una a una:`;
  }

  renderDoubtItem(0, list);
}

function renderDoubtItem(index, container) {
  if (!container || index >= scanState.doubtful.length) {
    finishScanGrading();
    return;
  }

  const qNum = scanState.doubtful[index];
  const q = scanState.questions[qNum - 1];
  const detected = scanState.answers[qNum];
  const detectedLabel = detected ? detected.toUpperCase() : "ninguna clara";

  container.innerHTML = `
    <div class="scan-doubt-card">
      <p class="scan-doubt-card__progress">Duda ${index + 1} de ${scanState.doubtful.length}</p>
      <h3 class="scan-doubt-card__title">Pregunta ${qNum}</h3>
      <p class="scan-doubt-card__detected">Detección automática: <strong>${esc(detectedLabel)}</strong></p>
      ${q ? `<div class="scan-doubt-card__question">${formatQuestionBlock(q, { examIndex: qNum - 1 })}</div>` : ""}
      <p class="scan-doubt-card__prompt">¿Qué respuesta marcaste en la hoja?</p>
      <div class="scan-doubt-card__opts" data-q="${qNum}" data-idx="${index}">
        ${["a", "b", "c", "d"]
          .map(
            (l) =>
              `<button type="button" class="btn scan-opt-btn" data-letter="${l}">${l.toUpperCase()}</button>`
          )
          .join("")}
        <button type="button" class="btn scan-opt-btn scan-opt-btn--empty" data-letter="">Vacía</button>
      </div>
    </div>`;

  container.querySelector(".scan-doubt-card__opts").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-letter]");
    if (!btn) return;
    const letter = btn.dataset.letter || null;
    scanState.answers[qNum] = letter;
    renderDoubtItem(index + 1, container);
  });
}

function finishScanGrading() {
  document.getElementById("scanStepCapture").hidden = true;
  document.getElementById("scanStepReview").hidden = true;
  document.getElementById("scanStepResults").hidden = false;

  const entry = scanState.entry;
  const grade = gradeScanAnswers(scanState.answers, entry.answerKey);
  const maxErr = calcMaxErrors(entry.total);
  const passed = grade.wrong + grade.empty <= maxErr;

  const hero = document.getElementById("scanResultsHero");
  const detail = document.getElementById("scanResultsDetail");
  if (!hero) return;

  hero.innerHTML = `
    <div class="resultado-hero ${passed ? "resultado-hero--apto" : "resultado-hero--no-apto"}">
      <p class="resultado-hero__estado">${passed ? "APTO" : "NO APTO"}</p>
      <p class="resultado-hero__stats">
        <span class="chip chip--ok">${grade.correct} aciertos</span>
        <span class="chip chip--fail">${grade.wrong} fallos</span>
        <span class="chip chip--neutral">${grade.empty} en blanco</span>
      </p>
      <p class="nota">Máximo permitido: ${maxErr} errores (${entry.total} preguntas)</p>
    </div>`;

  if (detail) {
    detail.innerHTML = grade.details
      .filter((d) => !d.ok)
      .map((d) => {
        const q = scanState.questions[d.q - 1];
        const picked = d.picked ? d.picked.toUpperCase() : "—";
        const key = d.key ? d.key.toUpperCase() : "—";
        const label = d.empty ? "Sin respuesta" : `Marcaste ${picked}, clave ${key}`;
        return `<div class="scan-result-row scan-result-row--fail">
          <strong>Pregunta ${d.q}</strong> — ${esc(label)}
          ${q ? `<details><summary>Ver enunciado</summary>${formatQuestionBlock(q, { examIndex: d.q - 1, showCorrection: true, selected: d.picked, answered: true })}</details>` : ""}
        </div>`;
      })
      .join("") || `<p class="nota">¡Perfecto! Todas las respuestas correctas.</p>`;
  }
}

function onPdfExported(entry) {
  renderArchivedExams();
  const panel = document.getElementById("archivedPanel");
  if (panel && !panel.open) panel.open = true;
  if (entry?.id) {
    const msg = document.getElementById("archivedSavedMsg");
    if (msg) {
      msg.textContent = `Examen guardado (${entry.total} preg.). Puedes verlo o escanearlo abajo.`;
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 6000);
    }
  }
}

function initExamScan() {
  renderArchivedExams();

  document.getElementById("archivedList")?.addEventListener("click", (ev) => {
    if (isAppBusy?.()) return;
    const item = ev.target.closest(".archived-item");
    if (!item) return;
    const id = item.dataset.id;
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "view") openArchivedExamView(id);
    else if (action === "scan") startScanForExam(id);
    else if (action === "print") reprintArchivedExam(id);
    else if (action === "delete") {
      if (confirm("¿Eliminar este examen archivado?")) {
        deleteArchivedExam(id);
        renderArchivedExams();
      }
    }
  });

  document.getElementById("archiveBackBtn")?.addEventListener("click", () => showAppView("viewConfig"));
  document.getElementById("scanBackBtn")?.addEventListener("click", () => showAppView("viewConfig"));
  document.getElementById("scanRescanBtn")?.addEventListener("click", () => {
    if (scanState.entry) startScanForExam(scanState.entry.id);
  });
  document.getElementById("scanDoneBtn")?.addEventListener("click", () => showAppView("viewConfig"));

  document.getElementById("scanFileInput")?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (file) processScanFile(file);
  });

  document.getElementById("scanCameraBtn")?.addEventListener("click", () => {
    const input = document.getElementById("scanFileInput");
    if (input) {
      input.setAttribute("capture", "environment");
      input.click();
    }
  });

  document.getElementById("scanUploadBtn")?.addEventListener("click", () => {
    const input = document.getElementById("scanFileInput");
    if (input) {
      input.removeAttribute("capture");
      input.click();
    }
  });
}
