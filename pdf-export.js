function getExamNumberLabel(index) {
  return `${index + 1}`;
}

function escPrint(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absAssetUrl(path) {
  if (typeof assetUrl === "function") return assetUrl(path);
  try {
    const base = window.APP_BASE || "/";
    const clean = String(path).replace(/^\//, "");
    return `${base}${clean}`;
  } catch {
    return path;
  }
}

const CEFF_MONTHS = [
  "E N E R O", "F E B R E R O", "M A R Z O", "A B R I L", "M A Y O", "J U N I O",
  "J U L I O", "A G O S T O", "S E P T I E M B R E", "O C T U B R E", "N O V I E M B R E", "D I C I E M B R E",
];

function formatCeffDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, "0").split("").join(" ");
  const month = CEFF_MONTHS[d.getMonth()];
  const year = String(d.getFullYear()).split("").join(" ");
  return `${day}  ${month}  D E ${year}`;
}

function calcMaxErrors(n) {
  const official = window.QUESTIONS_DATA?.meta?.officialExam;
  return Math.round(((official?.maxErrors ?? 12) / (official?.questions ?? 60)) * n);
}

function formatQuestionForPrint(q, index) {
  const num = index + 1;
  const suf = q.optionSuffix ?? ")";
  const letters = ["a", "b", "c", "d"].filter((l) => q.options[l]);

  let html = `<div class="ceff-pregunta">`;
  html += `<p class="ceff-pregunta__enunciado">${num}.- ${escPrint(q.text)}</p>`;

  if (q.images?.length) {
    html += `<div class="ceff-pregunta__figuras">`;
    q.images.forEach((src) => {
      html += `<img src="${escPrint(absAssetUrl(src))}" alt="Figura">`;
    });
    html += `</div>`;
  }

  letters.forEach((letter) => {
    html += `<p class="ceff-opcion">${letter}${suf} ${escPrint(q.options[letter])}</p>`;
  });

  html += `</div>`;
  return html;
}

function chunkQuestionsForPages(questions) {
  const pages = [];
  let current = [];
  let weight = 0;
  const maxWeight = 5;

  questions.forEach((q, index) => {
    const w = q.images?.length ? 2.5 : 1;
    if (weight + w > maxWeight && current.length) {
      pages.push(current);
      current = [];
      weight = 0;
    }
    current.push({ q, index });
    weight += w;
  });

  if (current.length) pages.push(current);
  return pages;
}

function buildCeffHeader(controlLabel, logoUrl) {
  const logo = logoUrl
    ? `<img class="ceff-head__logo" src="${escPrint(logoUrl)}" alt="Logo">`
    : `<span class="ceff-head__control">AESF — MAQUINISTA</span>`;
  return `<header class="ceff-head">
    ${logo}
    <span class="ceff-head__control">${escPrint(controlLabel)}</span>
  </header>`;
}

function buildCeffFooter(pageNum, dateStr, isCover = false) {
  if (isCover) {
    return `<footer class="ceff-foot ceff-foot--cover">
      <span class="ceff-foot__date">${escPrint(dateStr)}</span>
      <span class="ceff-foot__num">${pageNum}</span>
    </footer>`;
  }
  return `<footer class="ceff-foot">
    <span class="ceff-foot__num">${pageNum}</span>
    <span class="ceff-foot__date">${escPrint(dateStr)}</span>
  </footer>`;
}

function buildCoverPage(cab, total, maxErr, dateStr, controlLabel, logoUrl) {
  const minOk = total - maxErr;
  const passPct = Math.round((minOk / total) * 100);

  return `<div class="print-page ceff-page ceff-page--cover">
    ${buildCeffHeader(controlLabel, logoUrl)}
    <div class="ceff-cover-body">
      <h1 class="ceff-cover-title">${escPrint(cab)}</h1>
      <div class="ceff-score-row">
        <span>ACIERTOS:</span>
        <span class="ceff-score-row__cal">CALIFICACIÓN:</span>
        <span>FALLOS:</span>
      </div>
      <div class="ceff-nombre-row">
        <span>NOMBRE:</span>
        <span>DNI:</span>
      </div>
      <div class="ceff-instrucciones">
        <p>El examen consta de ${total} preguntas. Para obtener la calificación de «APTO» será necesario acertar al menos ${minOk} preguntas (${passPct}%).</p>
        <p>Cada pregunta tiene cuatro posibles respuestas de las cuales únicamente una respuesta es correcta.</p>
        <p>Solo contabilizan las preguntas correctamente acertadas, sin existir ningún tipo de penalización sobre los fallos.</p>
        <p>Máximo de fallos permitidos: ${maxErr}.</p>
      </div>
    </div>
    ${buildCeffFooter(1, dateStr, true)}
  </div>`;
}

