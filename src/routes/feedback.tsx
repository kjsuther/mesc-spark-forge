import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { submitFeedback, feedbackSchema } from "@/lib/mutations";
import { ACTIONS } from "@/data/actions";
import { useQueryClient } from "@tanstack/react-query";

const searchSchema = z.object({ for: z.string().optional() });

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Share an idea — [Your State] DHS Navigator" },
      {
        name: "description",
        content:
          "Tell us what you wish this tool could, did, or would do. Your idea joins the live queue and can be built during the poster session.",
      },
      { property: "og:title", content: "Share an idea — [Your State] DHS Navigator" },
      {
        property: "og:description",
        content: "Attendees share ideas live; the top-voted ones get built during the poster session.",
      },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { for: forSlug } = Route.useSearch();
  const forAction = forSlug ? ACTIONS.find((a) => a.slug === forSlug) : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    wish: "",
    organization: "",
    role: "",
    state: "",
    email: "",
    notify_on_launch: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsed = feedbackSchema.parse({
        ...form,
        action_slug: forSlug ?? "",
      });
      await submitFeedback(parsed);
      qc.invalidateQueries({ queryKey: ["feedback"] });
      toast.success("Thanks — your idea is in the queue.");
      setDone(true);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.errors[0]?.message : (err as Error).message;
      toast.error(msg ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main id="main-content" className="max-w-3xl w-full mx-auto py-12 px-6 flex-1">
        <div className="mb-4">
          <Link to="/" className="text-sm text-mn-blue font-semibold hover:underline">
            ← Home
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-mn-blue mb-3 tracking-tight">Share an idea</h1>
          <p className="text-lg text-dark-gray/80">
            Finish this sentence — we'll add it to the live queue for attendees to vote on.
          </p>
          {forAction && (
            <div className="mt-4 inline-flex items-center gap-2 bg-sky-blue/20 text-mn-blue px-3 py-1.5 rounded-full text-sm font-semibold border border-sky-blue/40">
              About: {forAction.title}
            </div>
          )}
        </header>

        {done ? (
          <div className="bg-cream/40 border border-accent-gold/50 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-mn-blue mb-3">Thanks — it's in the queue.</h2>
            <p className="text-dark-gray/80 mb-6">
              Head to the queue to vote on ideas (yours included). You get 5 votes.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => navigate({ to: "/backlog" })}
                className="bg-mn-blue text-white font-bold py-3 px-5 rounded-xl hover:bg-mn-blue/90 min-h-11"
              >
                Go to backlog
              </button>
              <button
                onClick={() => {
                  setForm({ wish: "", organization: "", role: "", state: "", email: "", notify_on_launch: false });
                  setDone(false);
                }}
                className="bg-white border-2 border-mn-blue text-mn-blue font-bold py-3 px-5 rounded-xl hover:bg-mn-blue hover:text-white"
              >
                Add another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-cream/40 p-6 rounded-2xl border-2 border-accent-gold/60">
              <label htmlFor="wish" className="block text-mn-blue font-bold mb-2 text-lg">
                I wish this tool could / did / would…
              </label>
              <textarea
                id="wish"
                required
                minLength={3}
                maxLength={500}
                value={form.wish}
                onChange={(e) => setForm({ ...form, wish: e.target.value })}
                placeholder="…send me a text when my documents are approved."
                className="w-full h-28 p-4 rounded-xl border-2 border-light-gray bg-white focus:border-mn-green focus:outline-none text-base"
              />
              <div className="text-xs text-dark-gray/60 mt-1 text-right">
                {form.wish.length}/500
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-light-gray p-6">
              <p className="text-mn-blue font-bold mb-1">Optional — helps us understand who's speaking</p>
              <p className="text-xs text-dark-gray/60 mb-4">Skip anything you don't want to share.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Organization" value={form.organization} onChange={(v) => setForm({ ...form, organization: v })} placeholder="Ramsey County" />
                <Field label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} placeholder="Case manager" />
                <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} placeholder="Your state" />
                <Field label="Work email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@northstar-dhs.example" type="email" />
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-dark-gray cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify_on_launch}
                  onChange={(e) => setForm({ ...form, notify_on_launch: e.target.checked })}
                  className="mt-1 w-5 h-5 accent-mn-green"
                />
                <span>Email me when the final version of this tool ships.</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-mn-blue text-white font-bold py-3 px-6 rounded-xl hover:bg-mn-blue/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Submit idea"}
              </button>
              <Link
                to="/backlog"
                className="bg-white border-2 border-mn-blue text-mn-blue font-bold py-3 px-6 rounded-xl hover:bg-mn-blue hover:text-white transition-colors min-h-11 inline-flex items-center"
              >
                See the backlog
              </Link>
            </div>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-dark-gray uppercase tracking-widest mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 rounded-lg border-2 border-light-gray focus:border-mn-green focus:outline-none"
      />
    </label>
  );
}
