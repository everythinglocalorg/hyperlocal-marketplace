"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import TurnstileWidget from "@/components/TurnstileWidget";

const CAPTCHA_ON = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Exciting, value-packed welcome shown to guests when they try a gated action
// (search, browse, or a high-intent action). Signup happens inline — email +
// password right here — using the same email-code (OTP) verification as the
// full signup page. `next` is where they were headed before the gate.
export default function WelcomeGateModal({ open, onClose, next, required }: {
  open: boolean;
  onClose: () => void;
  next?: string;
  // When required, the gate can't be dismissed — no X, no "Maybe later", and
  // clicking the backdrop does nothing. Used as the home-screen signup gate.
  required?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  // Code (OTP) step after the account is created.
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  if (!open) return null;
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function resetCaptcha() {
    if (!CAPTCHA_ON) return;
    setCaptchaToken("");
    try { window.turnstile?.reset(); } catch { /* noop */ }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (CAPTCHA_ON && !captchaToken) { setError("Please complete the verification below."); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: "", role: "buyer" },
        emailRedirectTo: `${window.location.origin}/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) {
      setError(friendlyAuthError(error));
      resetCaptcha();
      setLoading(false);
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists — log in instead.");
      setLoading(false);
      return;
    }
    if (data.session) {
      // Confirmation disabled — already signed in.
      router.push("/onboarding/buyer");
      return;
    }
    setSent(true);
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) { setVerifyError("Enter the code from your email."); return; }
    setVerifying(true);
    setVerifyError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error || !data.session) {
      setVerifyError(error?.message ?? "That code didn't work. Check it and try again.");
      setVerifying(false);
      return;
    }
    router.push("/onboarding/buyer");
  }

  const VALUES = [
    { icon: "🔎", title: "Search everything local", body: "Every business, product, and service near you." },
    { icon: "💬", title: "Message businesses direct", body: "Book, ask, and get estimates — no middleman." },
    { icon: "📍", title: "Your town, saved for you", body: "New local finds every time you log in." },
    { icon: "🤝", title: "Support 150+ local businesses", body: "Keep your dollars in your community — locals keep 100% of their profits." },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-gray-900/60 overflow-y-auto"
      onClick={required ? undefined : onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-green-600 px-6 pt-6 pb-5 text-center relative">
            {!required && (
              <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-white/70 hover:text-white text-xl leading-none">×</button>
            )}
            <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 text-white text-[11px] font-semibold px-3 py-1 rounded-full mb-3">
              📍 Now live in your neighborhood
            </span>
            <h2 className="text-2xl font-black text-white leading-tight">Your neighborhood, unlocked.</h2>
            <p className="text-sm text-green-100 mt-1.5">Create your free profile to search, save, and support local.</p>
          </div>

          {/* Local Bucks bonus */}
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0">🪙</span>
            <div>
              <p className="text-sm font-bold text-amber-900 leading-tight">Get 10 Local Bucks the moment you join</p>
              <p className="text-xs text-amber-700">Spend them at local businesses around town</p>
            </div>
          </div>

          {sent ? (
            /* ── Code (OTP) step ── */
            <div className="px-6 py-6">
              <p className="text-4xl text-center mb-2">📬</p>
              <h3 className="text-lg font-bold text-gray-900 text-center">Check your email</h3>
              <p className="text-sm text-gray-500 text-center mt-1 mb-4">
                We sent a code to <strong>{email}</strong>. Enter it below to finish — no need to leave this page.
              </p>
              <form onSubmit={handleVerify} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="12345678"
                  className="w-full text-center tracking-[0.35em] text-2xl font-bold border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}
                <button
                  type="submit"
                  disabled={verifying || code.length < 6}
                  className="w-full bg-green-600 text-white text-base font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {verifying ? "Verifying..." : "Verify & continue"}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Value rows */}
              <div className="px-6 pt-5 pb-1 space-y-4">
                {VALUES.map((v) => (
                  <div key={v.title} className="flex gap-3">
                    <span className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-lg shrink-0">{v.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight">{v.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{v.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Inline signup */}
              <div className="px-6 pt-4 pb-6">
                <form onSubmit={handleSignup} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="relative">
                    <input
                      type={pwVisible ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Create a password (min 8 chars)"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => setPwVisible((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      {pwVisible ? "Hide" : "Show"}
                    </button>
                  </div>

                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

                  {CAPTCHA_ON && <TurnstileWidget onVerify={setCaptchaToken} />}

                  <button
                    type="submit"
                    disabled={loading || (CAPTCHA_ON && !captchaToken)}
                    className="w-full bg-green-600 text-white text-base font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Creating account..." : "Create Free Account"}
                  </button>
                </form>

                <Link href={loginHref} className="block mt-2 border-2 border-gray-200 text-gray-800 text-center text-base font-bold py-3 rounded-xl hover:border-gray-400 transition-colors">
                  Log in
                </Link>
                {!required && (
                  <div className="flex items-center justify-center mt-3 text-xs">
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">Maybe later</button>
                  </div>
                )}
                <p className="text-center text-[10px] text-gray-400 mt-3">100% free · No credit card · Takes 30 seconds</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
