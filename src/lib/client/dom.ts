/** Small imperative DOM helpers (kept out of components so render stays pure). */
export function applyAccent(accent: string) {
  document.documentElement.setAttribute("data-accent", accent);
}
