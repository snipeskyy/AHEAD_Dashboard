import { db } from "@/lib/db";
import { querySignalsByIds } from "@/lib/server/signals";

export const dynamic = "force-dynamic";
const POLL_MS = 2500;
const HEARTBEAT_MS = 15_000;

/**
 * Server-Sent Events: tails new Signal and Notification rows written by the worker (or the
 * manual-entry API) and pushes them to the browser. DB-tailing keeps web and worker decoupled.
 */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  const lastEventId = req.headers.get("last-event-id");
  let cursor =
    lastEventId && !Number.isNaN(Date.parse(lastEventId)) ? new Date(lastEventId) : new Date();
  let notifCursor = cursor;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(enc.encode(chunk));
      };
      send(`retry: 5000\n: connected\n\n`);
      const poll = async () => {
        try {
          const rows = await db.signal.findMany({
            where: { createdAt: { gt: cursor, lte: new Date() } },
            orderBy: { createdAt: "asc" },
            take: 50,
            select: { id: true, createdAt: true },
          });
          if (rows.length) {
            cursor = rows[rows.length - 1].createdAt;
            for (const s of await querySignalsByIds(rows.map((r) => r.id)))
              send(`id: ${cursor.toISOString()}\nevent: signal\ndata: ${JSON.stringify(s)}\n\n`);
          }
          const notes = await db.notification.findMany({
            where: { createdAt: { gt: notifCursor, lte: new Date() } },
            orderBy: { createdAt: "asc" },
            take: 20,
          });
          if (notes.length) {
            notifCursor = notes[notes.length - 1].createdAt;
            for (const n of notes) send(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
          }
        } catch {
          /* transient DB error; next poll retries */
        }
      };
      const pollTimer = setInterval(poll, POLL_MS);
      const beat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
