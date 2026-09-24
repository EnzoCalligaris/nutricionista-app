import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { PostForm } from "@/components/blog/post-form";
import { PostActions } from "@/components/blog/post-actions";
import { PostCoverField } from "@/components/blog/post-cover-field";
import { PostStatusBadge } from "@/components/blog/post-status-badge";
import { requireNutritionist } from "@/lib/auth/session";
import { blogAssetPublicUrl, getBlogCategories, getDashboardPost } from "@/data/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getDashboardPost(id);
  return { title: post ? post.title : "Post" };
}

/** Edição do post (prompt Fase 14 §39–§42). */
export default async function EditarPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNutritionist();
  const { id } = await params;
  const [post, categories] = await Promise.all([getDashboardPost(id), getBlogCategories()]);
  if (!post) notFound();

  const coverUrl = await blogAssetPublicUrl(post.coverImagePath);

  return (
    <div className="space-y-6">
      <FlashToast />
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/blog" className="hover:underline">
            Blog
          </Link>{" "}
          / {post.title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium">{post.title}</h1>
          <PostStatusBadge status={post.status} />
          {post.status === "PUBLISHED" ? (
            <a
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver no site
              <ExternalLinkIcon className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Conteúdo</CardTitle>
          </CardHeader>
          <CardContent>
            <PostForm post={post} categories={categories} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              <PostActions post={post} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Imagem de capa</CardTitle>
              <CardDescription>Bucket público de assets institucionais — nada de foto de paciente aqui.</CardDescription>
            </CardHeader>
            <CardContent>
              <PostCoverField postId={post.id} currentUrl={coverUrl} />
            </CardContent>
          </Card>

          {post.aliases.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base">Endereços antigos</CardTitle>
                <CardDescription>Redirecionam para o endereço atual, então nenhum link publicado quebra.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {post.aliases.map((alias) => (
                    <li key={alias}>
                      <code>/blog/{alias}</code>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
