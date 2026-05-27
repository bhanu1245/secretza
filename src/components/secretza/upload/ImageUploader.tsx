"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  Loader2,
  ImageIcon,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

// ==========================================
// Types
// ==========================================

export interface UploadedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  sortOrder?: number;
  isUploading?: boolean;
  error?: string | null;
  uploadResult?: {
    id: string;
    key: string;
    url: string;
    sizeBytes: number;
    mimeType: string;
  } | null;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (update: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
  maxImages?: number;
}

// ==========================================
// Constants
// ==========================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ==========================================
// Component
// ==========================================

export default function ImageUploader({
  images,
  onImagesChange,
  maxImages = 20,
}: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedCount = images.filter((img) => !img.isUploading && !img.error).length;
  const canAddMore = completedCount < maxImages;

  // ── Upload Logic ──────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      if (completedCount >= maxImages) {
        toast.error("Limit reached", {
          description: `Maximum ${maxImages} images allowed.`,
        });
        return;
      }

      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Invalid format", {
          description: "Only JPG, PNG, and WebP are supported.",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large", {
          description: `Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
        });
        return;
      }

      // Dimensions validation (50-8000px)
      try {
        const dims = await getImageDimensions(file);
        if (dims.width < 50 || dims.height < 50) {
          toast.error("Image too small", {
            description: "Minimum 50×50 pixels required.",
          });
          return;
        }
        if (dims.width > 8000 || dims.height > 8000) {
          toast.error("Image too large", {
            description: "Maximum 8000×8000 pixels allowed.",
          });
          return;
        }
      } catch {
        // If dimensions can't be read, still allow upload — server validates
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Add optimistic placeholder
      const placeholder: UploadedImage = {
        id: tempId,
        url: "",
        isUploading: true,
        error: null,
      };
      onImagesChange((prev) => [...prev, placeholder]);

      // Build preview URL for display while uploading
      let previewUrl = "";
      try {
        previewUrl = URL.createObjectURL(file);
        onImagesChange((prev) =>
          prev.map((img) =>
            img.id === tempId ? { ...img, url: previewUrl } : img
          )
        );
      } catch {
        // non-critical
      }

      // Upload to server
      try {
        const formData = new FormData();
        formData.append("files", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        const uploadedFile = data.files?.[0];
        if (!uploadedFile) {
          throw new Error("No file returned from server");
        }

        // Replace placeholder with real uploaded image
        onImagesChange((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? {
                  id: uploadedFile.id || tempId,
                  url: uploadedFile.url,
                  thumbnailUrl: uploadedFile.url,
                  sortOrder: prev.length,
                  isUploading: false,
                  error: null,
                  uploadResult: {
                    id: uploadedFile.id || tempId,
                    key: uploadedFile.key || "",
                    url: uploadedFile.url,
                    sizeBytes: uploadedFile.sizeBytes || 0,
                    mimeType: uploadedFile.mimeType || "",
                  },
                }
              : img
          )
        );

        // Revoke preview URL to free memory
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";

        // Mark as errored
        onImagesChange((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...img, isUploading: false, error: message }
              : img
          )
        );

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        toast.error("Upload failed", {
          description: message,
        });
      }
    },
    [completedCount, maxImages, onImagesChange]
  );

  // ── Handlers ───────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const remaining = maxImages - completedCount;
      const toUpload = Array.from(files).slice(0, remaining);
      toUpload.forEach((f) => uploadFile(f));
    },
    [uploadFile, maxImages, completedCount]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      onImagesChange((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img?.url && img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
        return prev.filter((i) => i.id !== id);
      });
    },
    [onImagesChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      onImagesChange((prev) => {
        const arr = [...prev];
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        return arr.map((img, i) => ({ ...img, sortOrder: i }));
      });
    },
    [onImagesChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      onImagesChange((prev) => {
        if (index >= prev.length - 1) return prev;
        const arr = [...prev];
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
        return arr.map((img, i) => ({ ...img, sortOrder: i }));
      });
    },
    [onImagesChange]
  );

  // ── Helper ────────────────────────────────────────────────
  const getFileName = (url: string) => {
    try {
      const pathname = new URL(url, "https://placeholder.com").pathname;
      return pathname.split("/").pop() || "image";
    } catch {
      return "image";
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-1 text-base font-semibold text-[#F5F5F7]">
          Listing Images
        </h3>
        <p className="text-sm text-[#A1A1AA]">
          Upload up to {maxImages} images. First image is the cover. JPG, PNG, or
          WebP — max 10MB each. Minimum 50×50px.
        </p>
      </div>

      {/* Drop Zone */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 px-4 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-violet-400 bg-violet-500/10"
              : "border-[rgba(255,255,255,0.1)] bg-[#15151D] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.02)]"
          }`}
        >
          <div
            className={`p-3 rounded-xl transition-colors ${
              isDragOver ? "bg-violet-500/20" : "bg-[rgba(255,255,255,0.05)]"
            }`}
          >
            <Upload
              className={`size-5 transition-colors ${
                isDragOver ? "text-violet-400" : "text-[#52525B]"
              }`}
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-[#A1A1AA]">
              <span className="text-violet-400 font-medium">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-[#52525B] mt-1">
              JPG, PNG, or WebP — max 10MB each
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`group relative aspect-square rounded-lg overflow-hidden border transition-all duration-200 ${
                img.error
                  ? "border-red-500/30 bg-red-500/5"
                  : img.isUploading
                    ? "border-[rgba(255,255,255,0.06)] bg-[#15151D]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#15151D] hover:border-[rgba(255,255,255,0.15)]"
              }`}
            >
              {/* Image */}
              {img.url ? (
                <img
                  src={img.thumbnailUrl || img.url}
                  alt={
                    img.isUploading
                      ? "Uploading..."
                      : img.error
                        ? "Upload failed"
                        : `Image ${idx + 1}`
                  }
                  className={`w-full h-full object-cover ${img.isUploading ? "opacity-50" : ""}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {img.isUploading ? (
                    <Loader2 className="size-5 text-[#52525B] animate-spin" />
                  ) : (
                    <ImageIcon className="size-5 text-[#52525B]" />
                  )}
                </div>
              )}

              {/* Cover Badge */}
              {idx === 0 && !img.isUploading && !img.error && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-violet-600/90 text-white">
                  Cover
                </div>
              )}

              {/* Uploading Overlay */}
              {img.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="size-6 text-white animate-spin" />
                </div>
              )}

              {/* Error Overlay */}
              {img.error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-1 px-2">
                  <p className="text-[10px] text-red-400 font-medium text-center">
                    Failed
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(img.id);
                    }}
                    className="text-[10px] text-red-400 underline hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Controls (hover) */}
              {!img.isUploading && !img.error && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(img.id);
                      }}
                      className="p-1 rounded-md bg-black/50 text-white/80 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Reorder buttons */}
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(idx);
                        }}
                        className="p-1 rounded bg-black/50 text-white/80 hover:bg-white/20 transition-colors text-[10px]"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                    )}
                    {idx < images.filter((i) => !i.isUploading && !i.error).length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(idx);
                        }}
                        className="p-1 rounded bg-black/50 text-white/80 hover:bg-white/20 transition-colors text-[10px]"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add More Card */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-[rgba(255,255,255,0.08)] bg-[#15151D] flex flex-col items-center justify-center gap-2 text-[#52525B] hover:border-[rgba(255,255,255,0.15)] hover:text-[#A1A1AA] transition-all duration-200"
            >
              <Upload className="size-4" />
              <span className="text-[10px] font-medium">
                {maxImages - completedCount} left
              </span>
            </button>
          )}
        </div>
      )}

      {/* Image Count */}
      {images.length > 0 && (
        <p className="text-xs text-[#52525B]">
          {completedCount} of {maxImages} images
          {images.some((img) => img.isUploading) && " (uploading...)"}
        </p>
      )}
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions"));
    };
    img.src = url;
  });
}
