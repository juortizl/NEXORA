import { Suspense } from "react";
import { QuoteBuilder } from "@/components/quote/quote-builder";

export const metadata = { title: "Cotizador" };

export default function QuotePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando cotizador…</div>}>
      <QuoteBuilder />
    </Suspense>
  );
}
