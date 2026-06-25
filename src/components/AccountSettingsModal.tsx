"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    phone: string | null;
  };
  onClose: () => void;
  onSaved: (updated: { full_name: string; avatar_url: string | null; phone: string | null }) => void;
}

export default function AccountSettingsModal({ profile, onClose, onSaved }: Props) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let finalAvatarUrl = avatarUrl;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("vendor-logos")
        .upload(path, avatarFile, { upsert: true });

      if (uploadError) {
        setError("Photo upload failed: " + uploadError.message);
        setSaving(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("vendor-logos").getPublicUrl(path);
      finalAvatarUrl = publicUrl;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        avatar_url: finalAvatarUrl,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setAvatarUrl(finalAvatarUrl);
      setSuccess(true);
      onSaved({ full_name: fullName.trim(), avatar_url: finalAvatarUrl, phone: phone.trim() || null });
      setTimeout(() => setSuccess(false), 2500);
    }
    setSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirmPassword) { setPwError("Passwords don't match."); return; }
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPwError(error.message); } else { setPwSuccess(true); setNewPassword(""); setConfirmPassword(""); }
    setPwSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center font-bold text-3xl text-green-700 overflow-hidden cursor-pointer ring-4 ring-green-100 hover:ring-green-300 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                : (fullName || profile.email)[0]?.toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-green-600 font-medium hover:underline"
            >
              Change photo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Profile form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}
            {success && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">✓ Profile saved!</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>

          <hr className="border-gray-100" />

          {/* Password */}
          <div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-sm font-medium text-gray-700 flex items-center gap-2 hover:text-gray-900"
            >
              <span>🔒</span> Change password
              <span className="ml-auto text-gray-400">{showPassword ? "▲" : "▼"}</span>
            </button>

            {showPassword && (
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {pwError && <p className="text-sm text-red-600">{pwError}</p>}
                {pwSuccess && <p className="text-sm text-green-600">✓ Password updated!</p>}
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {pwSaving ? "Updating..." : "Update password"}
                </button>
              </form>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full text-sm text-red-500 font-medium py-2 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
