import PublicSiteLayout from "@/components/secretza/layout/PublicSiteLayout";

type CmsPageContentProps = {
  title: string;
  excerpt?: string | null;
  content: string;
};

export default function CmsPageContent({ title, excerpt, content }: CmsPageContentProps) {
  return (
    <PublicSiteLayout>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-[#8B5CF6] mb-3">Secretza</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F5F5F7]">{title}</h1>
        {excerpt && <p className="mt-4 text-[#A1A1AA]">{excerpt}</p>}
        <div
          className="prose prose-invert prose-violet mt-10 max-w-none text-[#D4D4D8]"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </article>
    </PublicSiteLayout>
  );
}
