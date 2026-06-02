import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCategoryUrl, truncate } from "@/lib/seo-ssr";
import { resolvePublicSeoMetadata } from "@/lib/seo-helpers";
import { loadCategorySeoPageView } from "@/lib/seo-public-page";
import SeoPublicPageView from "@/components/seo/SeoPublicPageView";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
    include: {
      children: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!category) {
    return { title: "Category Not Found | SecretZa" };
  }

  const categoryIds = [category.id, ...category.children.map((child) => child.id)];
  const total = await db.listing.count({
    where: {
      status: "approved",
      OR: [
        { categoryId: { in: categoryIds } },
        { subcategoryId: { in: categoryIds } },
      ],
    },
  });
  const fullUrl = buildCategoryUrl(category.slug);
  const title = `${category.name} - ${total} Listings | SecretZa`;
  const description = truncate(
    category.seoDescription ||
      category.description ||
      `Browse ${total} ${category.name} listings on SecretZa. Find the best ${category.name.toLowerCase()} services worldwide.`,
  );

  return resolvePublicSeoMetadata("category", slug, {
    title,
    metaDescription: description,
    canonicalUrl: fullUrl,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const view = await loadCategorySeoPageView(slug);

  if (!view) {
    notFound();
  }

  return <SeoPublicPageView {...view} />;
}
