"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LS_CITY_KEY } from "@/lib/cities";
import CitySelector from "@/components/CitySelector";

const JOB_TYPE_CONFIG = {
  full_time: { label: "Full-Time", icon: "🕘", color: "bg-blue-100 text-blue-700" },
  part_time: { label: "Part-Time", icon: "⏰", color: "bg-teal-100 text-teal-700" },
  gig:       { label: "Gig",       icon: "⚡", color: "bg-amber-100 text-amber-700" },
  contract:  { label: "Contract",  icon: "📝", color: "bg-purple-100 text-purple-700" },
  seasonal:  { label: "Seasonal",  icon: "🍂", color: "bg-orange-100 text-orange-700" },
};

const RADIUS_OPTIONS = [
  { value: 10,  label: "10 mi — just my town" },
  { value: 25,  label: "25 mi — nearby towns" },
  { value: 50,  label: "50 mi — wider region" },
  { value: 100, label: "100 mi — whole area" },
];

type Job = {
  id: string;
  user_id: string;
  vendor_id: string | null;
  title: string;
  description: string;
  job_type: string;
  pay_label: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  application_url: string | null;
  city: string;
  state: string | null;
  city_slug: string;
  radius_miles: number;
  created_at: string;
  distance_miles: number;
  author: { id: string; full_name: string | null; avatar_url: string | null } | null;
  vendor: { id: string; business_name: string; slug: string; logo_url: string | null } | null;
};

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  center: { latitude: number; longitude: number } | null;
  jobs: Job[];
  currentUser: { id: string; full_name: string | null; avatar_url: string | null; role: string } | null;
  myVendor: { id: string; business_name: string; slug: string; logo_url: string | null } | null;
}

