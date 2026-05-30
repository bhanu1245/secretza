import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CMS_SLUG_ALIASES } from "@/lib/footer-routes";
import CmsPageContent from "@/components/secretza/cms/CmsPageContent";

type CmsPageProps = {
  params: Promise<{ slug: string }>;
};

function resolveCmsSlug(slug: string): string {
  return CMS_SLUG_ALIASES[slug] ?? slug;
}

async function loadPublishedPage(slug: string) {
  const resolved = resolveCmsSlug(slug);
  const pages = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM CmsPage WHERE slug = ${resolved} LIMIT 1
  `;
  const page = pages[0];
  if (!page || !page.isPublished) return null;
  return page;
}

export async function generateStaticParams() {
  const pages = await db.$queryRaw<Array<{ slug: string }>>`
    SELECT slug FROM CmsPage WHERE isPublished = 1
  `;
  const aliases = Object.keys(CMS_SLUG_ALIASES).map((slug) => ({ slug }));
  return [...pages.map((page) => ({ slug: page.slug })), ...aliases];
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublishedPage(slug);
  if (!page) return { title: "Page Not Found | Secretza" };

  return {
    title: (page.seoTitle as string) || `${page.title as string} | Secretza`,
    description: (page.metaDescription as string) || (page.excerpt as string) || undefined,
  };
}

export default async function CmsPage({ params }: CmsPageProps) {
  const { slug } = await params;
  const page = await loadPublishedPage(slug);
  if (!page) notFound();

  return (
    <CmsPageContent
      title={String(page.title)}
      excerpt={page.excerpt ? String(page.excerpt) : null}
      content={String(page.content)}
    />
  );
}
