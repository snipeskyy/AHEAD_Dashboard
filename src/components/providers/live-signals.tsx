"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useModuleSettings } from "@/hooks/use-module-settings";
import type { SignalRow } from "@/lib/server/signals";

type Listener = (s: SignalRow) => void;
interface LiveCtx {
  status: "connecting" | "live" | "reconnecting";
  subscribe: (fn: Listener) => () => void;
}
const Ctx = createContext<LiveCtx>({ status: "connecting", subscribe: () => () => {} });
export const useLiveSignals = () => useContext(Ctx);

/**
 * One EventSource per tab (/api/stream/signals). Fans new signals out to subscribers,
 * refreshes dashboard caches, and raises in-app (and optional desktop) alerts above the threshold.
 */
export function LiveSignalsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const routerRef = useRef(router);
  const settings = useModuleSettings<{ alertThreshold: number; desktopNotifications: boolean }>(
    "signals",
  );
  const listeners = useRef(new Set<Listener>());
  const settingsRef = useRef(settings);
  const [status, setStatus] = useState<LiveCtx["status"]>("connecting");

  useEffect(() => {
    settingsRef.current = settings;
    routerRef.current = router;
  }, [settings, router]);

  useEffect(() => {
    const es = new EventSource("/api/stream/signals");
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["meta"] });
      }, 1500);
    };
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus("reconnecting");
    es.addEventListener("signal", (e) => {
      const s = JSON.parse((e as MessageEvent).data) as SignalRow;
      listeners.current.forEach((fn) => fn(s));
      scheduleRefresh();
      const { alertThreshold, desktopNotifications } = settingsRef.current;
      if (s.relevance >= alertThreshold) {
        toast(`${s.accountName}`, {
          description: s.title,
          action: {
            label: "Open",
            onClick: () => routerRef.current.push(`/signals?focus=${s.id}`),
          },
        });
        if (
          desktopNotifications &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          new Notification(`${s.accountName} · relevance ${Math.round(s.relevance)}`, {
            body: s.title,
            tag: s.id,
          });
        }
      }
    });
    es.addEventListener("notification", () =>
      qc.invalidateQueries({ queryKey: ["notifications"] }),
    );
    return () => {
      clearTimeout(refreshTimer);
      es.close();
    };
  }, [qc]);

  const value: LiveCtx = {
    status,
    subscribe: (fn) => {
      listeners.current.add(fn);
      return () => listeners.current.delete(fn);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
