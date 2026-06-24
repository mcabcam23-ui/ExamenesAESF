/** Sincronización con cuenta Google (Firebase Auth + Firestore) */
const CLOUD_DOC = "rcf_app_data";
let cloudDb = null;
let cloudAuth = null;
let cloudUser = null;
let cloudPushTimer = null;
let cloudReady = false;

function isCloudConfigured() {
  const c = window.FIREBASE_CONFIG;
  return c?.enabled && c.apiKey && c.projectId;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initCloudSync() {
  renderCloudSyncUI();
  if (!isCloudConfigured()) {
    setCloudStatus("Sync Google: configura firebase-config.js", "warn");
    return;
  }

  try {
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js");

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    cloudAuth = firebase.auth();
    cloudDb = firebase.firestore();
    cloudReady = true;

    cloudAuth.onAuthStateChanged(async (user) => {
      cloudUser = user;
      renderCloudSyncUI();
      if (user) {
        setCloudStatus(`Conectado: ${user.email || user.displayName || "Google"}`, "ok");
        await cloudPullAndMerge();
      } else {
        setCloudStatus("Inicia sesión para guardar en tu cuenta Google", "idle");
      }
    });
  } catch (err) {
    console.error(err);
    setCloudStatus("Error al cargar sincronización", "err");
  }
}

function cloudUserRef() {
  return cloudDb.collection("users").doc(cloudUser.uid);
}

function readLocalJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function mergeFailed(local, remote) {
  const merged = { ...(remote || {}) };
  Object.entries(local || {}).forEach(([id, entry]) => {
    const cur = merged[id];
    if (!cur || (entry.failCount || 0) >= (cur.failCount || 0)) {
      merged[id] = entry;
    }
  });
  return merged;
}

function mergeArchived(local, remote) {
  const byId = {};
  [...(remote || []), ...(local || [])].forEach((e) => {
    if (!e?.id) return;
    const prev = byId[e.id];
    if (!prev || new Date(e.createdAt) > new Date(prev.createdAt)) {
      byId[e.id] = e;
    }
  });
  return Object.values(byId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 40);
}

function applyCloudData(data) {
  if (data.failed != null) {
    localStorage.setItem("rcf_failed_questions", JSON.stringify(data.failed));
  }
  if (data.archived != null) {
    localStorage.setItem("rcf_archived_exams", JSON.stringify(data.archived));
  }
  if (typeof renderFailedSection === "function") renderFailedSection();
  if (typeof renderArchivedExams === "function") renderArchivedExams();
}

async function cloudPullAndMerge() {
  if (!cloudReady || !cloudUser) return;
  try {
    setCloudStatus("Sincronizando…", "busy");
    const snap = await cloudUserRef().collection("data").doc(CLOUD_DOC).get();
    const remote = snap.exists ? snap.data() : {};
    const localFailed = readLocalJson("rcf_failed_questions", {});
    const localArchived = readLocalJson("rcf_archived_exams", []);
    const merged = {
      failed: mergeFailed(localFailed, remote.failed),
      archived: mergeArchived(localArchived, remote.archived),
      updatedAt: new Date().toISOString(),
    };
    applyCloudData(merged);
    await cloudUserRef().collection("data").doc(CLOUD_DOC).set(merged, { merge: true });
    setCloudStatus(`Sincronizado · ${cloudUser.email || "Google"}`, "ok");
  } catch (err) {
    console.error(err);
    setCloudStatus("Error al sincronizar", "err");
  }
}

function scheduleCloudPush() {
  if (!cloudReady || !cloudUser) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(cloudPushNow, 1500);
}

async function cloudPushNow() {
  if (!cloudReady || !cloudUser) return;
  try {
    const payload = {
      failed: readLocalJson("rcf_failed_questions", {}),
      archived: readLocalJson("rcf_archived_exams", []),
      updatedAt: new Date().toISOString(),
    };
    await cloudUserRef().collection("data").doc(CLOUD_DOC).set(payload, { merge: true });
  } catch (err) {
    console.error(err);
  }
}

async function cloudSignIn() {
  if (!cloudReady) {
    alert("Sincronización no configurada. Edita js/firebase-config.js con tu proyecto Firebase.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    setCloudStatus("Conectando…", "busy");
    await cloudAuth.signInWithPopup(provider);
    await cloudPullAndMerge();
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      alert("No se pudo iniciar sesión con Google.");
    }
    setCloudStatus("Inicia sesión para guardar en tu cuenta Google", "idle");
  }
}

async function cloudSignOut() {
  if (cloudAuth) await cloudAuth.signOut();
}

function setCloudStatus(text, tone) {
  const el = document.getElementById("googleSyncStatus");
  if (el) {
    el.textContent = text;
    el.dataset.tone = tone || "idle";
  }
}

function renderCloudSyncUI() {
  const signIn = document.getElementById("googleSignInBtn");
  const signOut = document.getElementById("googleSignOutBtn");
  const syncNow = document.getElementById("googleSyncNowBtn");
  if (!signIn) return;
  const logged = !!cloudUser;
  signIn.hidden = logged;
  if (signOut) signOut.hidden = !logged;
  if (syncNow) syncNow.hidden = !logged;
}

function notifyCloudDataChanged() {
  scheduleCloudPush();
}

function initCloudSyncUI() {
  document.getElementById("googleSignInBtn")?.addEventListener("click", cloudSignIn);
  document.getElementById("googleSignOutBtn")?.addEventListener("click", cloudSignOut);
  document.getElementById("googleSyncNowBtn")?.addEventListener("click", cloudPullAndMerge);
  initCloudSync();
}
