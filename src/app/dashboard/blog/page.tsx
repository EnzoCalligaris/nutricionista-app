import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink as ExternalLinkIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlashToast } from "@/components/shared/flash-toast";
import { PostStatusBadge } from "@/components/blog/post-status-badge";
import { requireNutritionist } from "@/lib/auth/session";
import { countPosts, getDashboardPosts } from "@/data/blog";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * CMS do blog (prompt Fase 14 §39). Tabela a partir de `lg`; cards abaixo
 * (com a sidebar aberta, 768 px deixa ~490 px de conteúdo — decisão da
 * Fase 10).
 */
export default async function DashboardBlogPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireNutritionist();
  const { status } = await searchParams;
  const filter = status === "DRAFT" || status === "PUBLISHED" || status === "ARCHIVED" ? status : undefined;
  const posts = await getDashboardPosts({ status: filter });
  const counters = countPosts(await getDashboardPosts());

  const filters = [
    { label: `Todos (${counters.total})`, href: "/dashboard/blog", active: !filter },
    { label: `Rascunhos (${counters.drafts})`, href: "/dashboard/blog?status=DRAFT", active: filter === "DRAFT" },
    { label: `Publicados (${counters.published})`, href: "/dashboard/blog?status=PUBLISHED", active: filter === "PUBLISHED" },
    { label: `Arquivados (${counters.archived})`, href: "/dashboard/blog?status=ARCHIVED", active: filter === "ARCHIVED" },
  ];

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Artigos do site público. Rascunho nunca aparece; arquivado responde 404.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/blog"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ver no site
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
          <Button asChild>
            <Link href="/dashboard/blog/novo">
              <Plus className="size-4" aria-hidden="true" />
              Novo post
            </Link>
          </Button>
        </div>
      </div>

      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              item.active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-12 text-center" role="status">
            <p className="font-heading text-lg">Nenhum post {filter ? "com este status" : "cadastrado"}.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/blog/novo">Escrever o primeiro post</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 lg:hidden">
            {posts.map((post) => (
              <li key={post.id}>
                <Link href={`/dashboard/blog/${post.id}`} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Card className="transition-colors group-hover:bg-muted/40">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="font-heading text-lg">{post.title}</CardTitle>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <CardDescription>
                        /blog/{post.slug}
                        {post.categoryName ? ` · ${post.categoryName}` : ""}
                      </CardDescription>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <PostStatusBadge status={post.status} />
                        <span className="text-xs text-muted-foreground">
                          {post.status === "PUBLISHED" ? `publicado em ${formatDate(post.publishedAt)}` : `atualizado em ${formatDate(post.updatedAt)}`}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Publicado em</TableHead>
                      <TableHead className="sr-only">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium">{post.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">/blog/{post.slug}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{post.categoryName ?? "—"}</TableCell>
                        <TableCell>
                          <PostStatusBadge status={post.status} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{formatDate(post.publishedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/blog/${post.id}`} className="text-sm text-primary hover:underline">
                            Editar
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
