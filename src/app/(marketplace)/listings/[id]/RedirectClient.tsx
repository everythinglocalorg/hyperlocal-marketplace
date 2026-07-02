"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Forwards human visitors to the vendor page. The server page still renders
// Open Graph tags for this listing, so link-preview bots get the listing photo.
export default function RedirectClient({ to, title }: { to: string; title: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [to, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500">Opening {title}…</p>
      <Link href={to} className="mt-3 text-sm text-green-600 hover:underline font-medium">
        Continue →
      </Link>
    </div>
  );
}
