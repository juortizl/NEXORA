import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Protege todas las rutas excepto las públicas definidas en authConfig.authorized.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|models|images|.*\\.(?:png|jpg|jpeg|svg|glb|webp|ico)$).*)"],
};
