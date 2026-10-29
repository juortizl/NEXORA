import { UnitDetail } from "@/components/inventory/unit-detail";

export const metadata = { title: "Ficha de apartamento" };

export default async function UnitPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
  return <UnitDetail unitId={id} />;
}
