"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Twitter, Instagram, Youtube, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SocialLinks } from "@/lib/social-settings";

const FIELDS: {
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  icon: React.ElementType;
}[] = [
  { key: "twitter", label: "X (Twitter)", placeholder: "https://twitter.com/secretza", icon: Twitter },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/secretza", icon: Instagram },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@secretza", icon: Youtube },
  { key: "website", label: "Website", placeholder: "https://secretza.com", icon: Globe },
];

export default function AdminSocialSettings() {
  const [social, setSocial] = useState<SocialLinks>({
    twitter: "",
    instagram: "",
    youtube: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.social) setSocial(data.social);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSocial(data.social);
      toast.success("Social links saved", {
        description: "Footer icons update from these URLs. Leave blank to hide an icon.",
      });
    } catch (error) {
      toast.error("Save failed", {
        description: error instanceof Error ? error.message : "Could not save social links",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[#F5F5F7]">Social Media Links</CardTitle>
        <CardDescription className="text-xs text-[#A1A1AA]">
          Configure footer social icons. Empty fields are hidden on the public site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#A1A1AA] py-4">
            <Loader2 className="size-4 animate-spin" />
            Loading social settings...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm text-[#A1A1AA] flex items-center gap-2">
                    <Icon className="size-3.5" />
                    {label}
                  </Label>
                  <Input
                    value={social[key]}
                    onChange={(e) => setSocial((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg"
              >
                {saving ? "Saving..." : "Save Social Links"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
