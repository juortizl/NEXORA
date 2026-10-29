import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";

export const metadata = { title: "Comparador" };

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando comparador…</div>}>
      <CompareView />
    </Suspense>
  );
}
