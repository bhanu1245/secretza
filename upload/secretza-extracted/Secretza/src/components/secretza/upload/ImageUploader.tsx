"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  X,
  ImagePlus,
  GripVertical,
  Loader2,
  AlertCircle,
  Star,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

export interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  thumbnailUrl?: string;
  isUploading: boolean;
  error?: string;
  sortOrder: number;
  width?: number;
  height?: number;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (
    update: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])
  ) => void;
  maxImages?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function readFileDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}

function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();

    img.onload = () => {
      const MAX_DIM = 400;
      let { naturalWidth: w, naturalHeight: h } = img;

      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      canvas.width = w;
      canvas.height = h;
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      resolve("");
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

// ── Component ────────────────────────────────────────────────────────────

export default function ImageUploader({
  images,
  onImagesChange,
  maxImages = 20,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Track drag enter/leave counter so nested child elements don't cause flicker
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => {
        const next = prev + 1;
        if (next === 1) setIsDragOver(true);
        return next;
      });
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => {
        const next = prev - 1;
        if (next === 0) setIsDragOver(false);
        return next;
      });
    },
    []
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Filter to accepted image types and size limit
      const validFiles = fileArray.filter((f) => {
        if (!ACCEPTED_TYPES.includes(f.type)) return false;
        if (f.size > MAX_FILE_SIZE) return false;
        return true;
      });

      if (validFiles.length === 0) return;

      // Respect max images limit
      const slotsAvailable = Math.max(0, maxImages - images.length);
      const filesToProcess = validFiles.slice(0, slotsAvailable);

      if (filesToProcess.length === 0) return;

      // Create temporary UploadedImage entries (immediately visible)
      const newImages: UploadedImage[] = await Promise.all(
        filesToProcess.map(async (file, idx) => {
          const objectUrl = URL.createObjectURL(file);
          const dims = await readFileDimensions(file);
          const thumb = await generateThumbnail(file);

          return {
            id: `temp-${Date.now()}-${idx}`,
            file,
            url: objectUrl,
            thumbnailUrl: thumb || undefined,
            isUploading: false,
            sortOrder: images.length + idx,
            width: dims.width,
            height: dims.height,
          };
        })
      );

      onImagesChange((prev) => [...prev, ...newImages]);
    },
    [images.length, maxImages, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setDragCounter(0);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [processFiles]
  );

  // ── Actions ──────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string) => {
      onImagesChange((prev) => {
        const img = prev.find((i) => i.id === id);
        // Revoke blob URL to free memory
        if (img && img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
        return prev
          .filter((i) => i.id !== id)
          .map((i, idx) => ({ ...i, sortOrder: idx }));
      });
    },
    [onImagesChange]
  );

  const handleMoveToPrimary = useCallback(
    (id: string) => {
      onImagesChange((prev) => {
        const idx = prev.findIndex((i) => i.id === id);
        if (idx <= 0) return prev;
        const item = prev[idx];
        const updated = [...prev];
        updated.splice(idx, 1);
        updated.unshift(item);
        return updated.map((i, iIdx) => ({ ...i, sortOrder: iIdx }));
      });
    },
    [onImagesChange]
  );

  // ── Native Drag Reorder ─────────────────────────────────────────────

  const dragItemIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleThumbDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number) => {
      dragItemIndex.current = index;
      e.dataTransfer.effectAllowed = "move";
      // Minimal transparent drag image so the browser doesn't show a ghost
      try {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.position = "absolute";
        ghost.style.top = "-9999px";
        ghost.style.opacity = "0.6";
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
        setTimeout(() => document.body.removeChild(ghost), 0);
      } catch {
        // setDragImage may fail in some environments
      }
    },
    []
  );

  const handleThumbDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      dragOverIndex.current = index;
    },
    []
  );

  const handleThumbDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, _targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const from = dragItemIndex.current;
      const to = dragOverIndex.current;

      if (from !== null && to !== null && from !== to) {
        onImagesChange((prev) => {
          const updated = [...prev];
          const [moved] = updated.splice(from, 1);
          updated.splice(to, 0, moved);
          return updated.map((i, idx) => ({ ...i, sortOrder: idx }));
        });
      }

      dragItemIndex.current = null;
      dragOverIndex.current = null;
    },
    [onImagesChange]
  );

  const handleThumbDragEnd = useCallback(() => {
    dragItemIndex.current = null;
    dragOverIndex.current = null;
  }, []);

  // ── Cleanup blob URLs on unmount ────────────────────────────────────

  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const reachedLimit = images.length >= maxImages;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-[#F5F5F7]">
          Upload Photos
        </h3>
        <p className="text-sm text-[#A1A1AA]">
          Add up to {maxImages} photos. The first image will be your primary
          photo. Drag to reorder.
        </p>
      </div>

      {/* Dropzone */}
      {!reachedLimit && (
        <div
          role="button"
          tabIndex={0}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-all duration-200",
            isDragOver
              ? "border-violet bg-violet/10 text-violet"
              : "border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/60 hover:border-[rgba(255,255,255,0.15)] hover:bg-[#1E1E2A]"
          )}
        >
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl transition-colors",
              isDragOver
                ? "bg-violet/20"
                : "bg-gradient-to-br from-violet/20 to-purple-500/10"
            )}
          >
            {isDragOver ? (
              <ImagePlus className="size-6 text-violet" />
            ) : (
              <Upload className="size-6 text-violet" />
            )}
          </div>

          <div className="text-center">
            <p
              className={cn(
                "text-sm font-medium transition-colors",
                isDragOver ? "text-violet" : "text-[#F5F5F7]"
              )}
            >
              {isDragOver ? "Drop your images here" : "Drop images here or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[#A1A1AA]/70">
              PNG, JPG, WEBP, GIF &middot; Max 20 MB each &middot;{" "}
              {images.length}/{maxImages} uploaded
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {/* Image Grid */}
      {sortedImages.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sortedImages.map((img, index) => (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => handleThumbDragStart(e, index)}
              onDragOver={(e) => handleThumbDragOver(e, index)}
              onDrop={(e) => handleThumbDrop(e, index)}
              onDragEnd={handleThumbDragEnd}
              className={cn(
                "group/thumb relative aspect-square overflow-hidden rounded-xl border transition-all",
                img.error
                  ? "border-red-500/40"
                  : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]",
                img.isUploading && "pointer-events-none"
              )}
            >
              {/* Thumbnail */}
              <img
                src={img.thumbnailUrl || img.url}
                alt=""
                className="size-full object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                draggable={false}
              />

              {/* Gradient overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover/thumb:opacity-100" />

              {/* Primary badge */}
              {index === 0 && !img.error && (
                <div className="absolute top-1.5 left-1.5 z-10">
                  <Badge className="gap-1 bg-violet text-[9px] font-semibold text-white border-0 shadow-lg shadow-violet/30">
                    <Star className="size-2.5 fill-current" />
                    Primary
                  </Badge>
                </div>
              )}

              {/* Set-as-primary button (non-primary images on hover) */}
              {index !== 0 && !img.error && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveToPrimary(img.id);
                  }}
                  className="absolute top-1.5 left-1.5 z-10 rounded-md bg-black/60 p-1 text-white/70 opacity-0 backdrop-blur-sm transition-opacity hover:text-violet group-hover/thumb:opacity-100"
                  title="Set as primary"
                >
                  <Star className="size-3.5" />
                </button>
              )}

              {/* Error badge */}
              {img.error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-red-500/10 backdrop-blur-[2px]">
                  <AlertCircle className="size-6 text-red-400" />
                  <span className="max-w-[80%] text-center text-[10px] font-medium text-red-300">
                    {img.error}
                  </span>
                </div>
              )}

              {/* Uploading overlay */}
              {img.isUploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0B0B0F]/70 backdrop-blur-[2px]">
                  <Loader2 className="size-6 animate-spin text-violet" />
                  <span className="text-xs font-medium text-[#A1A1AA]">
                    Uploading…
                  </span>
                </div>
              )}

              {/* Drag handle (always visible on left edge) */}
              {!img.isUploading && !img.error && (
                <div className="absolute top-1/2 -translate-y-1/2 left-1 z-20 cursor-grab rounded-md bg-black/40 p-0.5 text-white/50 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 hover:text-white active:cursor-grabbing group-hover/thumb:opacity-100">
                  <GripVertical className="size-3.5" />
                </div>
              )}

              {/* Delete button (top-right on hover) */}
              {!img.isUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(img.id);
                  }}
                  className="absolute top-1.5 right-1.5 z-10 rounded-md bg-red-500/80 p-1 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-500 group-hover/thumb:opacity-100"
                  title="Remove image"
                >
                  <X className="size-3.5" />
                </button>
              )}

              {/* Sort order indicator (bottom-left) */}
              {!img.isUploading && !img.error && (
                <div className="absolute bottom-1.5 left-1.5 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/70 opacity-0 backdrop-blur-sm group-hover/thumb:opacity-100">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && reachedLimit === false && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1E1E2A]/40 px-4 py-3">
          <ImageIcon className="size-4 text-[#52525B]" />
          <span className="text-xs text-[#52525B]">
            No photos uploaded yet
          </span>
        </div>
      )}

      {/* Max images reached notice */}
      {reachedLimit && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-violet/20 bg-violet/5 px-4 py-3">
          <ImageIcon className="size-4 text-violet" />
          <span className="text-xs font-medium text-violet">
            You&apos;ve reached the {maxImages} photo limit
          </span>
        </div>
      )}

      {/* Info footer */}
      {images.length > 0 && !reachedLimit && (
        <p className="text-center text-xs text-[#A1A1AA]/50">
          {images.length}/{maxImages} &middot; Drag thumbnails to reorder
          &middot; Star to set primary
        </p>
      )}
    </div>
  );
}
