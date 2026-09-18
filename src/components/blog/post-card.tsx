import Image from "next/image";
import Link from "next/link";
import type { PublicPostSummary } from "@/data/blog";
import { formatDate } from "@/lib/dates";

export function PostCard({ post }: { post: PublicPostSummary }) {
  return (
    <article className="group flex h-full flex-col">
      <Link href={`/blog/${post.slug}`} className="block overflow-hidden rounded-[1.25rem] bg-secondary">
        <div className="relative aspect-[16/10]">
          {post.coverImageUrl ? (
            <Image
              src={post.coverImageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
            />
          ) : (
            <div aria-hidden="true" className="flex h-full items-center justify-center">
              <span className="font-heading text-3xl text-primary/30">EM</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <p className="text-xs text-muted-foreground">
          {post.category ? <span>{post.category.name} · </span> : null}
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </p>
        <h3 className="mt-2 font-heading text-xl font-medium leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:underline underline-offset-4">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
      </div>
    </article>
  );
}
