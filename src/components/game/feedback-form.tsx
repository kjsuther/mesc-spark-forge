import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { submitGameFeedback } from "@/lib/feedback.functions";
import { FEEDBACK_ROLES, OUTSIDE_US, US_STATES } from "@/lib/feedback-options";

const FIELD =
  "mt-1 w-full rounded border-2 border-mn-blue/40 bg-white px-3 py-2 text-sm text-dark-gray";
const LABEL = "text-xs font-bold uppercase tracking-wide text-mn-blue";

/**
 * Attendee-facing feedback form. Short description, first name / last
 * initial, plus role and where they're from for the backlog dashboard.
 */
export function FeedbackForm() {
  const submit = useServerFn(submitGameFeedback);
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [roleOther, setRoleOther] = useState("");
  const [locationState, setLocationState] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({
        data: {
          description,
          submitterName: name,
          role,
          roleOther,
          locationState,
          locationCountry: country,
        },
      });
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

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="block">
          <span className={LABEL}>Your feedback</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={3}
            maxLength={280}
            rows={3}
            placeholder="e.g. Make the document pickups easier to spot in Zone 3"
            className={FIELD}
          />
          <span className="text-[11px] text-dark-gray/60">{description.length}/280</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>First name & last initial</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={60}
              placeholder="Kevin S."
              className={FIELD}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Your role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className={FIELD}
            >
              <option value="">Select a role…</option>
              {FEEDBACK_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {role === "Other" && (
              <input
                value={roleOther}
                onChange={(e) => setRoleOther(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Tell us your role"
                className={FIELD}
              />
            )}
          </label>

          <label className="block">
            <span className={LABEL}>Where you're from</span>
            <select
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              required
              className={FIELD}
            >
              <option value="">Select a state…</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
              <option value={OUTSIDE_US}>{OUTSIDE_US}</option>
            </select>
            {locationState === OUTSIDE_US && (
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Your country"
                className={FIELD}
              />
            )}
          </label>
        </div>

        <div>
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

