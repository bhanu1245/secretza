"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Grid3X3,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Eye,
  EyeOff,
  Search,
  Loader2,
  FolderOpen,
  Folder,
  FileText,
  RefreshCw,
  AlertTriangle,
  GripVertical,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ==========================================
// Types
// ==========================================
interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  listingCount: number;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  children?: CategoryNode[];
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY_FORM: CategoryFormData = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  color: "#7C3AED",
  parentId: null,
  isActive: true,
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
};

// ==========================================
// Helper: slugify
// ==========================================
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ==========================================
// Color presets
// ==========================================
const COLOR_PRESETS = [
  "#7C3AED", "#8B5CF6", "#A78BFA",
  "#EC4899", "#F43F5E", "#EF4444",
  "#F97316", "#F59E0B", "#EAB308",
  "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6",
  "#6366F1", "#8B5CF6",
];

// ==========================================
// Category Row Component
// ==========================================
function CategoryRow({
  category,
  level = 0,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFeatured,
  onMoveUp,
  onMoveDown,
  allRootCategories,
}: {
  category: CategoryNode;
  level?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (cat: CategoryNode) => void;
  onDelete: (cat: CategoryNode) => void;
  onToggleActive: (cat: CategoryNode) => void;
  onToggleFeatured: (cat: CategoryNode) => void;
  onMoveUp: (cat: CategoryNode) => void;
  onMoveDown: (cat: CategoryNode) => void;
  allRootCategories: CategoryNode[];
}) {
  const hasChildren = category.children && category.children.length > 0;
  const indent = level * 24;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-150 border ${
          !category.isActive
            ? "opacity-60 border-transparent hover:bg-[rgba(255,255,255,0.02)]"
            : "border-transparent hover:bg-[rgba(255,255,255,0.04)]"
        }`}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="size-3.5 text-[#A1A1AA]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#A1A1AA]" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-[#15151D]"
          style={{ backgroundColor: category.color, ['--tw-ring-color' as string]: category.color } as React.CSSProperties}
        />

        {/* Folder/category icon */}
        <div className="flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="size-4 text-amber-400" />
            ) : (
              <Folder className="size-4 text-amber-400" />
            )
          ) : (
            <FileText className="size-4 text-[#52525B]" />
          )}
        </div>

        {/* Name & slug */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#F5F5F7] truncate">
              {category.name}
            </span>
            {category.isFeatured && (
              <Star className="size-3 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
            {!category.isActive && (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 rounded-full bg-red-500/15 text-red-400 border-red-500/30 flex-shrink-0"
              >
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-[#52525B] truncate mt-0.5">
            /{category.slug}
          </p>
        </div>

        {/* Listing count */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <FileText className="size-3 text-[#52525B]" />
          <span className="text-[11px] text-[#A1A1AA] font-medium tabular-nums">
            {category.listingCount}
          </span>
          {hasChildren && (
            <span className="text-[9px] text-[#52525B]">
              (+{category.children!.reduce((sum, c) => sum + c.listingCount, 0)})
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {/* Toggle active */}
          <button
            onClick={() => onToggleActive(category)}
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title={category.isActive ? "Deactivate" : "Activate"}
          >
            {category.isActive ? (
              <Eye className="size-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="size-3.5 text-red-400" />
            )}
          </button>

          {/* Toggle featured */}
          <button
            onClick={() => onToggleFeatured(category)}
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title={category.isFeatured ? "Unfeature" : "Feature"}
          >
            <Star
              className={`size-3.5 ${
                category.isFeatured
                  ? "text-amber-400 fill-amber-400"
                  : "text-[#52525B]"
              }`}
            />
          </button>

          {/* Move up */}
          <button
            onClick={() => onMoveUp(category)}
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title="Move up"
          >
            <ChevronUp className="size-3.5 text-[#A1A1AA]" />
          </button>

          {/* Move down */}
          <button
            onClick={() => onMoveDown(category)}
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title="Move down"
          >
            <ChevronDown className="size-3.5 text-[#A1A1AA]" />
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 rounded-md hover:bg-[#7C3AED]/10 transition-colors"
            title="Edit"
          >
            <Pencil className="size-3.5 text-[#8B5CF6]" />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(category)}
            className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && (
        <CollapsibleContent>
          <div className="ml-3 border-l border-[rgba(255,255,255,0.06)]">
            {category.children!.map((child) => (
              <CategoryRow
                key={child.id}
                category={child}
                level={0}
                isExpanded={false}
                onToggleExpand={() => {}}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                onToggleFeatured={onToggleFeatured}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                allRootCategories={allRootCategories}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ==========================================
// Category Form Dialog
// ==========================================
function CategoryFormDialog({
  open,
  onClose,
  onSubmit,
  loading,
  initialData,
  rootCategories,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  loading: boolean;
  initialData: CategoryNode | null;
  rootCategories: CategoryNode[];
  mode: "create" | "edit";
}) {
  // Compute initial form values
  const getInitialForm = (): CategoryFormData => {
    if (mode === "edit" && initialData) {
      return {
        name: initialData.name,
        slug: initialData.slug,
        description: initialData.description || "",
        icon: initialData.icon || "",
        color: initialData.color || "#7C3AED",
        parentId: initialData.parentId,
        isActive: initialData.isActive,
        isFeatured: initialData.isFeatured,
        seoTitle: initialData.seoTitle || "",
        seoDescription: initialData.seoDescription || "",
      };
    }
    return { ...EMPTY_FORM, parentId: initialData?.id || null };
  };

  const [form, setForm] = useState<CategoryFormData>(getInitialForm);
  const [autoSlug, setAutoSlug] = useState(() => mode === "edit");

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: autoSlug ? slugify(name) : prev.slug,
    }));
  };

  const updateField = (field: keyof CategoryFormData, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">
            {mode === "create" ? "Create New Category" : `Edit Category: ${initialData?.name}`}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            {mode === "create"
              ? "Add a new category to the platform. Fill in the details below."
              : "Update the category details."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div>
            <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" className="text-xs text-[#A1A1AA]">
                  Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Restaurants"
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug" className="text-xs text-[#A1A1AA]">
                  Slug <span className="text-red-400">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cat-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      updateField("slug", e.target.value);
                    }}
                    placeholder="e.g. restaurants"
                    className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                  />
                  {autoSlug && (
                    <Badge
                      variant="outline"
                      className="h-9 px-2 text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center"
                    >
                      Auto
                    </Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cat-desc" className="text-xs text-[#A1A1AA]">
                  Description
                </Label>
                <Textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description of this category..."
                  rows={2}
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-[rgba(255,255,255,0.06)]" />

          {/* Appearance */}
          <div>
            <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Appearance</h4>
            <div className="space-y-4">
              {/* Color */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#A1A1AA]">Color</Label>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateField("color", color)}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                          form.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#15151D] scale-110" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Input
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    className="w-28 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-8 rounded-lg text-xs font-mono"
                    placeholder="#7C3AED"
                  />
                </div>
              </div>

              {/* Icon */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon" className="text-xs text-[#A1A1AA]">
                  Icon (optional)
                </Label>
                <Input
                  id="cat-icon"
                  value={form.icon}
                  onChange={(e) => updateField("icon", e.target.value)}
                  placeholder="e.g. UtensilsCrossed, MapPin, Briefcase"
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                />
                <p className="text-[10px] text-[#52525B]">Lucide icon name for this category</p>
              </div>
            </div>
          </div>

          <Separator className="bg-[rgba(255,255,255,0.06)]" />

          {/* Hierarchy */}
          <div>
            <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Hierarchy</h4>
            <div className="space-y-4">
              {/* Parent */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#A1A1AA]">Parent Category</Label>
                <Select
                  value={form.parentId || "__none__"}
                  onValueChange={(val) =>
                    updateField("parentId", val === "__none__" ? null : val)
                  }
                >
                  <SelectTrigger className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] focus:border-[#7C3AED] rounded-lg text-sm w-full">
                    <SelectValue placeholder="Select parent (none = root)" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                    <SelectItem value="__none__">None (Root Category)</SelectItem>
                    {rootCategories
                      .filter((c) => c.id !== initialData?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-[#52525B]">
                  {form.parentId
                    ? "This will be a subcategory under the selected parent."
                    : "Leave as root to create a top-level category."}
                </p>
              </div>

              {/* Status toggles */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)] flex-1">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => updateField("isActive", checked)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <div>
                    <p className="text-xs font-medium text-[#F5F5F7]">Active</p>
                    <p className="text-[10px] text-[#52525B]">Visible to users</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)] flex-1">
                  <Switch
                    checked={form.isFeatured}
                    onCheckedChange={(checked) => updateField("isFeatured", checked)}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <div>
                    <p className="text-xs font-medium text-[#F5F5F7]">Featured</p>
                    <p className="text-[10px] text-[#52525B]">Highlighted in navigation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[rgba(255,255,255,0.06)]" />

          {/* SEO */}
          <div>
            <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">SEO Settings</h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="seo-title" className="text-xs text-[#A1A1AA]">
                  SEO Title
                </Label>
                <Input
                  id="seo-title"
                  value={form.seoTitle}
                  onChange={(e) => updateField("seoTitle", e.target.value)}
                  placeholder="Custom title for search engines"
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-desc" className="text-xs text-[#A1A1AA]">
                  SEO Description
                </Label>
                <Textarea
                  id="seo-desc"
                  value={form.seoDescription}
                  onChange={(e) => updateField("seoDescription", e.target.value)}
                  placeholder="Meta description for search engines (150-160 characters recommended)"
                  rows={2}
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
                />
                {form.seoDescription && (
                  <p
                    className={`text-[10px] ${
                      form.seoDescription.length > 160
                        ? "text-red-400"
                        : form.seoDescription.length > 150
                        ? "text-amber-400"
                        : "text-[#52525B]"
                    }`}
                  >
                    {form.seoDescription.length}/160 characters
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)] rounded-lg text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.name.trim() || !form.slug.trim()}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {mode === "create" ? "Creating..." : "Saving..."}
              </>
            ) : mode === "create" ? (
              <>
                <Plus className="size-4 mr-2" />
                Create Category
              </>
            ) : (
              <>
                <Pencil className="size-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Main CategoryManager Component
// ==========================================
export default function CategoryManager() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setCategories(data.categories || []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Filter categories by search
  const filterTree = (nodes: CategoryNode[], query: string): CategoryNode[] => {
    if (!query) return nodes;
    const lower = query.toLowerCase();
    return nodes.reduce<CategoryNode[]>((acc, node) => {
      const nameMatch = node.name.toLowerCase().includes(lower);
      const slugMatch = node.slug.toLowerCase().includes(lower);
      const filteredChildren = filterTree(node.children || [], query);
      if (nameMatch || slugMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const filteredCategories = filterTree(categories, searchQuery);

  // Stats
  const totalRootCategories = categories.length;
  const totalSubCategories = categories.reduce((sum, c) => sum + (c.children?.length || 0), 0);
  const totalListings = categories.reduce(
    (sum, c) => sum + c.listingCount + (c.children?.reduce((s, ch) => s + ch.listingCount, 0) || 0),
    0
  );
  const activeCategories = categories.filter((c) => c.isActive).length;
  const featuredCategories = categories.filter((c) => c.isFeatured).length;

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CRUD handlers
  const handleCreate = async (data: CategoryFormData) => {
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          description: data.description || null,
          icon: data.icon || null,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Category "${data.name}" created successfully`);
        setCreateDialogOpen(false);
        fetchCategories();
      } else {
        toast.error(result.error || "Failed to create category");
      }
    } catch {
      toast.error("Network error while creating category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data: CategoryFormData) => {
    if (!selectedCategory) return;
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCategory.id,
          ...data,
          description: data.description || null,
          icon: data.icon || null,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Category "${data.name}" updated successfully`);
        setEditDialogOpen(false);
        setSelectedCategory(null);
        fetchCategories();
      } else {
        toast.error(result.error || "Failed to update category");
      }
    } catch {
      toast.error("Network error while updating category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setActionLoading(selectedCategory.id);
    try {
      const res = await fetch(`/api/admin/categories?id=${selectedCategory.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Category "${selectedCategory.name}" deleted`);
        setDeleteDialogOpen(false);
        setSelectedCategory(null);
        fetchCategories();
      } else {
        toast.error(result.error || "Failed to delete category");
      }
    } catch {
      toast.error("Network error while deleting category");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (cat: CategoryNode) => {
    setActionLoading(cat.id);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, isActive: !cat.isActive }),
      });
      if (res.ok) {
        setCategories((prev) =>
          updateCategoryInTree(prev, cat.id, { isActive: !cat.isActive })
        );
        toast.success(`Category "${cat.name}" ${cat.isActive ? "deactivated" : "activated"}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeatured = async (cat: CategoryNode) => {
    setActionLoading(cat.id);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, isFeatured: !cat.isFeatured }),
      });
      if (res.ok) {
        setCategories((prev) =>
          updateCategoryInTree(prev, cat.id, { isFeatured: !cat.isFeatured })
        );
        toast.success(
          `Category "${cat.name}" ${cat.isFeatured ? "unfeatured" : "featured"}`
        );
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update featured status");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMove = async (cat: CategoryNode, direction: "up" | "down") => {
    const isChild = !!cat.parentId;
    const siblings = isChild
      ? categories.find((c) => c.id === cat.parentId)?.children || []
      : categories;
    const idx = siblings.findIndex((c) => c.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const swapCat = siblings[swapIdx];
    setActionLoading(cat.id);
    try {
      await Promise.all([
        fetch("/api/admin/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cat.id, order: swapCat.order }),
        }),
        fetch("/api/admin/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: swapCat.id, order: cat.order }),
        }),
      ]);
      fetchCategories();
      toast.success(`"${cat.name}" moved ${direction}`);
    } catch {
      toast.error("Failed to reorder categories");
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to update category in tree
  const updateCategoryInTree = (
    nodes: CategoryNode[],
    id: string,
    updates: Partial<CategoryNode>
  ): CategoryNode[] => {
    return nodes.map((node) => {
      if (node.id === id) return { ...node, ...updates };
      if (node.children) {
        return { ...node, children: updateCategoryInTree(node.children, id, updates) };
      }
      return node;
    });
  };

  // Edit/delete handlers
  const openEdit = (cat: CategoryNode) => {
    setSelectedCategory(cat);
    setEditDialogOpen(true);
  };

  const openDelete = (cat: CategoryNode) => {
    setSelectedCategory(cat);
    setDeleteDialogOpen(true);
  };

  const openCreateSubcategory = (cat: CategoryNode) => {
    setSelectedCategory(cat);
    setCreateDialogOpen(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Categories</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">Loading categories...</p>
        </div>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg animate-pulse"
              >
                <div className="w-4 h-4 bg-[rgba(255,255,255,0.06)] rounded" />
                <div className="w-3 h-3 bg-[rgba(255,255,255,0.06)] rounded-full" />
                <div className="w-4 h-4 bg-[rgba(255,255,255,0.06)] rounded" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-[rgba(255,255,255,0.06)] rounded w-32" />
                  <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Categories</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Manage listing categories and subcategories.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedCategory(null);
            setCreateDialogOpen(true);
          }}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm h-9"
        >
          <Plus className="size-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Root", value: totalRootCategories, color: "#7C3AED" },
          { label: "Subcategories", value: totalSubCategories, color: "#8B5CF6" },
          { label: "Active", value: activeCategories, color: "#10B981" },
          { label: "Featured", value: featuredCategories, color: "#F59E0B" },
          { label: "Total Listings", value: totalListings, color: "#3B82F6" },
          { label: "Inactive", value: totalRootCategories - activeCategories, color: "#EF4444" },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            <CardContent className="p-3">
              <p className="text-lg font-bold text-[#F5F5F7]">{stat.value}</p>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={fetchCategories}
          className="border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)] rounded-lg text-sm h-9"
        >
          <RefreshCw className="size-3.5 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Category tree */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-3">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="size-12 text-[#52525B] mx-auto mb-3" />
              <p className="text-sm text-[#A1A1AA]">
                {searchQuery ? "No categories match your search." : "No categories yet."}
              </p>
              <p className="text-xs text-[#52525B] mt-1">
                {searchQuery
                  ? "Try a different search term."
                  : 'Click "New Category" to create one.'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Table header (desktop) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                <span className="w-[76px]" />
                <span className="w-3" />
                <span className="w-4" />
                <span className="flex-1">Name</span>
                <span className="w-20 text-right">Listings</span>
                <span className="w-[152px] text-right">Actions</span>
              </div>

              {filteredCategories.map((category) => (
                <React.Fragment key={category.id}>
                  <div className="relative">
                    {actionLoading === category.id && (
                      <div className="absolute inset-0 bg-[#15151D]/60 z-10 flex items-center justify-center rounded-lg">
                        <Loader2 className="size-4 animate-spin text-[#7C3AED]" />
                      </div>
                    )}
                    <CategoryRow
                      category={category}
                      isExpanded={expandedIds.has(category.id)}
                      onToggleExpand={() => toggleExpand(category.id)}
                      onEdit={openEdit}
                      onDelete={openDelete}
                      onToggleActive={handleToggleActive}
                      onToggleFeatured={handleToggleFeatured}
                      onMoveUp={(cat) => handleMove(cat, "up")}
                      onMoveDown={(cat) => handleMove(cat, "down")}
                      allRootCategories={categories}
                    />
                  </div>

                  {/* Quick add subcategory button */}
                  <div className="flex items-center pl-[60px]">
                    <button
                      onClick={() => openCreateSubcategory(category)}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[#52525B] hover:text-[#8B5CF6] transition-colors rounded hover:bg-[rgba(139,92,246,0.05)]"
                    >
                      <Plus className="size-2.5" />
                      Add subcategory
                    </button>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      {createDialogOpen && (
        <CategoryFormDialog
          key={`create-${selectedCategory?.id ?? 'root'}-${Date.now()}`}
          open={createDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false);
            setSelectedCategory(null);
          }}
          onSubmit={handleCreate}
          loading={formLoading}
          initialData={selectedCategory}
          rootCategories={categories}
          mode="create"
        />
      )}

      {/* Edit dialog */}
      {editDialogOpen && selectedCategory && (
        <CategoryFormDialog
          key={`edit-${selectedCategory.id}`}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedCategory(null);
          }}
          onSubmit={handleEdit}
          loading={formLoading}
          initialData={selectedCategory}
          rootCategories={categories}
          mode="edit"
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#F5F5F7] flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-400" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#A1A1AA]">
              Are you sure you want to delete{" "}
              <span className="text-[#F5F5F7] font-medium">
                &ldquo;{selectedCategory?.name}&rdquo;
              </span>
              ? This action cannot be undone.
              {selectedCategory?.children && selectedCategory.children.length > 0 && (
                <span className="block mt-2 text-red-400 text-xs font-medium flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  This category has {selectedCategory.children.length} subcategory(ies). You
                  must delete them first.
                </span>
              )}
              {selectedCategory && selectedCategory.listingCount > 0 && (
                <span className="block mt-1 text-amber-400 text-xs">
                  Contains {selectedCategory.listingCount} listing(s). Listings will need to be
                  reassigned manually.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)] rounded-lg text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                actionLoading !== null ||
                (selectedCategory?.children && selectedCategory.children.length > 0)
              }
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-4 mr-2" />
                  Delete Category
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
