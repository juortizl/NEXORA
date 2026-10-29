"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/trpc/react";
import type { RealtimeEvent } from "@/server/events";

/**
 * Se conecta al canal SSE del proyecto e invalida las consultas afectadas.
 * Devuelve el estado de conexión para mostrar un indicador "en vivo".
 */
export function useRealtime(params: { projectId?: string; token?: string }, onEvent?: (e: RealtimeEvent) => void) {
  const utils = trpc.useUtils();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  useEffect(() => {
    if (!params.projectId && !params.token) return;
    const qs = params.token ? `token=${params.token}` : `projectId=${params.projectId}`;
    const es = new EventSource(`/api/events?${qs}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as RealtimeEvent | { type: "connected" };
        if (event.type === "connected") return;
        setLastEvent(event);
        onEvent?.(event);
        switch (event.type) {
          case "unit.updated":
          case "project.updated":
            void utils.unit.invalidate();
            void utils.dashboard.invalidate();
            void utils.reservation.invalidate();
            break;
          case "lead.updated":
            void utils.crm.invalidate();
            void utils.dashboard.invalidate();
            break;
          case "quote.created":
            void utils.quote.invalidate();
            void utils.crm.invalidate();
            break;
        }
      } catch {
        // ignorar mensajes malformados
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, params.token]);

  return { connected, lastEvent };
}
