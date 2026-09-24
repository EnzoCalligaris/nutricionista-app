import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PostForm } from "@/components/blog/post-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getBlogCategories } from "@/data/blog";

export const metadata: Metadata = { title: "Novo post" };
export const dynamic = "force-dynamic";

/** Novo post: nasce como RASCUNHO, nunca publicado direto (prompt §39). */
export default async function NovoPostPage() {
  await requireNutritionist();
  const categories = await getBlogCategories();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/blog" className="hover:underline">
            Blog
          </Link>{" "}
          / Novo
        </p>
        <h1 className="font-heading text-2xl font-medium">Novo post</h1>
        <p className="text-sm text-muted-foreground">
          O post nasce como rascunho — só aparece no site depois que você publicar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Conteúdo</CardTitle>
          <CardDescription>HTML não é aceito: a formatação usa a sintaxe explicada abaixo do editor.</CardDescription>
        </CardHeader>
        <CardContent>
          <PostForm post={null} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
