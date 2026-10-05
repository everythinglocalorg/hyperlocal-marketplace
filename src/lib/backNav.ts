// One-shot "return here" memory for back buttons. When a page sends a user into
// a product/vendor detail, it remembers the exact URL to come back to (e.g. the
// pizza search results) so the detail page's back arrow restores it instead of
// landing on a stale/blank page.

const KEY = "el_back_to";

export function rememberBackTo(url: string) {
  try { sessionStorage.setItem(KEY, url); } catch { /* storage blocked */ }
}

export function consumeBackTo(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch { return null; }
}

export function clearBackTo() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}