function buildQuestionPages(questions, cab, dateStr, controlLabel, logoUrl, startPageNum) {
  const chunks = chunkQuestionsForPages(questions);
  let html = "";
  let pageNum = startPageNum;

  chunks.forEach((chunk, ci) => {
    const showBlockTitle = ci === 0;
    const body = chunk.map(({ q, index }) => formatQuestionForPrint(q, index)).join("");

    html += `<div class="print-page ceff-page">
      ${buildCeffHeader(controlLabel, logoUrl)}
      <div class="ceff-body">
        ${showBlockTitle ? `<h2 class="ceff-bloque-title">${escPrint(cab)}</h2>` : ""}
        ${body}
      </div>
      ${buildCeffFooter(pageNum, dateStr)}
    </div>`;
    pageNum++;
  });

  return { html, nextPageNum: pageNum };
}

function formatCorrectForKey(q) {
  if (q.correct?.toUpperCase() === "NADA") return "—";
  if (q.correctLetters?.length) return q.correctLetters.map((l) => l.toUpperCase()).join(",");
  const c = (q.correct ?? "").toLowerCase();
  return (c.charAt(0) || "?").toUpperCase();
}

function buildAesfPlantillaLimpia(totalExam, cab, examId) {
  const track = (n = 48) =>
    `<div class="aesf-pl__track">${Array(n).fill("<span></span>").join("")}</div>`;

  const buildCol = (startNum) => {
    let rows = `<div class="aesf-pl__col-head">
      <span></span><span>(A)</span><span>(B)</span><span>(C)</span><span>(D)</span>
    </div>`;
    for (let i = 0; i < 22; i++) {
      const num = startNum + i;
      const off = num > totalExam ? " aesf-pl__row--off" : "";
      rows += `<div class="aesf-pl__row${off}" data-q="${num}">
        <span class="aesf-pl__num">${num}</span>
        <div class="aesf-pl__opt"><span class="aesf-pl__opt-label">(A)</span><span class="aesf-pl__bubble"></span><span class="aesf-pl__anular-mini"></span></div>
        <div class="aesf-pl__opt"><span class="aesf-pl__opt-label">(B)</span><span class="aesf-pl__bubble"></span><span class="aesf-pl__anular-mini"></span></div>
        <div class="aesf-pl__opt"><span class="aesf-pl__opt-label">(C)</span><span class="aesf-pl__bubble"></span><span class="aesf-pl__anular-mini"></span></div>
        <div class="aesf-pl__opt"><span class="aesf-pl__opt-label">(D)</span><span class="aesf-pl__bubble"></span><span class="aesf-pl__anular-mini"></span></div>
      </div>`;
    }
    return `<div class="aesf-pl__col">${rows}</div>`;
  };

  const answersGrid = [1, 23, 45, 67].map(buildCol).join("");
  const idAttr = examId ? ` data-exam-id="${escPrint(examId)}"` : "";

  return `<div class="print-page print-page--aesf-plantilla">
    <div class="aesf-pl aesf-pl--grid-only"${idAttr}>
      <div class="aesf-pl__corner aesf-pl__corner--tl"></div>
      <div class="aesf-pl__corner aesf-pl__corner--tr"></div>
      <div class="aesf-pl__corner aesf-pl__corner--bl"></div>
      <div class="aesf-pl__corner aesf-pl__corner--br"></div>
      ${track()}
      <p class="aesf-pl__sheet-title">${escPrint(cab)} · ${totalExam} preguntas</p>
      <div class="aesf-pl__answers">
        <div class="aesf-pl__answers-grid">${answersGrid}</div>
        <div class="aesf-pl__bar">RESPUESTAS</div>
      </div>
      ${track()}
    </div>
  </div>`;
}

function buildAesfPlantillaExacta(totalExam, cab, examId) {
  return buildAesfPlantillaLimpia(totalExam, cab, examId);
}

function buildClaveDocente(questions, cab, dateStr) {
  const items = questions.map((q, i) =>
    `<span class="clave-item"><strong>${i + 1}.</strong> ${escPrint(formatCorrectForKey(q))}</span>`
  ).join("");

  return `<div class="print-page">
    <div class="clave-docente">
      <p class="clave-docente__aviso">CLAVE DE CORRECCIÓN — SOLO DOCENTE</p>
      <p class="clave-docente__titulo">${escPrint(cab)} · ${questions.length} preguntas · ${escPrint(dateStr)}</p>
      <div class="clave-grid">${items}</div>
    </div>
  </div>`;
}