export default function JobsBoardClient({
  citySlug, cityName, stateCode, center,
  jobs: initialJobs, currentUser, myVendor,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const isAdmin = currentUser?.role === "admin";

  // Switch towns — browse any town's jobs (travelers, nearby areas)
  function switchCity(slug: string) {
    if (slug === citySlug) return;
    localStorage.setItem(LS_CITY_KEY, slug);
    if (currentUser) {
      supabase.from("profiles").update({ default_city: slug }).eq("id", currentUser.id).then(() => {});
    }
    router.push(`/jobs/${slug}`);
  }

  const [jobs, setJobs] = useState(initialJobs);
  const [filterType, setFilterType] = useState("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Post-a-job composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState("full_time");
  const [payLabel, setPayLabel] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [postAsBusiness, setPostAsBusiness] = useState(!!myVendor);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Post-payment return banner (Stripe redirects back with ?posted / ?post_cancelled).
  const [payToast, setPayToast] = useState<null | "posted" | "cancelled">(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("posted") === "1") setPayToast("posted");
    else if (p.get("post_cancelled") === "1") setPayToast("cancelled");
    if (p.has("posted") || p.has("post_cancelled")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Local Bucks — cover up to 20% of the first month ($1 off the $5 post).
  const [lbBalance, setLbBalance] = useState(0);
  const [useLB, setUseLB] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    supabase.from("profiles").select("local_bucks").eq("id", currentUser.id).single()
      .then(({ data }) => setLbBalance(data?.local_bucks ?? 0));
  }, [currentUser, supabase]);

  // Apply modal
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [applicantName, setApplicantName] = useState(currentUser?.full_name ?? "");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySent, setApplySent] = useState(false);

  const filteredJobs = filterType === "all" ? jobs : jobs.filter((j) => j.job_type === filterType);

  // "company.com/careers" -> "https://company.com/careers"; empty -> null
  function normalizeUrl(raw: string): string | null {
    const url = raw.trim();
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  async function submitJob(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) { router.push("/login"); return; }
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setPostError(null);

    // Create the job as a draft (inactive). It goes live once the $5/month
    // subscription is paid — the Stripe webhook flips is_active to true.
    const { data, error } = await supabase.from("jobs").insert({
      user_id: currentUser.id,
      vendor_id: postAsBusiness && myVendor ? myVendor.id : null,
      title: title.trim(),
      description: description.trim(),
      job_type: jobType,
      pay_label: payLabel.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      application_url: normalizeUrl(applicationUrl),
      city: cityName,
      state: stateCode,
      city_slug: citySlug,
      latitude: center?.latitude ?? null,
      longitude: center?.longitude ?? null,
      radius_miles: radiusMiles,
      is_active: false,
    }).select("id").single();

    if (error || !data) {
      setPostError("Could not start your posting. Please try again.");
      setSubmitting(false);
      return;
    }

    // Send them to Stripe Checkout for the $5/month listing subscription.
    try {
      const res = await fetch("/api/jobs/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: data.id, apply_local_bucks: useLB ? Math.min(1, lbBalance) : 0 }),
      });
      const out = await res.json();
      if (out.url) { window.location.href = out.url; return; }
      setPostError(out.error ?? "Could not start checkout. Please try again.");
    } catch {
      setPostError("Could not reach checkout. Please try again.");
    }
    // Checkout didn't start — clean up the orphaned draft so it doesn't linger.
    await supabase.from("jobs").delete().eq("id", data.id);
    setSubmitting(false);
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Delete this job posting? This also cancels its $5/month subscription.")) return;
    // Route through the server so the Stripe subscription is canceled too — no
    // more billing for a listing that's gone.
    const res = await fetch("/api/jobs/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } else {
      alert("Could not delete job. Please try again.");
    }
  }

  function openApply(job: Job) {
    setApplyJob(job);
    setApplySent(false);
    setApplyMessage("");
  }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!applyJob || !applicantName.trim() || !applicantEmail.trim()) return;
    setApplySubmitting(true);
    try {
      const res = await fetch("/api/job-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: applyJob.id,
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          applicantPhone: applicantPhone.trim() || null,
          message: applyMessage.trim() || null,
        }),
      });
      if (res.ok) setApplySent(true);
      else alert("Could not send your application. Please try again.");
    } catch {
      alert("Could not send your application. Please try again.");
    }
    setApplySubmitting(false);
  }

  function avatar(name: string | null, url: string | null, size = "w-8 h-8") {
    return (
      <div className={`${size} rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden text-sm`}>
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : (name ?? "?")[0].toUpperCase()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Apply modal */}
      {applyJob && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setApplyJob(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            {applySent ? (
              <div className="text-center py-4">
                <p className="text-4xl mb-3">✅</p>
                <h3 className="font-bold text-gray-900 mb-1">Application sent!</h3>
                <p className="text-sm text-gray-500 mb-5">The poster of "{applyJob.title}" has been notified.</p>
                <button onClick={() => setApplyJob(null)}
                  className="bg-green-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-green-700 transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submitApplication}>
                <h3 className="font-bold text-gray-900 mb-1">Apply for "{applyJob.title}"</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {applyJob.vendor?.business_name ?? applyJob.author?.full_name ?? "The poster"} will get your info.
                </p>
                <div className="space-y-3 mb-5">
                  <input type="text" required value={applicantName} onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Your name *"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="email" required value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="Your email *"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="tel" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="Your phone (optional)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <textarea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)}
                    placeholder="A short note about yourself (optional)" rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setApplyJob(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={applySubmitting || !applicantName.trim() || !applicantEmail.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                    {applySubmitting ? "Sending..." : "Send Application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sub-header (sits below the global header) */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <CitySelector value={citySlug} onChange={(slug) => switchCity(slug)} />
          {isAdmin && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-full">Admin</span>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Board tabs — Local Jobs is a sibling of Local Loop and Explore */}
        <div className="flex gap-2 mb-4">
          <Link href={`/community/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            🏘️ Local Loop
          </Link>
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white">
            💼 Local Jobs
          </span>
          <Link href={`/explore/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            🌿 Explore
          </Link>
        </div>

        {/* Return from Stripe Checkout */}
        {payToast === "posted" && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
            <span className="text-lg">✅</span>
            <p className="text-sm text-green-800"><strong>Payment received — your job is going live!</strong> It appears here within a few seconds; refresh if you don't see it yet.</p>
            <button onClick={() => setPayToast(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
          </div>
        )}
        {payToast === "cancelled" && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
            <span className="text-lg">↩️</span>
            <p className="text-sm text-gray-700">Checkout cancelled — your job wasn't posted and you weren't charged.</p>
            <button onClick={() => setPayToast(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Jobs in {cityName}
        </h1>
        <p className="text-sm text-gray-500 mb-5">Local openings, plus jobs from nearby towns within their posted radius.</p>

        {/* Post a Job */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          {currentUser ? (
            !composerOpen ? (
              <button onClick={() => setComposerOpen(true)}
                className="w-full flex items-center gap-3 text-left">
                {avatar(currentUser.full_name, currentUser.avatar_url)}
                <span className="flex-1 text-sm text-gray-400 border border-gray-200 rounded-full px-4 py-2.5 hover:border-green-400 transition-colors">
                  Hiring? Post a job for {cityName}…
                </span>
                <span className="shrink-0 bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-green-700 transition-colors">
                  Post a Job
                </span>
              </button>
            ) : (
              <form onSubmit={submitJob} className="space-y-3">
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Job title, e.g. Line Cook, Snow Removal Help *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500" />
                <textarea required value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the job — duties, schedule, requirements… *" rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />

                {/* Job type pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(JOB_TYPE_CONFIG).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => setJobType(key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        jobType === key ? "bg-green-100 text-green-800 border border-green-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" value={payLabel} onChange={(e) => setPayLabel(e.target.value)}
                    placeholder='Pay, e.g. "$18-22/hr" or "DOE"'
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Contact email"
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Contact phone"
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                <div>
                  <input type="text" value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)}
                    placeholder="🔗 Application link (optional), e.g. yourcompany.com/careers"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <p className="text-xs text-gray-400 mt-1">If you use an outside application page, applicants will be sent there instead of the built-in form.</p>
                </div>

                {/* Visibility radius */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-xs font-semibold text-gray-600 shrink-0">📡 Who can see it:</label>
                  <select value={radiusMiles} onChange={(e) => setRadiusMiles(Number(e.target.value))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    {RADIUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">Towns within this distance of {cityName} will see your job.</span>
                </div>

                {myVendor && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={postAsBusiness} onChange={(e) => setPostAsBusiness(e.target.checked)} className="accent-green-600" />
                    Post as <strong>{myVendor.business_name}</strong>
                  </label>
                )}

                {postError && <p className="text-sm text-red-500">{postError}</p>}

                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-800">
                  <span className="text-base">💳</span>
                  <span><strong>$5/month</strong> keeps your job live to local job-seekers. Cancel anytime — deleting the job cancels the subscription.</span>
                </div>

                {lbBalance > 0 && (
                  <label className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 cursor-pointer">
                    <input type="checkbox" checked={useLB} onChange={(e) => setUseLB(e.target.checked)} className="accent-amber-500" />
                    <span>Apply <strong>1 🪙</strong> Local Buck — first month <strong>$4.00</strong>, then $5/mo</span>
                  </label>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                  <button type="button" onClick={() => setComposerOpen(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                  <button type="submit" disabled={submitting || !title.trim() || !description.trim()}
                    className="bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-full hover:bg-green-700 disabled:opacity-40 transition-colors">
                    {submitting ? "Starting checkout…" : "Continue to payment — $5/mo →"}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 mb-2">Hiring in {cityName}? Post a job for your neighbors.</p>
              <Link href="/login" className="bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-full hover:bg-green-700 transition-colors inline-block">
                Log in to post a job
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[["all", "All", ""], ...Object.entries(JOB_TYPE_CONFIG).map(([k, v]) => [k, v.label, v.icon])].map(([key, label, icon]) => (
            <button key={key} onClick={() => setFilterType(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === key ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}>
              {icon && <span>{icon}</span>} {label}
            </button>
          ))}
        </div>

        {/* Jobs */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💼</p>
            <p className="text-gray-600 font-semibold mb-1">No jobs posted yet</p>
            <p className="text-gray-400 text-sm">Be the first to post an opening in {cityName}!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => {
              const cfg = JOB_TYPE_CONFIG[job.job_type as keyof typeof JOB_TYPE_CONFIG] ?? JOB_TYPE_CONFIG.full_time;
              const isExpanded = expandedJob === job.id;
              const fromOtherTown = job.city_slug !== citySlug;
              const canDelete = isAdmin || currentUser?.id === job.user_id;
              const longDescription = job.description.length > 240;

              return (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex gap-3">
                    {job.vendor ? (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden text-sm ${job.vendor.logo_url ? "bg-white border border-gray-100" : "bg-green-100"}`}>
                        {job.vendor.logo_url
                          ? <img src={job.vendor.logo_url} alt="" className="w-full h-full object-contain" />
                          : job.vendor.business_name[0]}
                      </div>
                    ) : (
                      avatar(job.author?.full_name ?? null, job.author?.avatar_url ?? null)
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-gray-900">{job.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(job.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {job.vendor ? (
                          <Link href={`/vendors/${job.vendor.slug}`} className="font-semibold text-green-700 hover:underline">
                            {job.vendor.business_name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{job.author?.full_name ?? "Neighbor"}</span>
                        )}
                        <span className="mx-1.5 text-gray-300">·</span>
                        📍 {job.city}{job.state ? `, ${job.state}` : ""}
                        {fromOtherTown && job.distance_miles > 0.5 && (
                          <span className="text-amber-600 font-medium"> · {Math.round(job.distance_miles)} mi away</span>
                        )}
                        {job.pay_label && (
                          <>
                            <span className="mx-1.5 text-gray-300">·</span>
                            <span className="font-semibold text-green-700">💵 {job.pay_label}</span>
                          </>
                        )}
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {isExpanded || !longDescription ? job.description : `${job.description.slice(0, 240)}…`}
                      </p>
                      {longDescription && (
                        <button onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                          className="text-xs text-green-600 font-medium hover:underline mt-1">
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                    {job.application_url ? (
                      <a href={job.application_url} target="_blank" rel="noopener noreferrer"
                        className="bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                        Apply ↗
                      </a>
                    ) : (
                      <button onClick={() => openApply(job)}
                        className="bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                        Apply
                      </button>
                    )}
                    {job.contact_email && (
                      <a href={`mailto:${job.contact_email}?subject=${encodeURIComponent(`Re: ${job.title} (Everything Local)`)}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 bg-gray-100 hover:bg-green-50 hover:text-green-700 transition-colors">
                        ✉️ Email
                      </a>
                    )}
                    {job.contact_phone && (
                      <a href={`tel:${job.contact_phone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 bg-gray-100 hover:bg-green-50 hover:text-green-700 transition-colors">
                        📞 Call
                      </a>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteJob(job.id)}
                        className="ml-auto text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
