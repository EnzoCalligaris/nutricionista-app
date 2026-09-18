import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getPublishedPostSlugs } from "@/data/blog";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/metodo-em", priority: 0.9, changeFrequency: "monthly" },
  { path: "/sobre", priority: 0.8, changeFrequency: "monthly" },
  { path: "/acompanhamento", priority: 0.8, changeFrequency: "monthly" },
  { path: "/planos", priority: 0.9, changeFrequency: "monthly" },
  { path: "/resultados", priority: 0.6, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contato", priority: 0.5, changeFrequency: "yearly" },
  { path: "/agendar", priority: 0.7, changeFrequency: "monthly" },
  { path: "/politica-de-privacidade", priority: 0.2, changeFrequency: "yearly" },
  { path: "/termos", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const posts = await getPublishedPostSlugs();

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: `${base}${route.path}`,
      priority: route.priority,
      changeFrequency: route.changeFrequency,
    })),
    ...posts.data.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];
}
