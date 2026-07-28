import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { submitGameFeedback } from "@/lib/feedback.functions";

/**
 * Attendee-facing feedback form. Short description + first name / last
 * initial. Everything submitted here shows up on the public backlog.
 */
export function FeedbackForm() {
  const submit = useServerFn(submitGameFeedback);
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { description, submitterName: name } });
      setDescription("");
      toast.success("Thanks! Your feedback is on the backlog.");
      qc.invalidateQueries({ queryKey: ["game_feedback"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="feedback"
      className="mt-10 rounded-lg border-2 border-mn-blue/30 bg-cream p-5 scroll-mt-24"
    >
      <h2 className="font-display text-2xl uppercase tracking-wide text-mn-blue">
        Tell us how to make the trail better
      </h2>
      <p className="mt-1 text-sm text-dark-gray/80">
        What tripped you up, what would you change? Every idea goes on the backlog below — the
        poster team builds them live, then you come back and play the improved version.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-mn-blue">
              Your feedback
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={3}
              maxLength={280}
              rows={3}
              placeholder="e.g. Make the document pickups easier to spot in Zone 3"
              className="mt-1 w-full rounded border-2 border-mn-blue/40 bg-white px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-dark-gray/60">{description.length}/280</span>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-mn-blue">
              First name & last initial
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={60}
              placeholder="Kevin S."
              className="mt-1 w-full rounded border-2 border-mn-blue/40 bg-white px-3 py-2 text-sm sm:max-w-xs"
            />
          </label>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="w-full sm:w-auto rounded bg-accent-orange px-6 py-3 text-sm font-black uppercase tracking-wide text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      </form>
    </section>
  );
}
