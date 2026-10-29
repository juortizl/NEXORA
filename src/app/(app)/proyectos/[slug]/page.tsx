import { Suspense } from "react";
import { ProjectViewer } from "@/components/viewer/project-viewer";

export const metadata = { title: "Visor 3D" };

export default function ProjectViewerPage() {
  return (
    <Suspense>
      <ProjectViewer />
    </Suspense>
  );
}
