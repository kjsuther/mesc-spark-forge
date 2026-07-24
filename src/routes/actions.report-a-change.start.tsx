import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/actions/report-a-change/start")({
  head: () => ({
    meta: [
      { title: "Report a change — [Your State] DHS Navigator" },
      { name: "description", content: "Tell us about a new address, income change, household change, or contact update." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportAChangeFlow,
});

type ChangeType = "address" | "income" | "household" | "contact";

type State = {
  step: number;
  // Step 1
  fullName: string;
  caseId: string;
  phone: string;
  email: string;
  // Step 2
  changes: ChangeType[];
  // Step 3 details
  address: { street: string; city: string; state: string; zip: string; effective: string };
  income: { who: string; monthly: string; employer: string; effective: string };
  household: { direction: "added" | "removed" | ""; name: string; relationship: string; effective: string };
  contact: { newPhone: string; newEmail: string };
  // Post-submit
  reference: string | null;
};

const CHANGE_LABELS: Record<ChangeType, string> = {
  address: "Address / moved",
  income: "Income change",
  household: "Household size",
  contact: "Contact info",
};

const STEP_LABELS = ["Who you are", "What changed", "Details", "Review", "Done"];

function ReportAChangeFlow() {
  const [s, setS] = useState<State>({
    step: 0,
    fullName: "",
    caseId: "",
    phone: "",
    email: "",
    changes: [],
    address: { street: "", city: "", state: "", zip: "", effective: "" },
    income: { who: "", monthly: "", employer: "", effective: "" },
    household: { direction: "", name: "", relationship: "", effective: "" },
    contact: { newPhone: "", newEmail: "" },
    reference: null,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  function next() {
    const errs: string[] = [];
    if (s.step === 0) {
      if (!s.fullName.trim()) errs.push("Please enter your full name.");
      if (!s.phone.trim() && !s.email.trim()) errs.push("Please enter a phone number or an email.");
    }
    if (s.step === 1) {
      if (s.changes.length === 0) errs.push("Pick at least one type of change.");
    }
    if (s.step === 2) {
      if (s.changes.includes("address")) {
        const a = s.address;
        if (!a.street || !a.city || !a.state || !a.zip || !a.effective)
          errs.push("Fill in the new address, including the date it started.");
      }
      if (s.changes.includes("income")) {
        const i = s.income;
        if (!i.who || !i.monthly || !i.effective) errs.push("Fill in who, the new monthly amount, and the date.");
      }
      if (s.changes.includes("household")) {
        const h = s.household;
        if (!h.direction || !h.name || !h.relationship || !h.effective)
          errs.push("Fill in the household change details.");
      }
      if (s.changes.includes("contact")) {
        const c = s.contact;
        if (!c.newPhone && !c.newEmail) errs.push("Enter a new phone or a new email.");
      }
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setS((p) => ({ ...p, step: p.step + 1 }));
  }

  function back() {
    setErrors([]);
    setS((p) => ({ ...p, step: Math.max(0, p.step - 1) }));
  }

  function submit() {
    const ref = `ST-${Date.now().toString().slice(-8)}`;
    setS((p) => ({ ...p, reference: ref, step: 4 }));
  }

  function reset() {
    setErrors([]);
    setS({
      step: 0,
      fullName: "",
      caseId: "",
      phone: "",
      email: "",
      changes: [],
      address: { street: "", city: "", state: "", zip: "", effective: "" },
      income: { who: "", monthly: "", employer: "", effective: "" },
      household: { direction: "", name: "", relationship: "", effective: "" },
      contact: { newPhone: "", newEmail: "" },
      reference: null,
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main className="max-w-3xl w-full mx-auto py-10 px-6 flex-1">
        <div className="mb-4">
          <Link to="/actions/$slug" params={{ slug: "report-a-change" }} className="text-sm text-mn-blue font-semibold hover:underline">
            ← Back to Report a change
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-mn-blue mb-2 tracking-tight">Report a change</h1>
        <p className="text-dark-gray/70 mb-6">Step {Math.min(s.step + 1, STEP_LABELS.length)} of {STEP_LABELS.length} — {STEP_LABELS[s.step]}</p>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {STEP_LABELS.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i <= s.step ? "bg-mn-green" : "bg-light-gray"}`} />
          ))}
        </div>

        {errors.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <ul className="list-disc pl-5 space-y-1">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="bg-cream/30 border border-light-gray rounded-2xl p-6 md:p-8">
          {s.step === 0 && (
            <div className="space-y-4">
              <Field label="Full name *">
                <input className={inputCls} value={s.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </Field>
              <Field label="Case or ID number (optional)">
                <input className={inputCls} value={s.caseId} onChange={(e) => set("caseId", e.target.value)} />
              </Field>
              <Field label="Phone *">
                <input className={inputCls} value={s.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Email * (phone or email required)">
                <input className={inputCls} value={s.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
            </div>
          )}

          {s.step === 1 && (
            <div className="space-y-3">
              <p className="font-semibold text-mn-blue mb-2">Pick everything that changed:</p>
              {(Object.keys(CHANGE_LABELS) as ChangeType[]).map((t) => (
                <label key={t} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-mn-green"
                    checked={s.changes.includes(t)}
                    onChange={(e) => {
                      set("changes", e.target.checked ? [...s.changes, t] : s.changes.filter((x) => x !== t));
                    }}
                  />
                  <span className="font-medium">{CHANGE_LABELS[t]}</span>
                </label>
              ))}
            </div>
          )}

          {s.step === 2 && (
            <div className="space-y-8">
              {s.changes.includes("address") && (
                <Section title="New address">
                  <Field label="Street"><input className={inputCls} value={s.address.street} onChange={(e) => set("address", { ...s.address, street: e.target.value })} /></Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="City"><input className={inputCls} value={s.address.city} onChange={(e) => set("address", { ...s.address, city: e.target.value })} /></Field>
                    <Field label="State"><input className={inputCls} value={s.address.state} onChange={(e) => set("address", { ...s.address, state: e.target.value })} /></Field>
                    <Field label="ZIP"><input className={inputCls} value={s.address.zip} onChange={(e) => set("address", { ...s.address, zip: e.target.value })} /></Field>
                  </div>
                  <Field label="Date effective"><input type="date" className={inputCls} value={s.address.effective} onChange={(e) => set("address", { ...s.address, effective: e.target.value })} /></Field>
                </Section>
              )}
              {s.changes.includes("income") && (
                <Section title="Income change">
                  <Field label="Who's income?"><input className={inputCls} value={s.income.who} onChange={(e) => set("income", { ...s.income, who: e.target.value })} /></Field>
                  <Field label="New monthly amount ($)"><input className={inputCls} inputMode="decimal" value={s.income.monthly} onChange={(e) => set("income", { ...s.income, monthly: e.target.value })} /></Field>
                  <Field label="Employer (optional)"><input className={inputCls} value={s.income.employer} onChange={(e) => set("income", { ...s.income, employer: e.target.value })} /></Field>
                  <Field label="Date effective"><input type="date" className={inputCls} value={s.income.effective} onChange={(e) => set("income", { ...s.income, effective: e.target.value })} /></Field>
                </Section>
              )}
              {s.changes.includes("household") && (
                <Section title="Household change">
                  <Field label="Added or removed?">
                    <select className={inputCls} value={s.household.direction} onChange={(e) => set("household", { ...s.household, direction: e.target.value as "added" | "removed" | "" })}>
                      <option value="">Choose…</option>
                      <option value="added">Someone joined the home</option>
                      <option value="removed">Someone left the home</option>
                    </select>
                  </Field>
                  <Field label="Person's name"><input className={inputCls} value={s.household.name} onChange={(e) => set("household", { ...s.household, name: e.target.value })} /></Field>
                  <Field label="Relationship (e.g. child, parent)"><input className={inputCls} value={s.household.relationship} onChange={(e) => set("household", { ...s.household, relationship: e.target.value })} /></Field>
                  <Field label="Date effective"><input type="date" className={inputCls} value={s.household.effective} onChange={(e) => set("household", { ...s.household, effective: e.target.value })} /></Field>
                </Section>
              )}
              {s.changes.includes("contact") && (
                <Section title="Contact info">
                  <Field label="New phone"><input className={inputCls} value={s.contact.newPhone} onChange={(e) => set("contact", { ...s.contact, newPhone: e.target.value })} /></Field>
                  <Field label="New email"><input className={inputCls} value={s.contact.newEmail} onChange={(e) => set("contact", { ...s.contact, newEmail: e.target.value })} /></Field>
                </Section>
              )}
            </div>
          )}

          {s.step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-mn-blue">Review your change</h2>
              <ReviewBlock title="Who you are">
                <p><strong>Name:</strong> {s.fullName}</p>
                {s.caseId && <p><strong>Case/ID:</strong> {s.caseId}</p>}
                {s.phone && <p><strong>Phone:</strong> {s.phone}</p>}
                {s.email && <p><strong>Email:</strong> {s.email}</p>}
              </ReviewBlock>
              {s.changes.includes("address") && (
                <ReviewBlock title="New address">
                  <p>{s.address.street}, {s.address.city}, {s.address.state} {s.address.zip}</p>
                  <p><strong>Effective:</strong> {s.address.effective}</p>
                </ReviewBlock>
              )}
              {s.changes.includes("income") && (
                <ReviewBlock title="Income change">
                  <p><strong>Who:</strong> {s.income.who}</p>
                  <p><strong>New monthly:</strong> ${s.income.monthly}</p>
                  {s.income.employer && <p><strong>Employer:</strong> {s.income.employer}</p>}
                  <p><strong>Effective:</strong> {s.income.effective}</p>
                </ReviewBlock>
              )}
              {s.changes.includes("household") && (
                <ReviewBlock title="Household change">
                  <p><strong>{s.household.direction === "added" ? "Joined" : "Left"}:</strong> {s.household.name} ({s.household.relationship})</p>
                  <p><strong>Effective:</strong> {s.household.effective}</p>
                </ReviewBlock>
              )}
              {s.changes.includes("contact") && (
                <ReviewBlock title="Contact info">
                  {s.contact.newPhone && <p><strong>New phone:</strong> {s.contact.newPhone}</p>}
                  {s.contact.newEmail && <p><strong>New email:</strong> {s.contact.newEmail}</p>}
                </ReviewBlock>
              )}
            </div>
          )}

          {s.step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-mn-green text-white grid place-items-center text-3xl mx-auto mb-4">✓</div>
              <h2 className="text-2xl font-bold text-mn-blue mb-2">We've got your change</h2>
              <p className="text-dark-gray/70 mb-4">Your reference number:</p>
              <p className="text-xl font-mono font-bold text-mn-blue mb-6">{s.reference}</p>
              <p className="text-sm text-dark-gray/70 max-w-md mx-auto mb-8">
                A caseworker will review what you reported. If anything else is needed, we'll reach out using the contact info you gave.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button onClick={reset} className="bg-mn-green text-white font-bold py-2 px-5 rounded-xl hover:bg-mn-green/90">
                  Start another change
                </button>
                <Link to="/tool" className="bg-white border-2 border-mn-blue text-mn-blue font-bold py-2 px-5 rounded-xl hover:bg-mn-blue/5">
                  Back to tool
                </Link>
              </div>
            </div>
          )}
        </div>

        {s.step < 4 && (
          <div className="flex justify-between mt-6">
            <button
              onClick={back}
              disabled={s.step === 0}
              className="py-2 px-5 rounded-xl border-2 border-light-gray text-dark-gray font-semibold disabled:opacity-40"
            >
              Back
            </button>
            {s.step < 3 ? (
              <button onClick={next} className="bg-mn-blue text-white font-bold py-2 px-6 rounded-xl hover:bg-mn-blue/90">
                Continue
              </button>
            ) : (
              <button onClick={submit} className="bg-mn-green text-white font-bold py-2 px-6 rounded-xl hover:bg-mn-green/90">
                Submit change
              </button>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border-2 border-light-gray rounded-lg focus:outline-none focus:border-mn-blue bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-mn-blue mb-1">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-mn-blue text-lg border-b border-light-gray pb-1">{title}</h3>
      {children}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-light-gray">
      <h3 className="font-bold text-mn-blue mb-2">{title}</h3>
      <div className="text-sm space-y-1 text-dark-gray/80">{children}</div>
    </div>
  );
}
