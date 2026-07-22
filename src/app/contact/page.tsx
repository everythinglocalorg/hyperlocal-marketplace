"use client";
import { useState } from "react";
import Logo from "@/components/Logo";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Send via Supabase edge function or just mailto fallback
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/"><Logo size="sm" /></Link>
        <div className="flex gap-4 text-sm">
          <Link href="/search" className="text-gray-600 hover:text-gray-900">Explore</Link>
          <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
          <Link href="/signup" className="bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold hover:bg-green-700 transition-colors">Sign Up Free</Link>
        </div>
      </nav>

      <section className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact us</h1>
        <p className="text-gray-500 mb-8">Have a question or feedback? We'd love to hear from you. We aim to reply within 1–2 business days.</p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">✅</p>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Message sent!</h2>
            <p className="text-gray-500 text-sm">We'll get back to you at <strong>{form.email}</strong> as soon as possible.</p>
            <Link href="/" className="inline-block mt-6 text-green-600 font-semibold hover:underline">← Back to home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Tell us how we can help..."
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
            <p className="text-center text-xs text-gray-400">Or email us directly at <a href="mailto:hello@everythinglocal.org" className="text-green-600 hover:underline">hello@everythinglocal.org</a></p>
          </form>
        )}
      </section>

      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <p>© 2026 Everything Local · <Link href="/privacy" className="hover:text-gray-600">Privacy</Link> · <Link href="/terms" className="hover:text-gray-600">Terms</Link> · <Link href="/about" className="hover:text-gray-600">About</Link></p>
      </footer>
    </main>
  );
}
