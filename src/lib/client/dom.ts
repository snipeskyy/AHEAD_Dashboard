/** Small imperative DOM helpers (kept out of components so render stays pure). */
export function applyAccent(accent: string) {
  document.documentElement.setAttribute("data-accent", accent);
}

/** Role visibility: space-separated hidden field keys on <html>, matched by CSS `[data-field~=...]`. */
export function applyRoleHidden(keys: readonly string[]) {
  if (keys.length) document.documentElement.setAttribute("data-role-hide", keys.join(" "));
  else document.documentElement.removeAttribute("data-role-hide");
}
