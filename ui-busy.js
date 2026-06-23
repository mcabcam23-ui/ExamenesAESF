/** Evita bloqueos de UI: cede el hilo y muestra overlay de carga */
function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let _busyLock = false;

function setAppBusy(on, message = "Procesando…") {
  const el = document.getElementById("appBusy");
  const msg = document.getElementById("appBusyMsg");
  if (!el) return;
  if (on) {
    if (msg) msg.textContent = message;
    el.hidden = false;
    _busyLock = true;
  } else {
    el.hidden = true;
    _busyLock = false;
  }
}

function isAppBusy() {
  return _busyLock;
}

async function withBusy(message, task) {
  if (_busyLock) return null;
  setAppBusy(true, message);
  try {
    await yieldToMain();
    return await task();
  } finally {
    setAppBusy(false);
  }
}
