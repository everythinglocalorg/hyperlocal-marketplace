import Link from "next/link";
import { isPaidTier } from "@/lib/features";

interface VendorCardProps {
  vendor: {
    id: string;
    business_name: string;
    slug: string;
    description: string | null;
    category: string;
    city: string;
    state: string;
    logo_url: string | null;
    banner_url: string | null;
    logo_zoom?: number | null;
    tier: string;
    is_verified: boolean;
    rating: number;
    review_count: number;
    local_bucks_earned: number;
    distance_miles?: number;
  };
}

export default function VendorCard({ vendor }: VendorCardProps) {
  return (
    <Link
      href={`/vendors/${vendor.slug}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 group"
    >
      {/* Banner */}
      <div className="h-36 bg-white relative overflow-hidden flex items-center justify-center">
        {vendor.banner_url ? (
          <img
            src={vendor.banner_url}
            alt={vendor.business_name}
            className="w-full h-full object-contain p-3 transition-transform duration-300"
            style={{ transform: `scale(${vendor.logo_zoom ?? 1})` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
            🏪
          </div>
        )}

        {/* Premium badge */}
        {isPaidTier(vendor.tier) && (
          <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            {vendor.tier === "premium_plus" ? "LOCAL PRO+" : "LOCAL PRO"}
          </span>
        )}

      </div>

      {/* Content */}
      <div className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">
            {vendor.business_name}
          </h3>
          {vendor.is_verified && (
            <span className="text-blue-500 text-xs shrink-0" title="Verified">✓</span>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-0.5">{vendor.category}</p>

        {vendor.description && (
          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
            {vendor.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-xs">★</span>
            <span className="text-xs font-semibold text-gray-700">
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : "New"}
            </span>
            {vendor.review_count > 0 && (
              <span className="text-xs text-gray-400">({vendor.review_count})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {vendor.distance_miles !== undefined && (
              <span className="text-xs text-gray-400">
                {vendor.distance_miles.toFixed(1)} mi
              </span>
            )}
            {!vendor.distance_miles && (
              <span className="text-xs text-gray-400">{vendor.city}, {vendor.state}</span>
            )}
          </div>
        </div>

        {vendor.local_bucks_earned > 0 && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-amber-600 font-medium">
              🪙 {vendor.local_bucks_earned.toLocaleString()} Local Bucks earned
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
