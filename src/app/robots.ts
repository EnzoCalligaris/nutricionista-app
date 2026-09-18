import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Áreas autenticadas e rotas de auth nunca entram em índice.
        disallow: ["/dashboard", "/paciente", "/auth/", "/login", "/esqueci-senha", "/redefinir-senha"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
