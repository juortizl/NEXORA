import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersAdmin } from "@/components/admin/users-admin";

export const metadata = { title: "Administración" };

export default async function AdminPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/proyectos");
  return <UsersAdmin />;
}
