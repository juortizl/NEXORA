import { BuyerProfile } from "@/components/crm/buyer-profile";

export const metadata = { title: "Ficha de comprador" };

export default async function BuyerPage({ params }: { params: Promise<{ slug: string; buyerId: string }> }) {
  const { buyerId } = await params;
  return <BuyerProfile buyerId={buyerId} />;
}
