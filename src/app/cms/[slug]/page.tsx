import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

type CmsPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const pages = await db.$queryRaw<Array<{ slug: string }>>`
    SELECT slug FROM CmsPage WHERE isPublished = 1
  `;
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pages = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM CmsPage WHERE slug = ${slug} LIMIT 1
  `;
  const page = pages[0];
  if (!page || !page.isPublished) return { title: "Page Not Found | Secretza" };

  return {
    title: page.seoTitle || `${page.title} | Secretza`,
    description: page.metaDescription || page.excerpt || undefined,
  };
}

export default async function CmsPage({ params }: CmsPageProps) {
  const { slug } = await params;
  const pages = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM CmsPage WHERE slug = ${slug} LIMIT 1
  `;
  const page = pages[0];
  if (!page || !page.isPublished) notFound();

  return (
    <main className="min-h-screen bg-[#0B0B0F] pt-24 pb-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm text-[#8B5CF6] mb-3">Secretza</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F5F5F7]">{page.title}</h1>
        {page.excerpt && <p className="mt-4 text-[#A1A1AA]">{page.excerpt}</p>}
        <div
          className="prose prose-invert prose-violet mt-10 max-w-none text-[#D4D4D8]"
          dangerouslySetInnerHTML={{ __html: page.content.replace(/\n/g, "<br />") }}
        />
      </article>
    </main>
  );
}
