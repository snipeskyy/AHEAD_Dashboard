/** Fetch a JSON download from the API and save it with the server's file name. */
export async function downloadFrom(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error ?? "Download failed");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "acc.json";
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = Object.assign(window.document.createElement("a"), { href, download: name });
  a.click();
  URL.revokeObjectURL(href);
  return name;
}

export async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > 25 * 1024 * 1024) throw new Error("Pack files are limited to 25 MB");
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON");
  }
}
