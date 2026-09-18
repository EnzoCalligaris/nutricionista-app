import { describe, expect, it } from "vitest";
import { filterVisiblePosts, isPostPubliclyVisible } from "@/domain/blog/visibility";

const now = new Date("2026-09-18T12:00:00Z");

describe("isPostPubliclyVisible", () => {
  it("PUBLISHED com published_at no passado é visível", () => {
    expect(isPostPubliclyVisible({ status: "PUBLISHED", published_at: "2026-09-01T00:00:00Z" }, now)).toBe(true);
  });

  it("DRAFT nunca é visível", () => {
    expect(isPostPubliclyVisible({ status: "DRAFT", published_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
  });

  it("ARCHIVED não é visível", () => {
    expect(isPostPubliclyVisible({ status: "ARCHIVED", published_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
  });

  it("PUBLISHED agendado para o futuro ainda não é visível", () => {
    expect(isPostPubliclyVisible({ status: "PUBLISHED", published_at: "2026-12-01T00:00:00Z" }, now)).toBe(false);
  });

  it("PUBLISHED sem published_at não é visível", () => {
    expect(isPostPubliclyVisible({ status: "PUBLISHED", published_at: null }, now)).toBe(false);
  });
});

describe("filterVisiblePosts", () => {
  it("filtra só os visíveis", () => {
    const posts = [
      { id: 1, status: "PUBLISHED" as const, published_at: "2026-09-01T00:00:00Z" },
      { id: 2, status: "DRAFT" as const, published_at: null },
      { id: 3, status: "PUBLISHED" as const, published_at: "2027-01-01T00:00:00Z" },
    ];
    expect(filterVisiblePosts(posts, now).map((p) => p.id)).toEqual([1]);
  });
});
