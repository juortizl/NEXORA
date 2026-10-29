"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ProjectDetail = RouterOutputs["project"]["bySlug"];
export type UnitListItem = RouterOutputs["unit"]["list"][number];

const ProjectContext = createContext<ProjectDetail | null>(null);

export function ProjectProvider({ project, children }: { project: ProjectDetail; children: ReactNode }) {
  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectDetail {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject debe usarse dentro de ProjectProvider");
  return ctx;
}