function buildExamPrintDocument(questions, config, archivedEntry) {
  const total = questions.length;
  const books = [...new Set(questions.map((q) => q.book))];
  const cab = books.length === 1
    ? `EXAMEN RCF — LIBRO ${books[0]}`
    : "EXAMEN RCF — MAQUINISTA";
  const date = new Date();
  const dateStr = formatCeffDate(date);
  const dateShort = date.toLocaleDateString("es-ES");
  const cssUrl = absAssetUrl("css/print-exam.css");
  const plantillaCssUrl = absAssetUrl("css/print-aesf-plantilla.css");
  const logoUrl = absAssetUrl("images/ceff-logo.png");
  const controlLabel = `CONTROL EXAMEN RCF  ${dateShort.replace(/\//g, "")}`;
  const maxErr = calcMaxErrors(total);
  const examId = archivedEntry?.id || "";

  const cover = buildCoverPage(cab, total, maxErr, dateStr, controlLabel, logoUrl);
  const { html: questionPages } = buildQuestionPages(
    questions, cab, dateStr, controlLabel, logoUrl, 2
  );
  const blankPage = `<div class="print-page print-page--blank" aria-label="Página en blanco"></div>`;
  const plantillaAesf = buildAesfPlantillaExacta(total, cab, examId);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escPrint(cab)} — ${total} preguntas</title>
  <link rel="stylesheet" href="${escPrint(cssUrl)}">
  <link rel="stylesheet" href="${escPrint(plantillaCssUrl)}">
</head>
<body>
  ${cover}
  ${questionPages}
  ${blankPage}
  ${plantillaAesf}
</body>
</html>`;
}

function exportExamToPdf(questions, config) {
  const books = [...new Set(questions.map((q) => q.book))];
  const cab = books.length === 1
    ? `EXAMEN RCF — LIBRO ${books[0]}`
    : "EXAMEN RCF — MAQUINISTA";
  const archivedEntry = archiveExam(questions, cab, config);
  openExamPrintWindow(questions, config, archivedEntry);
  return archivedEntry;
}

async function exportExamToPdfAsync(questions, config) {
  return withBusy("Generando PDF…", async () => {
    await yieldToMain();
    const books = [...new Set(questions.map((q) => q.book))];
    const cab = books.length === 1
      ? `EXAMEN RCF — LIBRO ${books[0]}`
      : "EXAMEN RCF — MAQUINISTA";
    const archivedEntry = archiveExam(questions, cab, config);
    await yieldToMain();
    openExamPrintWindow(questions, config, archivedEntry);
    return archivedEntry;
  });
}

function waitForPrintWindow(win) {
  const triggerPrint = () => {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* ventana cerrada */
      }
    }, 300);
  };

  const waitImages = () => {
    const imgs = [...win.document.images];
    if (!imgs.length) {
      triggerPrint();
      return;
    }
    let pending = imgs.length;
    const done = () => {
      pending--;
      if (pending <= 0) triggerPrint();
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  };

  if (win.document.readyState === "complete") {
    waitImages();
  } else {
    win.addEventListener("load", waitImages, { once: true });
  }
}

function openExamPrintWindow(questions, config, archivedEntry) {
  if (!questions?.length) {
    alert("No hay preguntas para generar el PDF.");
    return null;
  }

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permite ventanas emergentes para generar el PDF.");
    return null;
  }

  win.document.open();
  win.document.write("<!DOCTYPE html><html><head><meta charset=UTF-8><title>Generando…</title></head><body><p style=font-family:sans-serif>Preparando examen…</p></body></html>");
  win.document.close();

  setTimeout(() => {
    const html = buildExamPrintDocument(questions, config, archivedEntry);
    win.document.open();
    win.document.write(html);
    win.document.close();
    waitForPrintWindow(win);
  }, 50);

  return archivedEntry;
}

async function exportExamPdfFromConfig(pickQuestions, readConfig) {
  const config = readConfig();
  if (!config.books.length) {
    alert("Selecciona al menos un libro.");
    return null;
  }
  const picked = pickQuestions(config);
  if (!picked.length) {
    alert("No hay preguntas con esa configuración.");
    return null;
  }
  return exportExamToPdfAsync(picked, config);
}

async function exportCurrentExamPdf(state) {
  if (!state.questions?.length) {
    alert("No hay examen activo.");
    return null;
  }
  return exportExamToPdfAsync(state.questions, state.config);
}
