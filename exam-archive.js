const ARCHIVE_KEY = "rcf_archived_exams";

function generateExamId() {
  return `exam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCorrectLetter(q) {
  if (q.correct?.toUpperCase() === "NADA") return null;
  if (q.correctLetters?.length) return q.correctLetters[0].toLowerCase();
  return (q.correct ?? "").toLowerCase().charAt(0) || null;
}

function archiveExam(questions, cab, config) {
  const entry = {
    id: generateExamId(),
    createdAt: new Date().toISOString(),
    title: cab,
    total: questions.length,
    questionIds: questions.map((q) => q.id),
    answerKey: questions.map(getCorrectLetter),
    config: config ? { ...config, books: [...(config.books || [])] } : null,
  };

  const store = getArchivedExams();
  store.unshift(entry);
  if (store.length > 40) store.length = 40;
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(store));
  if (typeof notifyCloudDataChanged === "function") notifyCloudDataChanged();
  return entry;
}

function getArchivedExams() {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]");
  } catch {
    return [];
  }
}

function getArchivedExam(id) {
  return getArchivedExams().find((e) => e.id === id) || null;
}

function deleteArchivedExam(id) {
  const store = getArchivedExams().filter((e) => e.id !== id);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(store));
  if (typeof notifyCloudDataChanged === "function") notifyCloudDataChanged();
}

function resolveArchivedQuestions(entry) {
  if (!entry?.questionIds?.length) return [];
  const byId = Object.fromEntries(DATA.questions.map((q) => [q.id, q]));
  return entry.questionIds.map((id) => byId[id]).filter(Boolean);
}

function formatArchiveDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
