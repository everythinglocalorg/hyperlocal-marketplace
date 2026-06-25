import { Suspense } from "react";
import SearchClient from "./SearchClient";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 animate-pulse" />}>
      <SearchClient />
    </Suspense>
  );
}
