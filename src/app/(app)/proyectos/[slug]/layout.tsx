import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { api } from "@/trpc/server";
import { ProjectNav } from "@/components/project/project-nav";
import { ProjectProvider } from "@/components/project/project-context";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await api();
  let project;
  try {
    project = await caller.project.bySlug({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  return (
    <ProjectProvider project={project}>
      <div
        className="flex flex-1"
        style={
          {
            "--project-primary": project.primaryColor,
            "--project-secondary": project.secondaryColor,
            "--project-accent": project.accentColor,
          } as React.CSSProperties
        }
      >
        <ProjectNav project={{ slug: project.slug, name: project.name, stage: project.stage, publicToken: project.publicToken, accentColor: project.accentColor }} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ProjectProvider>
  );
}
