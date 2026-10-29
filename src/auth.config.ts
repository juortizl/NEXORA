import type { NextAuthConfig } from "next-auth";

/**
 * Configuración de Auth.js sin dependencias de base de datos, reutilizable en
 * el proxy (edge-safe). Los providers se agregan en src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/presentacion") ||
        pathname.startsWith("/api/public") ||
        // tRPC y SSE aplican su propia autorización (protectedProcedure / token público).
        pathname.startsWith("/api/trpc") ||
        pathname.startsWith("/api/events") ||
        pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.companyId = token.companyId as string;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
