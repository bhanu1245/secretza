"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  User,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Globe,
  CreditCard,
  X,
  FileText,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, useUIStore } from "@/store/useAppStore";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useApiData";
import { usePublicNavigation } from "@/hooks/usePublicNavigation";
import { ADMIN_HOME, isAdminRole } from "@/lib/admin-nav";
import Logo from "@/components/brand/Logo";

export default function Header() {
  const router = useRouter();
  const {
    goHome,
    goCategory,
    goSearch,
    goPricing,
    goPostAd,
    goDashboard,
  } = usePublicNavigation();
  const { isAuthenticated, user, setAuthModalOpen, setAuthModalTab, logout } =
    useAuthStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Fetch categories from API (replaces mock-data import)
  const { categories } = useCategories();

  const isAdminOrMod = isAdminRole(user?.role);
  const dashboardLabel = isAdminOrMod ? "Admin Panel" : "Dashboard";
  const DashboardIcon = isAdminOrMod ? Shield : LayoutDashboard;

  const goToDashboard = () => {
    if (isAdminOrMod) {
      router.push(ADMIN_HOME);
    } else {
      goDashboard();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(searchQuery.trim() || undefined);
    setSearchQuery("");
  };

  const handlePostAd = () => {
    if (!isAuthenticated) {
      setAuthModalTab("register");
      setAuthModalOpen(true);
      return;
    }
    goPostAd();
  };

  const handleLogin = () => {
    setAuthModalTab("login");
    setAuthModalOpen(true);
  };

  const handleRegister = () => {
    setAuthModalTab("register");
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    logout();
    toast.success("Signed out", { description: "You have been logged out." });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 min-w-0 items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <button
            onClick={goHome}
            className="flex items-center shrink-0 group"
            aria-label="SecretZa home"
          >
            <Logo variant="full" theme="dark" />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goHome}
              className="text-muted-foreground hover:text-foreground"
            >
              Browse
            </Button>

            {/* Categories Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setIsCategoryOpen(true)}
              onMouseLeave={() => setIsCategoryOpen(false)}
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1"
              >
                Categories
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    isCategoryOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {/* Categories mega-dropdown */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${
                  isCategoryOpen
                    ? "opacity-100 visible translate-y-0"
                    : "opacity-0 invisible -translate-y-1"
                }`}
              >
                <div className="w-full max-w-md rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
                    All Categories
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {categories
                      .filter((c) => c.isActive)
                      .map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => goCategory(cat.slug)}
                          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-light transition-colors text-left"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground/60">
                            {cat.listingCount.toLocaleString()}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goPricing}
              className="text-muted-foreground hover:text-foreground"
            >
              <CreditCard className="size-4 mr-1" />
              Pricing
            </Button>
          </nav>

          {/* Desktop Search */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center flex-1 max-w-xs"
          >
            <div className="relative w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-violet transition-colors" />
              <Input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 h-9 bg-surface-light/50 border-border focus:border-violet/50 focus:ring-violet/20 text-sm placeholder:text-muted-foreground/60 rounded-lg"
              />
            </div>
          </form>

          {/* Right Side Actions */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => goSearch()}
            >
              <Search className="size-5" />
            </Button>

            {/* Post Ad Button */}
            <Button
              onClick={handlePostAd}
              className="hidden sm:flex gradient-violet hover:opacity-90 text-white font-semibold shadow-md shadow-violet-glow border-0 gap-1.5"
              size="sm"
            >
              <Plus className="size-4" />
              Post Ad
            </Button>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-w-0 items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-surface-light transition-colors sm:pr-3">
                    <Avatar className="size-8 ring-2 ring-violet/30">
                      <AvatarImage
                        src={user.avatar || undefined}
                        alt={user.name || "User"}
                      />
                      <AvatarFallback className="bg-violet/20 text-violet text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:block max-w-[100px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-surface border-border"
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                      {user.isPremium && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet uppercase tracking-wider mt-0.5">
                          <Globe className="size-3" />
                          Premium
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={goToDashboard}
                      className="cursor-pointer"
                    >
                      <DashboardIcon className="size-4" />
                      {dashboardLabel}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => goDashboard("listings")}
                      className="cursor-pointer"
                    >
                      <FileText className="size-4" />
                      My Listings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handlePostAd}
                      className="cursor-pointer"
                    >
                      <Plus className="size-4" />
                      Post Ad
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    variant="destructive"
                    className="cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogin}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Login
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegister}
                  className="gradient-violet hover:opacity-90 text-white font-semibold border-0 shadow-sm"
                >
                  Register
                </Button>
              </div>
            )}

            {/* Mobile Hamburger */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-muted-foreground hover:text-foreground"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full max-w-sm bg-surface border-border p-0"
              >
                <SheetHeader className="p-4 pb-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Logo variant="mobile" theme="dark" iconSize={32} />
                      <SheetTitle className="sr-only">SecretZa Menu</SheetTitle>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                  {/* Mobile Search */}
                  <div className="p-4">
                    <form onSubmit={handleSearch}>
                      <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search listings..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-3 h-10 bg-surface-light/50 border-border focus:border-violet/50 text-sm rounded-lg"
                        />
                      </div>
                    </form>
                  </div>

                  <Separator className="bg-border" />

                  {/* Mobile Nav Links */}
                  <div className="p-2">
                    <MobileNavLink
                      icon={<Globe className="size-4" />}
                      label="Browse"
                      onClick={() => {
                        goHome();
                        setMobileMenuOpen(false);
                      }}
                    />

                    {/* Categories Section */}
                    <div className="mt-2">
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Categories
                      </p>
                      {categories
                        .filter((c) => c.isActive)
                        .slice(0, 6)
                        .map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              goCategory(cat.slug);
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-light transition-colors text-left"
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground/50">
                              {cat.listingCount.toLocaleString()}
                            </span>
                          </button>
                        ))}
                    </div>

                    <Separator className="bg-border my-2" />

                    <MobileNavLink
                      icon={<CreditCard className="size-4" />}
                      label="Pricing"
                      onClick={() => {
                        goPricing();
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>

                  <Separator className="bg-border" />

                  {/* Auth / User Section */}
                  <div className="p-4">
                    {isAuthenticated && user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="size-10 ring-2 ring-violet/30">
                            <AvatarImage
                              src={user.avatar || undefined}
                              alt={user.name || "User"}
                            />
                            <AvatarFallback className="bg-violet/20 text-violet text-sm font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            goToDashboard();
                            setMobileMenuOpen(false);
                          }}
                        >
                          <DashboardIcon className="size-4" />
                          {dashboardLabel}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            goDashboard("listings");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <FileText className="size-4" />
                          My Listings
                        </Button>
                        <Separator className="bg-border my-2" />
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            handleSignOut();
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LogOut className="size-4" />
                          Logout
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full border-border text-foreground hover:bg-surface-light"
                          onClick={() => {
                            handleLogin();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Login
                        </Button>
                        <Button
                          className="w-full gradient-violet hover:opacity-90 text-white font-semibold border-0"
                          onClick={() => {
                            handleRegister();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Register
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Post Ad CTA */}
                <div className="p-4 border-t border-border">
                  <Button
                    className="w-full gradient-violet hover:opacity-90 text-white font-semibold border-0 gap-2 h-11"
                    onClick={handlePostAd}
                  >
                    <Plus className="size-4" />
                    Post Free Ad
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNavLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-light transition-colors text-left"
    >
      {icon}
      {label}
    </button>
  );
}
