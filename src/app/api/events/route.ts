import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscribe } from "@/server/events";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events por proyecto. Acepta sesión (app interna) o token
 * público (modo presentación).
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const token = req.nextUrl.searchParams.get("token");
  let resolvedProjectId = projectId;

  if (token) {
    const p = await db.project.findUnique({ where: { publicToken: token }, select: { id: true } });
    if (!p) return new Response("Not found", { status: 404 });
    resolvedProjectId = p.id;
  } else {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
  }
  if (!resolvedProjectId) return new Response("projectId requerido", { status: 400 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      send({ type: "connected", projectId: resolvedProjectId });
      unsubscribe = subscribe(resolvedProjectId!, send);
      keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000);
    },
    cancel() {
      unsubscribe?.();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
