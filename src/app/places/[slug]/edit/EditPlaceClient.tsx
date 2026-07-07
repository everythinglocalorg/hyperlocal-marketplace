"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import { PLACE_TYPES, PLACE_AMENITIES, PLACE_ACTIVITIES, PAID_PLACE_TYPES } from "@/types";
import type { Place, PlaceType, PlaceFees } from "@/types";
import { Loader2 } from "lucide-react";

interface Props {
  place: Place;
  userId: string;
  isAdmin: boolean;
  vendorId?: string | null;
  vendorName?: string | null;
}

export default function EditPlaceClient({ place, userId, isAdmin, vendorId, vendorName }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(place.name);
  const [type, setType] = useState<PlaceType>(place.type);
  const [subtype, setSubtype] = useState(place.subtype ?? "");
  const [description, setDescription] = useState(place.description ?? "");
  const [address, setAddress] = useState(place.address ?? "");
  const [fees, setFees] = useState<PlaceFees>(place.fees);
  const [feeDetails, setFeeDetails] = useState(place.fee_details ?? "");
  const [website, setWebsite] = useState(place.website ?? "");
  const [phone, setPhone] = useState(place.phone ?? "");
  const [amenities, setAmenities] = useState<string[]>(place.amenities ?? []);
  const [activities, setActivities] = useState<string[]>(place.activities ?? []);
  const [tags, setTags] = useState<string[]>(place.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>(place.images ?? []);
  const [isActive, setIsActive] = useState(place.is_active);
  const [linkVendor, setLinkVendor] = useState(!!place.vendor_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFoodTruck = type === "food_truck";

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type,
        subtype: subtype.trim() || null,
        description: description.trim() || null,
        address: address.trim() || null,
        fees,
        fee_details: feeDetails.trim() || null,
        website: website.trim() || null,
        phone: phone.trim() || null,
        amenities,
        activities,
        tags,
        images,
        vendor_id: (isFoodTruck && linkVendor && vendorId) ? vendorId : null,
        updated_at: new Date().toISOString(),
      };

      // Only admins can flip is_active directly
      if (isAdmin) payload.is_active = isActive;

      const { error: updateError } = await supabase
        .from("places")
        .update(payload)
        .eq("id", place.id);

      if (updateError) throw updateError;
      router.push(`/places/${place.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit place</h1>
            <p className="text-sm text-gray-400">{place.city}, {place.state}</p>
          </div>
          <button
            onClick={() => router.push(`/places/${place.slug}`)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Basic Info</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {PLACE_TYPES.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setType(value)}
                    className={`text-sm py-2 rounded-xl border font-medium transition-colors ${type === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtype <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={subtype} onChange={(e) => setSubtype(e.target.value)}
                placeholder={isFoodTruck ? "e.g. BBQ, Tacos" : "e.g. State Park, Waterfall"}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>

            {isFoodTruck && vendorId && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <input id="link-vendor" type="checkbox" checked={linkVendor} onChange={(e) => setLinkVendor(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400" />
                <label htmlFor="link-vendor" className="text-sm text-emerald-800">
                  Link to <strong>{vendorName}</strong> storefront
                </label>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Location</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street address <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <p className="text-xs text-gray-400">City/coordinates cannot be changed after creation. Contact support if the pin location is wrong.</p>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Details</h2>

            {!isFoodTruck && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {PLACE_AMENITIES.filter(a => !['Outdoor Seating','Card Accepted','Cash Only','Drive-Through'].includes(a)).map((a) => (
                    <button key={a} type="button" onClick={() => toggleArr(amenities, setAmenities, a)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${amenities.includes(a) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isFoodTruck && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service options</label>
                <div className="flex flex-wrap gap-2">
                  {['Outdoor Seating','Card Accepted','Cash Only','Drive-Through','Pet-Friendly','ADA Accessible'].map((a) => (
                    <button key={a} type="button" onClick={() => toggleArr(amenities, setAmenities, a)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${amenities.includes(a) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isFoodTruck && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activities</label>
                <div className="flex flex-wrap gap-2">
                  {PLACE_ACTIVITIES.map((a) => (
                    <button key={a} type="button" onClick={() => toggleArr(activities, setActivities, a)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activities.includes(a) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isFoodTruck && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fees</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["free","day-use","camping","varies"] as PlaceFees[]).map((f) => (
                    <button key={f} type="button" onClick={() => setFees(f)}
                      className={`text-sm py-2 rounded-xl border font-medium capitalize transition-colors ${fees === f ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {fees !== "free" && (
                  <input value={feeDetails} onChange={(e) => setFeeDetails(e.target.value)}
                    placeholder="e.g. $5/vehicle" className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} type="url" placeholder="https://"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {/* Photos & Tags */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Photos & Tags</h2>

            <ImageUpload
              bucket="place-images"
              userId={userId}
              currentUrl={images[0]}
              onUpload={(url) => setImages([url, ...images.slice(1)])}
              shape="banner"
              label="Update photo"
              hint="JPG or PNG, max 5 MB"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add a tag and press Enter"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <button type="button" onClick={addTag} className="px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm">Add</button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                      {t}
                      <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin-only controls */}
          {isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">Admin Controls</h2>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Active (visible to public)</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-2">Toggling off hides the place from the public. Use this to pause paid listings that have lapsed.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
