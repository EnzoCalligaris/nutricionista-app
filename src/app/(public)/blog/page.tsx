import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { PostCard } from "@/components/blog/post-card";
import { getPublishedPosts } from "@/data/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Conteúdos sobre nutrição no dia a dia, planejamento alimentar e acompanhamento, escritos por Enzo Mangili.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <>
      <Section size="compact" className="pb-6 sm:pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Blog"
          title="Nutrição para a vida real."
          lead="Textos curtos sobre alimentação, rotina e acompanhamento — sem fórmula mágica."
        />
      </Section>

      <Section className="pt-6 sm:pt-8">
        {!posts.ok ? (
          <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            O blog está temporariamente indisponível.
          </p>
        ) : posts.data.length === 0 ? (
          <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Os primeiros artigos estão a caminho.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {posts.data.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
