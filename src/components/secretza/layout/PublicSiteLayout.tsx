import Header from "@/components/secretza/layout/Header";
import Footer from "@/components/secretza/layout/Footer";
import MobileBottomNav from "@/components/secretza/layout/MobileBottomNav";

type PublicSiteLayoutProps = {
  children: React.ReactNode;
};

/** Shared public shell: logo header, navigation, footer — same as homepage. */
export default function PublicSiteLayout({ children }: PublicSiteLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20 pb-16 md:pb-12">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  );
}
