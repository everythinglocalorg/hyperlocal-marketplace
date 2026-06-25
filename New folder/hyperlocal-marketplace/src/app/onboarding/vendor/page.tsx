import { Suspense } from "react";
import VendorOnboardingClient from "./VendorOnboardingClient";

export default function VendorOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 animate-pulse" />}>
      <VendorOnboardingClient />
    </Suspense>
  );
}
