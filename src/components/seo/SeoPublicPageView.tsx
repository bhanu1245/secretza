import PublicSiteLayout from "@/components/secretza/layout/PublicSiteLayout";
import SeoPageView, { type SeoPageViewProps } from "@/components/seo/SeoPageView";

export type SeoPublicPageViewProps = SeoPageViewProps;

/** Standard public SEO shell: PublicSiteLayout → SeoPageView (Ahmedabad reference). */
export default function SeoPublicPageView(props: SeoPublicPageViewProps) {
  return (
    <PublicSiteLayout>
      <SeoPageView {...props} />
    </PublicSiteLayout>
  );
}

export { SeoPageView };
