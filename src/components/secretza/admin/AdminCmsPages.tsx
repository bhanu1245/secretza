"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

type CmsPage = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  isPublished: boolean;
  updatedAt: string;
};

const emptyPage: Partial<CmsPage> = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  seoTitle: "",
  metaDescription: "",
  isPublished: false,
};

export default function AdminCmsPages() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [editing, setEditing] = useState<Partial<CmsPage>>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/cms-pages");
    const data = await res.json();
    setPages(data.pages || []);
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(load).catch(() => {
      toast.error("Failed to load CMS pages");
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const isEdit = Boolean(editing.id);
    const res = await fetch(isEdit ? `/api/admin/cms-pages/${editing.id}` : "/api/admin/cms-pages", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save page");
      return;
    }
    toast.success("CMS page saved");
    setEditing(emptyPage);
    await load();
  };

  const remove = async (page: CmsPage) => {
    if (!confirm(`Delete ${page.title}?`)) return;
    const res = await fetch(`/api/admin/cms-pages/${page.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete page");
      return;
    }
    toast.success("CMS page deleted");
    await load();
  };

  const update = (key: keyof CmsPage, value: unknown) => {
    setEditing((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">CMS Pages</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Manage Terms, Privacy Policy, About, Contact, Safety Tips, FAQ, and other content pages.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[460px,1fr] gap-6">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#F5F5F7]">{editing.id ? "Edit Page" : "New Page"}</h3>
            <button onClick={() => setEditing(emptyPage)} className="text-xs text-[#8B5CF6] inline-flex items-center gap-1">
              <Plus className="size-3" /> New
            </button>
          </div>
          {(["title", "slug", "excerpt", "seoTitle", "metaDescription"] as const).map((field) => (
            <input
              key={field}
              value={String(editing[field] || "")}
              onChange={(event) => update(field, event.target.value)}
              placeholder={field}
              className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          ))}
          <textarea
            value={String(editing.content || "")}
            onChange={(event) => update("content", event.target.value)}
            placeholder="Rich text / HTML content"
            rows={12}
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={Boolean(editing.isPublished)} onChange={(event) => update("isPublished", event.target.checked)} />
            Published
          </label>
          <button disabled={saving} onClick={save} className="w-full rounded-lg bg-[#7C3AED] py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60">
            <Save className="size-4 inline mr-2" /> {saving ? "Saving..." : "Save Page"}
          </button>
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-[#A1A1AA]">Loading pages...</div>
          ) : pages.length === 0 ? (
            <div className="p-8 text-sm text-[#A1A1AA]">No CMS pages yet.</div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.08)]">
              {pages.map((page) => (
                <div key={page.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#F5F5F7]">{page.title}</h3>
                      <span className={page.isPublished ? "text-[10px] text-emerald-300" : "text-[10px] text-amber-300"}>
                        {page.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA]">/cms/{page.slug} · updated {new Date(page.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(page)} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#F5F5F7]">Edit</button>
                    <button onClick={() => remove(page)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300">
                      <Trash2 className="size-3 inline mr-1" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
