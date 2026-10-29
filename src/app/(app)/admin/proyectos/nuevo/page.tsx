import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProjectWizard } from "@/components/admin/project-wizard";

export const metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/proyectos");
  return <ProjectWizard />;
}
