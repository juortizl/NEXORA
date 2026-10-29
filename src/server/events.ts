import { EventEmitter } from "node:events";

/**
 * Bus de eventos en proceso para tiempo real (SSE). Funciona en una sola
 * instancia (Render web service). Para escalar horizontalmente, reemplazar
 * por Pusher/Ably/Redis pub-sub manteniendo esta misma interfaz.
 */
export type RealtimeEvent =
  | { type: "unit.updated"; projectId: string; unitId: string; status: string }
  | { type: "lead.updated"; projectId: string; leadId: string; stage: string }
  | { type: "quote.created"; projectId: string; quoteId: string; unitId: string }
  | { type: "project.updated"; projectId: string };

const globalForEvents = globalThis as unknown as { realtimeBus?: EventEmitter };

export const realtimeBus = globalForEvents.realtimeBus ?? new EventEmitter();
realtimeBus.setMaxListeners(500);
if (process.env.NODE_ENV !== "production") globalForEvents.realtimeBus = realtimeBus;

export function publish(event: RealtimeEvent) {
  realtimeBus.emit(`project:${event.projectId}`, event);
}

export function subscribe(projectId: string, handler: (e: RealtimeEvent) => void) {
  const channel = `project:${projectId}`;
  realtimeBus.on(channel, handler);
  return () => realtimeBus.off(channel, handler);
}
