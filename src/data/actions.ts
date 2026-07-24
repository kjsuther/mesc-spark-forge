// Seed data for the 7 Medicaid Client Action Navigator actions.
// Each action ships a plain-language title, a 5-step roadmap, and a checklist.
import reportChangeImg from "@/assets/report-a-change.jpg";
import checkDocsImg from "@/assets/check-documents.jpg";

export type RoadmapStep = {
  key: string;
  label: string;
  estimate: string;
};

export type ChecklistItem = {
  title: string;
  description: string;
};

export type NavigatorAction = {
  slug: string;
  category: string;
  title: string;
  subtitle: string;
  totalEstimate: string;
  proTip: string;
  currentStepKey: string;
  roadmap: RoadmapStep[];
  checklist: ChecklistItem[];
  iconChar: string;
  iconBg: string;
  iconFg: string;
  heroImage?: string;
};

const STANDARD_ROADMAP: RoadmapStep[] = [
  { key: "current", label: "Current Step", estimate: "Today" },
  { key: "documents", label: "Documents Needed", estimate: "~15 min" },
  { key: "review", label: "Agency Review", estimate: "3–5 days" },
  { key: "info", label: "Additional Info", estimate: "If needed" },
  { key: "decision", label: "Decision & Coverage", estimate: "~7 days" },
];

export const ACTIONS: NavigatorAction[] = [
  {
    slug: "apply-medicaid",
    category: "Apply",
    title: "Apply for Medicaid",
    subtitle: "Start a new Medical Assistance application for you or your family.",
    totalEstimate: "About 30 minutes",
    proTip: "Have your Social Security numbers and last month of pay stubs ready — it makes this go about twice as fast.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "+",
    iconBg: "bg-mn-blue",
    iconFg: "text-white",
    checklist: [
      { title: "Proof of everyone who lives with you", description: "A lease, a utility bill, or mail addressed to the people in your household." },
      { title: "Photo ID for the main applicant", description: "A driver's license, state ID, tribal ID, or passport works." },
      { title: "Pay stubs from the last 30 days", description: "For everyone in the household who works. Self-employed? Bring a recent income summary." },
      { title: "Social Security numbers", description: "For every person applying for coverage." },
      { title: "Immigration documents if applicable", description: "Only for family members who aren't U.S. citizens." },
    ],
  },
  {
    slug: "renew-coverage",
    category: "Renew",
    title: "Renew your coverage",
    subtitle: "Confirm your household is still eligible so your Medical Assistance keeps going.",
    totalEstimate: "About 15 minutes",
    proTip: "Most people finish this step in under 5 minutes if their address and income haven't changed.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "↺",
    iconBg: "bg-mn-green",
    iconFg: "text-white",
    checklist: [
      { title: "Tell us if you moved", description: "We need your new address to send your coverage card." },
      { title: "Check your monthly income", description: "Find your pay stubs from the last 30 days for everyone in your home." },
      { title: "Confirm who lives with you", description: "Add or remove anyone whose living situation changed." },
      { title: "Update your phone and email", description: "So we can text or email you if we need something else." },
    ],
  },
  {
    slug: "report-a-change",
    category: "Update",
    title: "Report a change",
    subtitle: "Let us know about a new job, a move, or someone joining your household.",
    totalEstimate: "About 10 minutes",
    proTip: "Report changes within 10 days — it helps keep your coverage from being interrupted.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "⇄",
    iconBg: "bg-accent-teal",
    iconFg: "text-white",
    heroImage: reportChangeImg,
    checklist: [
      { title: "What changed?", description: "Income, address, household size, or something else — pick the one that fits best." },
      { title: "When did it change?", description: "The date the new situation started." },
      { title: "Proof of the change", description: "A pay stub, a lease, or a birth certificate — whatever backs it up." },
    ],
  },
  {
    slug: "respond-to-notice",
    category: "Respond",
    title: "Respond to a notice",
    subtitle: "Handle a letter you got in the mail from us.",
    totalEstimate: "About 20 minutes",
    proTip: "The notice number is in the top-right corner of the letter — have it handy.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "!",
    iconBg: "bg-accent-gold",
    iconFg: "text-dark-gray",
    checklist: [
      { title: "Find the notice number", description: "It looks like DHS-####. Top-right of the letter." },
      { title: "Note the deadline", description: "Most notices ask you to respond within 10 or 30 days." },
      { title: "Gather what the notice asks for", description: "Usually a document that proves something about your income, address, or family." },
      { title: "Send it back", description: "You can upload it here, drop it off, or mail it." },
    ],
  },
  {
    slug: "upload-documents",
    category: "Files",
    title: "Upload requested documents",
    subtitle: "Send us files a caseworker asked for.",
    totalEstimate: "About 5 minutes",
    proTip: "A clear phone photo works just as well as a scan. Make sure the whole page is visible.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "↑",
    iconBg: "bg-sky-blue",
    iconFg: "text-mn-blue",
    checklist: [
      { title: "Confirm what was asked for", description: "Check your notice or the message from your caseworker." },
      { title: "Take a clear photo or scan", description: "Make sure the whole document is in the frame and readable." },
      { title: "Label the file", description: "'Pay stub October 2026' is more useful than 'IMG_0032'." },
    ],
  },
  {
    slug: "prepare-interview",
    category: "Interview",
    title: "Prepare for your interview",
    subtitle: "Get ready for a phone or in-person interview with your caseworker.",
    totalEstimate: "About 25 minutes",
    proTip: "Most interviews take 20 to 30 minutes. Being ready with your documents cuts that in half.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "⚓",
    iconBg: "bg-mn-blue",
    iconFg: "text-white",
    checklist: [
      { title: "Confirm the time and how they'll call", description: "Phone number, video link, or office address." },
      { title: "Have your ID and Social Security number nearby", description: "The caseworker will confirm who they're speaking with." },
      { title: "Have proof of income and housing ready", description: "Pay stubs, lease or mortgage, and utility bills." },
      { title: "Write down your questions", description: "This is the best moment to ask what happens next and when." },
    ],
  },
  {
    slug: "check-documents",
    category: "Guidance",
    title: "Prepare Your Documents",
    subtitle: "Not sure yet? We'll show you what's usually asked for.",
    totalEstimate: "About 5 minutes",
    proTip: "You don't have to submit anything on this step — it's just a preview.",
    currentStepKey: "current",
    roadmap: STANDARD_ROADMAP,
    iconChar: "?",
    iconBg: "bg-dark-gray",
    iconFg: "text-white",
    heroImage: checkDocsImg,
    checklist: [
      { title: "Pick what you're planning to do", description: "Apply, renew, or report a change — each one asks for slightly different things." },
      { title: "See the standard list", description: "We'll show the documents most people are asked for." },
      { title: "Save the list", description: "Print it, email it to yourself, or take a screenshot." },
    ],
  },
];

// Slugs that appear on the public "What are you trying to do today?" tool page.
// Shared so historical snapshots and the live view stay in sync.
export const VISIBLE_ACTION_SLUGS = ["report-a-change", "check-documents"];

export function getActionBySlug(slug: string): NavigatorAction | undefined {
  return ACTIONS.find((a) => a.slug === slug);
}
