// Return only to an actual local catalog route. Never trust an arbitrary URL.
export function catalogReturn(raw) {
  if (typeof raw !== "string" || raw.length > 1800 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) return null;
  let u;
  try { u = new URL(raw, "https://catalog.invalid"); } catch { return null; }
  if (u.origin !== "https://catalog.invalid" || !/^\/(?:shop|collections\/[a-z0-9-]+|designs\/(?:collections(?:\/[a-z0-9-]+)?|famme\/collections\/(?:all|jeans|softy|layers)|starter\/(?:shop|collections\/[a-z0-9-]+)))\/?$/.test(u.pathname)) return null;
  for (const key of [...u.searchParams.keys()])
    if (!key.startsWith("f.") && !["q", "min", "max", "available", "sort", "view", "lang", "locale", "market"].includes(key)) u.searchParams.delete(key);
  if (u.hash && !/^#product-[a-z0-9-]+$/.test(u.hash)) u.hash = "";
  return u.pathname + u.search + u.hash;
}
const link = typeof document === "undefined" ? null : document.querySelector("[data-catalog-return]");
if (link) {
  const target = catalogReturn(new URL(location.href).searchParams.get("return"));
  if (target) { link.href = target; link.hidden = false; }
}
