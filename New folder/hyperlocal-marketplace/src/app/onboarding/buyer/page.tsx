import { Suspense } from "react";
import BuyerOnboardingClient from "./BuyerOnboardingClient";

export default function BuyerOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 animate-pulse" />}>
      <BuyerOnboardingClient />
    </Suspense>
  );
}
