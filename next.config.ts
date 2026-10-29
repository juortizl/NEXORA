import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renderizado dinámico convencional: la app depende de sesión y base de datos
  // en casi todas las rutas, por lo que no activamos cacheComponents.
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
