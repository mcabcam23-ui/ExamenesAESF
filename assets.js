/** Resuelve rutas de assets usando APP_BASE (definido en index.html) */
window.assetUrl = function assetUrl(path) {
  if (!path) return window.APP_BASE || "/";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const base = window.APP_BASE || "/";
  const clean = String(path).replace(/^\//, "");
  return `${base}${clean}`;
};
