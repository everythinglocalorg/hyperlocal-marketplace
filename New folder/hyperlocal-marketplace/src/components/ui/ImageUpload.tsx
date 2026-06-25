"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  bucket: string;
  userId: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  shape?: "square" | "banner";
  label: string;
  hint?: string;
}

export default function ImageUpload({
  bucket,
  userId,
  currentUrl,
  onUpload,
  shape = "square",
  label,
  hint,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const supabase = createClient();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setError(null);
    setUploading(true);

    // Local preview while uploading
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setPreview(currentUrl ?? null);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setPreview(data.publicUrl);
    onUpload(data.publicUrl);
    setUploading(false);
  }

  const isBanner = shape === "banner";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative w-full border-2 border-dashed rounded-xl overflow-hidden transition-colors group
          ${preview ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50"}
          ${isBanner ? "h-36" : "h-32"}`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {uploading ? "Uploading..." : "Change photo"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">Click to upload</span>
                <span className="text-xs">JPG, PNG or WebP · max 5MB</span>
              </>
            )}
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      {preview && !uploading && (
        <button
          type="button"
          onClick={() => { setPreview(null); onUpload(""); }}
          className="mt-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
