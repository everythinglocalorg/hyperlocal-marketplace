"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") === "vendor" ? "vendor" : "buyer";

  const [role, setRole] = useState<"buyer" | "vendor">(defaultRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const referralCode = searchParams.get("ref") ?? undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          referred_by_code: referralCode,
        },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: { role },
      },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-600 mb-4">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-semibold text-sm">
            🪙 You'll earn 10 Local Bucks the moment you confirm!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium mb-3">
          🪙 Earn 10 Local Bucks on signup — free
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      </div>

      {/* Role toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          type="button"
          onClick={() => setRole("buyer")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            role === "buyer"
              ? "bg-white shadow text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          I'm a Buyer
        </button>
        <button
          type="button"
          onClick={() => setRole("vendor")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            role === "vendor"
              ? "bg-white shadow text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          I'm a Vendor
        </button>
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-400">or sign up with email</span>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jane Smith"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="jane@example.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create free account"}
        </button>
      </form>

      {role === "vendor" && (
        <div className="mt-4 space-y-3">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🏅</span>
              <p className="text-sm font-bold text-green-800">30-Day Local Pro Trial — Included Free</p>
            </div>
            <p className="text-xs text-green-700 mb-3">Every new vendor starts with full Local Pro access. No credit card required.</p>
            <ul className="space-y-1.5">
              {[
                { icon: "📊", label: "Store & listing analytics" },
                { icon: "📋", label: "Estimate creator & manager" },
                { icon: "👥", label: "Customer CRM" },
                { icon: "💬", label: "Direct customer messaging" },
                { icon: "⭐", label: "Local Verified badge" },
                { icon: "🔝", label: "Priority placement in search" },
                { icon: "∞", label: "Unlimited listings" },
              ].map(({ icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-xs text-green-800">
                  <span>{icon}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
            🏪 After signup you'll set up your business storefront — takes about 3 minutes.
          </div>
        </div>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-green-600 font-medium hover:underline">
          Log in
        </Link>
      </p>

      <p className="text-center text-xs text-gray-400 mt-4">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline">Terms</Link> and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md animate-pulse h-96" />}>
      <SignupForm />
    </Suspense>
  );
}
