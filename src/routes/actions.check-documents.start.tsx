import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/actions/check-documents/start")({
  head: () => ({
    meta: [
      { title: "Prepare Your Documents — [Your State] DHS Navigator" },
      { name: "description", content: "Answer a few quick questions and get a personalized document checklist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckDocumentsFlow,
});

type Doing = "apply" | "renew" | "change" | "unsure" | "";
type Basis = "fca" | "abd" | "unsure" | "";
type AbdReason = "age" | "blind" | "disabled" | "";
type Citizen = "yes" | "no" | "unsure" | "";
type IncomeSource = "job" | "self" | "benefits" | "ssi";

type State = {
  step: number;
  doing: Doing;
  basis: Basis;
  abdReason: AbdReason;
  householdSize: string;
  hasIncome: "" | "yes" | "no";
  incomeSources: IncomeSource[];
  monthlyIncome: string;
  citizen: Citizen;
  hasSSN: "" | "yes" | "no";
};

const STEP_LABELS = ["What are you doing", "Who's applying", "Household & income", "Citizenship & SSN", "Your checklist"];

type Item = { title: string; description: string };
type Result = {
  needed: Record<string, Item[]>;
  notNeeded: Item[];
};

// Rough 2025 MN monthly income thresholds. Used ONLY to guess whether spenddown/asset
// verification may apply — the caseworker makes the actual determination.
function estimateOverIncomeLimit(basis: Basis, householdSize: number, monthly: number): boolean {
  if (!monthly || monthly <= 0) return false;
  if (basis === "fca") {
    // ~138% FPL, approx: $1,732 + $620 per additional person
    return monthly > 1732 + 620 * Math.max(0, householdSize - 1);
  }
  if (basis === "abd") {
    // ~100% FPL, approx: $1,255 + $450 per additional person
    return monthly > 1255 + 450 * Math.max(0, householdSize - 1);
  }
  return false;
}

// Reflects MN DHS EPM 2.2.1.2 (MA-FCA) and 2.3.1.1 (MA-ABD) mandatory verifications.
function buildChecklist(s: State): Result {
  const needed: Record<string, Item[]> = {
    "Income": [],
    "Citizenship & identity": [],
    "Assets": [],
    "Disability": [],
    "Spenddown": [],
    "Changes to report": [],
  };
  const notNeeded: Item[] = [];

  const householdSize = Math.max(1, parseInt(s.householdSize || "1", 10) || 1);
  const monthly = parseFloat(s.monthlyIncome || "0") || 0;
  const overLimit = s.hasIncome === "yes" && estimateOverIncomeLimit(s.basis, householdSize, monthly);
  const spenddownLikely = overLimit; // rough client-side estimate only

  // ---------- Income (mandatory pre-eligibility for both MA-FCA and MA-ABD) ----------
  if (s.hasIncome === "yes") {
    if (s.incomeSources.includes("job")) {
      needed.Income.push({ title: "Pay stubs from the last 30 days", description: "For everyone in the home who works a job. The agency will try electronic sources first — bring these if asked." });
    }
    if (s.incomeSources.includes("self")) {
      needed.Income.push({ title: "Self-employment income summary", description: "A recent profit/loss summary or bookkeeping export." });
    }
    if (s.incomeSources.includes("benefits")) {
      needed.Income.push({ title: "Benefit award letters", description: "Social Security, unemployment, VA, or other benefit statements." });
    }
    if (s.incomeSources.includes("ssi") && s.basis === "abd") {
      needed.Income.push({ title: "SSI award letter", description: "If you get SSI, only your SSI needs to be verified — but VA Aid & Attendance and VA unusual-medical-expense payments still need proof." });
    }
    if (s.incomeSources.length === 0) {
      needed.Income.push({ title: "Anything that shows current income", description: "The agency needs proof of current income for everyone whose income counts." });
    }
  } else if (s.hasIncome === "no") {
    notNeeded.push({
      title: "A written 'no income' statement",
      description: "No proof of 'no income' is required. If the agency asks and no electronic source or paper proof exists, you can self-attest.",
    });
  }

  // ---------- Citizenship / Immigration / SSN ----------
  needed["Citizenship & identity"].push({
    title: "Proof of U.S. citizenship or immigration status",
    description: "The agency checks federal data first. If they can't verify electronically, bring a passport, birth certificate, or immigration paperwork. Self-attestation is NOT accepted here.",
  });
  if (s.hasSSN === "yes") {
    needed["Citizenship & identity"].push({
      title: "Social Security number for each person applying",
      description: "The number itself is required — no separate card needed if the agency can verify it electronically.",
    });
  } else if (s.hasSSN === "no") {
    needed["Citizenship & identity"].push({
      title: "Reason you don't have an SSN",
      description: "If you have an approved exception (for example, a religious objection), bring documentation. Otherwise, apply for an SSN before or during your MA application.",
    });
  }

  // ---------- MA-ABD: Assets always required + Disability if applicable ----------
  if (s.basis === "abd") {
    needed.Assets.push({
      title: "Statements for bank accounts and other assets",
      description: "The Asset Verification Service (AVS) will check most accounts automatically. Bring recent statements if AVS can't verify or if you're near the asset limit.",
    });
    notNeeded.push({ title: "Your homestead", description: "Not required at application or renewal if it qualifies for the exclusion." });
    notNeeded.push({ title: "One vehicle", description: "Verification is not required if only one vehicle is reported." });
    notNeeded.push({ title: "Household goods & personal effects", description: "These do not need to be verified." });

    if (s.abdReason === "blind" || s.abdReason === "disabled") {
      needed.Disability.push({
        title: "Proof of disability or blindness",
        description: "A Social Security Administration (SSA) award letter, or a determination from the State Medical Review Team (SMRT).",
      });
    }
  }

  // ---------- Spenddown (auto-determined) ----------
  if (spenddownLikely) {
    needed.Spenddown.push({
      title: "Medical bills, receipts, or EOB statements",
      description: `Your reported income (about $${Math.round(monthly)}/mo for a household of ${householdSize}) looks like it may be over the MA income limit. Bring medical bills that can be used to meet a spenddown — the caseworker makes the final call.`,
    });
    if (s.basis === "fca") {
      needed.Assets.push({
        title: "Statements for bank accounts and other assets",
        description: "An asset limit applies to MA-FCA spenddown groups. Bring recent account statements.",
      });
      notNeeded.push({ title: "Your homestead", description: "Not required if it qualifies for the real-property homestead exclusion." });
      notNeeded.push({ title: "Vehicles (up to one per household member age 16+)", description: "These do not need to be verified for MA-FCA spenddown." });
      notNeeded.push({ title: "Household goods & personal effects", description: "These do not need to be verified." });
    }
  } else if (s.basis === "fca" && s.hasIncome === "yes") {
    // Under limit, MA-FCA — call out that assets are not required
    notNeeded.push({
      title: "Bank statements or asset proof",
      description: "MA-FCA does not have an asset test unless you're in a spenddown group. Based on the income you entered, that doesn't look like you.",
    });
  } else if (s.basis === "fca" && s.hasIncome === "no") {
    notNeeded.push({
      title: "Bank statements or asset proof",
      description: "MA-FCA has no asset test for most groups. Skip these unless the caseworker specifically asks.",
    });
  }

  // ---------- Things people commonly think they need but don't ----------
  notNeeded.push({
    title: "Photo ID (driver's license, state ID)",
    description: "Not a mandatory MA verification. Bring it if you have it, but it's not required.",
  });
  notNeeded.push({
    title: "Proof of who lives with you",
    description: "Household composition is self-reported. No lease, utility bill, or roommate letter is required.",
  });
  notNeeded.push({
    title: "Birth certificates for children in the home",
    description: "Not required as a household verification. (A birth certificate CAN be used as proof of U.S. citizenship if needed.)",
  });

  // ---------- Renewal / Change of circumstance ----------
  if (s.doing === "renew") {
    needed["Changes to report"].push({
      title: "Proof of anything that changed since last renewal",
      description: "New income, new address, new household member, or a new asset (if an asset limit applies to you).",
    });
  }
  if (s.doing === "change") {
    needed["Changes to report"].push({
      title: "Proof of the specific change",
      description: "For income: a pay stub or benefit letter. For a move: a new lease or utility bill. For a new baby: a birth certificate.",
    });
  }

  // Prune empty groups from needed
  const prunedNeeded = Object.fromEntries(Object.entries(needed).filter(([, v]) => v.length > 0));
  // Dedupe notNeeded by title
  const seen = new Set<string>();
  const prunedNotNeeded = notNeeded.filter((i) => (seen.has(i.title) ? false : (seen.add(i.title), true)));

  return { needed: prunedNeeded, notNeeded: prunedNotNeeded };
}

function CheckDocumentsFlow() {
  const [s, setS] = useState<State>({
    step: 0,
    doing: "",
    basis: "",
    abdReason: "",
    householdSize: "1",
    hasIncome: "",
    incomeSources: [],
    monthlyIncome: "",
    citizen: "",
    hasSSN: "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  function next() {
    const errs: string[] = [];
    if (s.step === 0 && !s.doing) errs.push("Pick what you're trying to do.");
    if (s.step === 1) {
      if (!s.basis) errs.push("Pick which type of Medical Assistance applies.");
      if (s.basis === "abd" && !s.abdReason) errs.push("Tell us the basis (age, blind, or disabled).");
    }
    if (s.step === 2) {
      if (!s.householdSize || parseInt(s.householdSize, 10) < 1) errs.push("Household size has to be at least 1.");
      if (!s.hasIncome) errs.push("Answer whether anyone has income.");
    }
    if (s.step === 3) {
      if (!s.citizen) errs.push("Answer the citizenship question.");
      if (!s.hasSSN) errs.push("Answer the Social Security number question.");
    }
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setS((p) => ({ ...p, step: p.step + 1 }));
  }
  function back() {
    setErrors([]);
    setS((p) => ({ ...p, step: Math.max(0, p.step - 1) }));
  }
  function reset() {
    setErrors([]);
    setS({ step: 0, doing: "", basis: "", abdReason: "", householdSize: "1", hasIncome: "", incomeSources: [], monthlyIncome: "", citizen: "", hasSSN: "" });
  }

  const result = s.step === 4 ? buildChecklist(s) : null;

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main className="max-w-3xl w-full mx-auto py-10 px-6 flex-1 print:py-4">
        <div className="mb-4 print:hidden">
          <Link to="/actions/$slug" params={{ slug: "check-documents" }} className="text-sm text-mn-blue font-semibold hover:underline">
            ← Back to Check documents
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-mn-blue mb-2 tracking-tight">Prepare Your Documents</h1>
        <p className="text-dark-gray/70 mb-6 print:hidden">Step {Math.min(s.step + 1, STEP_LABELS.length)} of {STEP_LABELS.length} — {STEP_LABELS[s.step]}</p>

        <div className="flex gap-2 mb-8 print:hidden">
          {STEP_LABELS.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i <= s.step ? "bg-mn-green" : "bg-light-gray"}`} />
          ))}
        </div>

        {errors.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <ul className="list-disc pl-5 space-y-1">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className="bg-cream/30 border border-light-gray rounded-2xl p-6 md:p-8 print:bg-white print:border-0 print:p-0">
          {s.step === 0 && (
            <div className="space-y-3">
              <p className="font-semibold text-mn-blue mb-2">What are you trying to do?</p>
              {([
                ["apply", "Apply for Medical Assistance"],
                ["renew", "Renew my coverage"],
                ["change", "Report a change"],
                ["unsure", "Not sure yet"],
              ] as [Doing, string][]).map(([val, label]) => (
                <label key={val} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer">
                  <input type="radio" name="doing" checked={s.doing === val} onChange={() => set("doing", val)} className="w-5 h-5 accent-mn-green" />
                  <span className="font-medium">{label}</span>
                </label>
              ))}
            </div>
          )}

          {s.step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-mn-blue mb-2">Which type of Medical Assistance applies?</p>
                <p className="text-xs text-dark-gray/70 mb-3">The required documents are different for each. Pick the one that best fits.</p>
                {([
                  ["fca", "Families with Children and Adults (under 65, not disabled)"],
                  ["abd", "Age 65+, or Blind, or has a Disability"],
                  ["unsure", "Not sure"],
                ] as [Basis, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer mb-2">
                    <input type="radio" name="basis" checked={s.basis === val} onChange={() => set("basis", val)} className="w-5 h-5 accent-mn-green" />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>

              {s.basis === "abd" && (
                <div>
                  <p className="font-semibold text-mn-blue mb-2">Which basis?</p>
                  {([
                    ["age", "Age 65 or older"],
                    ["blind", "Blind"],
                    ["disabled", "Has a disability"],
                  ] as [AbdReason, string][]).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer mb-2">
                      <input type="radio" name="abd" checked={s.abdReason === val} onChange={() => set("abdReason", val)} className="w-5 h-5 accent-mn-green" />
                      <span className="font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {s.step === 2 && (
            <div className="space-y-5">
              <label className="block">
                <span className="block text-sm font-semibold text-mn-blue mb-1">How many people are in your household?</span>
                <input type="number" min={1} className={inputCls} value={s.householdSize} onChange={(e) => set("householdSize", e.target.value)} />
              </label>

              <div>
                <p className="font-semibold text-mn-blue mb-2">Does anyone in the home have income?</p>
                <div className="flex gap-3">
                  {(["yes", "no"] as const).map((v) => (
                    <label key={v} className={`flex-1 text-center p-3 rounded-lg border-2 cursor-pointer ${s.hasIncome === v ? "border-mn-green bg-mn-green/10" : "border-light-gray hover:bg-white"}`}>
                      <input type="radio" name="income" checked={s.hasIncome === v} onChange={() => set("hasIncome", v)} className="sr-only" />
                      <span className="font-semibold capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              {s.hasIncome === "yes" && (
                <>
                  <label className="block">
                    <span className="block text-sm font-semibold text-mn-blue mb-1">Approximate total monthly household income (before taxes)</span>
                    <input type="number" min={0} placeholder="e.g. 2400" className={inputCls} value={s.monthlyIncome} onChange={(e) => set("monthlyIncome", e.target.value)} />
                    <span className="block text-xs text-dark-gray/60 mt-1">Used only to figure out whether a spenddown or asset test might apply — not stored or shared.</span>
                  </label>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-mn-blue">Where does the income come from? (pick all that apply)</p>
                    {(
                      [
                        ["job", "A job / paycheck"],
                        ["self", "Self-employment"],
                        ["benefits", "Benefits (Social Security, unemployment, VA, etc.)"],
                        ...(s.basis === "abd" ? [["ssi", "SSI (Supplemental Security Income)"] as [IncomeSource, string]] : []),
                      ] as [IncomeSource, string][]
                    ).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-3 p-2 rounded border border-light-gray hover:bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.incomeSources.includes(val)}
                          onChange={(e) => set("incomeSources", e.target.checked ? [...s.incomeSources, val] : s.incomeSources.filter((x) => x !== val))}
                          className="w-5 h-5 accent-mn-green"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {s.step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-mn-blue mb-2">Is everyone applying a U.S. citizen?</p>
                {([
                  ["yes", "Yes, everyone"],
                  ["no", "No, at least one person isn't"],
                  ["unsure", "Not sure"],
                ] as [Citizen, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer mb-2">
                    <input type="radio" name="citizen" checked={s.citizen === val} onChange={() => set("citizen", val)} className="w-5 h-5 accent-mn-green" />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>

              <div>
                <p className="font-semibold text-mn-blue mb-2">Does everyone applying have a Social Security number?</p>
                {([
                  ["yes", "Yes"],
                  ["no", "No / not everyone"],
                ] as ["yes" | "no", string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-3 p-3 rounded-lg border border-light-gray hover:bg-white cursor-pointer mb-2">
                    <input type="radio" name="ssn" checked={s.hasSSN === val} onChange={() => set("hasSSN", val)} className="w-5 h-5 accent-mn-green" />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {s.step === 4 && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-mn-blue mb-1">Your document checklist</h2>
                <p className="text-sm text-dark-gray/70">Based on Minnesota DHS mandatory verifications for Medical Assistance. The agency checks electronic sources first — bring paper proof if they can't verify electronically.</p>
              </div>

              {/* NEEDED */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-mn-green text-white font-bold">✓</span>
                  <h3 className="text-xl font-bold text-mn-blue">Bring these</h3>
                </div>
                {Object.entries(result.needed).length === 0 && (
                  <p className="text-sm text-dark-gray/70 italic">Nothing specific was flagged. The caseworker will let you know if anything else is needed.</p>
                )}
                {Object.entries(result.needed).map(([group, items]) => (
                  <div key={group} className="bg-white rounded-lg p-4 border border-light-gray">
                    <h4 className="font-bold text-mn-blue mb-3">{group}</h4>
                    <ul className="space-y-2">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <input type="checkbox" className="mt-1 w-5 h-5 accent-mn-green" aria-label={item.title} />
                          <div>
                            <p className="font-semibold text-mn-blue">{item.title}</p>
                            <p className="text-sm text-dark-gray/70">{item.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              {/* NOT NEEDED */}
              {result.notNeeded.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-dark-gray/70 text-white font-bold">✕</span>
                    <h3 className="text-xl font-bold text-dark-gray">You do NOT need to bring these</h3>
                  </div>
                  <div className="bg-light-gray/30 border-2 border-dashed border-dark-gray/30 rounded-lg p-4">
                    <ul className="space-y-3">
                      {result.notNeeded.map((item, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="mt-1 text-dark-gray/60 font-bold">✕</span>
                          <div>
                            <p className="font-semibold text-dark-gray line-through decoration-dark-gray/40">{item.title}</p>
                            <p className="text-sm text-dark-gray/70">{item.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              <p className="text-xs text-dark-gray/60 border-t border-light-gray pt-3">
                Source: MN DHS Eligibility Policy Manual sections 2.2.1.2 (MA-FCA) and 2.3.1.1 (MA-ABD). Income limits used to guess whether a spenddown may apply are approximate — the caseworker makes the final determination for your case.
              </p>

              <div className="flex flex-wrap gap-3 pt-2 print:hidden">
                <button onClick={() => window.print()} className="bg-mn-blue text-white font-bold py-2 px-5 rounded-xl hover:bg-mn-blue/90">
                  Print this list
                </button>
                <button onClick={reset} className="bg-white border-2 border-mn-blue text-mn-blue font-bold py-2 px-5 rounded-xl hover:bg-mn-blue/5">
                  Start over
                </button>
                <Link to="/tool" className="bg-white border-2 border-light-gray text-dark-gray font-bold py-2 px-5 rounded-xl hover:bg-light-gray/30">
                  Back to tool
                </Link>
              </div>
            </div>
          )}
        </div>

        {s.step < 4 && (
          <div className="flex justify-between mt-6 print:hidden">
            <button onClick={back} disabled={s.step === 0} className="py-2 px-5 rounded-xl border-2 border-light-gray text-dark-gray font-semibold disabled:opacity-40">
              Back
            </button>
            {s.step < 3 ? (
              <button onClick={next} className="bg-mn-blue text-white font-bold py-2 px-6 rounded-xl hover:bg-mn-blue/90">
                Continue
              </button>
            ) : (
              <button onClick={next} className="bg-mn-green text-white font-bold py-2 px-6 rounded-xl hover:bg-mn-green/90">
                See my checklist
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
