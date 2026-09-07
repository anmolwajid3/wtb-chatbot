"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SafeImage from "./SafeImage";

export default function CoachImageUploader({
  coachId,
  currentImages,
  uploadImage,
  removeImage,
}: {
  coachId: string;
  currentImages: string[];
  uploadImage: (coachId: string, formData: FormData) => Promise<{ error?: string }>;
  removeImage: (coachId: string, imageUrl: string) => Promise<void>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadImage(coachId, formData);

    setUploading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove(url: string) {
    if (!window.confirm("Remove this image?")) return;
    await removeImage(coachId, url);
    router.refresh();
  }

  return (
    <div>
      <span className="text-sm text-neutral-400 block mb-2">Photos</span>
      <div className="flex gap-2 flex-wrap mb-3">
        {currentImages.map((url) => (
          <div key={url} className="relative group">
            <SafeImage
              src={url}
              alt=""
              className="w-20 h-20 rounded object-cover border border-neutral-700"
            />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              title="Remove"
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
            >
              X
            </button>
          </div>
        ))}
        {currentImages.length === 0 && (
          <span className="text-xs text-neutral-600 italic">No photos uploaded yet.</span>
        )}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span className="bg-amber-500 text-black font-medium px-3 py-1.5 rounded-md text-xs hover:bg-amber-400">
          {uploading ? "Uploading..." : "+ Upload photo"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
