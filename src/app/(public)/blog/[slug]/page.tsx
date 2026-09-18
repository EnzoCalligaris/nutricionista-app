import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { RichContent, richContentIsEmpty } from "@/components/blog/rich-content";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublishedPostBySlug } from "@/data/blog";
import { formatDate } from "@/lib/dates";
import { siteConfig } from "@/config/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post.ok || !post.data) return { title: "Artigo não encontrado" };

  const title = post.data.seoTitle ?? post.data.title;
  const description = post.data.metaDescription ?? post.data.excerpt ?? siteConfig.description;
  const image = post.data.ogImageUrl ?? post.data.coverImageUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.data.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${post.data.slug}`,
      publishedTime: post.data.publishedAt,
      authors: [post.data.authorName],
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const result = await getPublishedPostBySlug(slug);

  if (!result.ok) {
    return (
      <Container className="py-20">
        <p role="status" className="text-sm text-muted-foreground">
          O artigo está temporariamente indisponível.
        </p>
      </Container>
    );
  }

  const post = result.data;
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    datePublished: post.publishedAt,
    author: { "@type": "Person", name: post.authorName },
    image: post.coverImageUrl ?? undefined,
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
  };

  return (
    <article className="py-14 sm:py-20">
      <Container className="max-w-3xl">
        <JsonLd data={jsonLd} />
        <p className="text-xs text-muted-foreground">
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
          {post.category ? <> · {post.category.name}</> : null}
        </p>
        <h1 className="mt-4 font-heading text-4xl font-medium leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
        <p className="mt-6 text-sm text-muted-foreground">
          Por {post.authorName} · <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </p>

        {post.coverImageUrl ? (
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-secondary">
            <Image src={post.coverImageUrl} alt="" fill priority sizes="(min-width: 768px) 48rem, 100vw" className="object-cover" />
          </div>
        ) : null}

        <div className="prose-em mt-10">
          {richContentIsEmpty(post.content) ? (
            <p className="text-muted-foreground">Este artigo ainda não tem conteúdo publicado.</p>
          ) : (
            <RichContent content={post.content} />
          )}
        </div>

        {post.tags.length > 0 ? (
          <ul className="mt-12 flex flex-wrap gap-2 border-t border-border pt-6" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag.slug} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {tag.name}
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </article>
  );
}
