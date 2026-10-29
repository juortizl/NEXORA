import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
try {
  const users = await db.user.findMany({
    select: { email: true, role: true, name: true, passwordHash: true },
  });
  console.log("users:", users.length);
  for (const u of users) {
    const okAdmin = await bcrypt.compare("Admin123*", u.passwordHash);
    const okAsesor = await bcrypt.compare("Asesor123*", u.passwordHash);
    console.log(`- ${u.email} (${u.role}) hashLen=${u.passwordHash?.length} Admin123*=${okAdmin} Asesor123*=${okAsesor}`);
  }
  if (users.length === 0) console.log("BD vacía: hay que reseedar.");
} finally {
  await db.$disconnect();
}
