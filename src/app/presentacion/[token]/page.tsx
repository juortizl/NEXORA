import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { api } from "@/trpc/server";
import { PresentationPlayer } from "@/components/presentation/presentation-player";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  try {
    const caller = await api();
    const project = await caller.project.byPublicToken({ token });
    return {
      title: `${project.name} · Presentación`,
      description: project.tagline ?? project.description ?? undefined,
    };
  } catch {
    return { title: "Presentación" };
  }
}

export default async function PresentationPage({ params }: Props) {
  const { token } = await params;
  const caller = await api();
  let project;
  try {
    project = await caller.project.byPublicToken({ token });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return <PresentationPlayer token={token} initialProject={project} />;
}
