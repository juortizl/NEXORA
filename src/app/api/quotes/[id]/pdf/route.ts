import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "@/auth";
import { createCaller } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { QuotePdf } from "@/components/quote/quote-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const caller = createCaller(await createTRPCContext({ headers: req.headers }));
  const quote = await caller.quote.byId({ id });

  // renderToBuffer espera un elemento <Document>; QuotePdf lo devuelve como raíz.
  const element = createElement(QuotePdf, { quote }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  const filename = `cotizacion-${quote.unit.code}-v${quote.version}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
