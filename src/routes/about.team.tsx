import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeamMembers, type TeamMember } from "@/lib/team.functions";

export const Route = createFileRoute("/about/team")({
  head: () => ({
    meta: [
      { title: "About us — the MN DHS crew at MESC 2026" },
      {
        name: "description",
        content:
          "Meet the Minnesota Department of Human Services team and partners running the Blazing the Trail to Coverage poster session at MESC 2026.",
      },
      { property: "og:title", content: "About us — the MN DHS crew at MESC 2026" },
      {
        property: "og:description",
        content:
          "The people behind the live feedback loop: MN DHS staff, county and MNIT partners, and collaborators attending MESC 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutTeamPage,
});

export function initialsOf(name: string) {
  const cleaned = name.replace(/["“”']/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const TILE_TONES = [
  "bg-mn-blue text-cream",
  "bg-mn-green text-cream",
  "bg-accent-orange text-cream",
  "bg-accent-gold text-mn-blue",
];

function MemberCard({ member, index }: { member: TeamMember; index: number }) {
  return (
    <article className="rounded-2xl border-2 border-mn-blue/15 bg-cream/50 p-5 flex gap-4 items-start">
      {member.photo_url ? (
        <img
          src={member.photo_url}
          alt={member.full_name}
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-xl object-cover ring-2 ring-mn-blue/20"
        />
      ) : (
        <div
          aria-hidden="true"
          className={`h-20 w-20 shrink-0 rounded-xl grid place-items-center font-display text-xl tracking-widest ring-2 ring-mn-blue/20 ${
            TILE_TONES[index % TILE_TONES.length]
          }`}
        >
          {initialsOf(member.full_name)}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="font-bold text-mn-blue leading-snug">{member.full_name}</h2>
        {member.goes_by && (
          <p className="text-sm text-dark-gray/80">
            <span className="font-semibold text-mn-blue">Goes by:</span> {member.goes_by}
          </p>
        )}
        <p className="text-sm text-dark-gray/75 mt-1">
          <span className="font-semibold text-mn-blue">Title:</span> {member.title}
        </p>
        {member.organization && (
          <p className="text-sm text-dark-gray/75">
            <span className="font-semibold text-mn-blue">Organization:</span> {member.organization}
          </p>
        )}
        {member.bio && <p className="text-sm text-dark-gray/70 mt-2 leading-relaxed">{member.bio}</p>}
      </div>
    </article>
  );
}

function AboutTeamPage() {
  const fetchTeam = useServerFn(listTeamMembers);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => fetchTeam(),
  });

  return (
    <main id="main-content" className="max-w-5xl w-full mx-auto py-12 px-6 flex-1">
      <header className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-2">
          MESC 2026
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-mn-blue tracking-tight mb-4">
          About us
        </h1>
        <p className="text-xl text-dark-gray/80 max-w-3xl">
          The Minnesota Department of Human Services crew and partners running this poster session.
          Come find us — we would love to hear what you would change.
        </p>
      </header>

      {isLoading && <p className="text-sm text-dark-gray/60">Loading the team…</p>}
      {isError && (
        <p className="text-sm text-accent-orange">
          We couldn't load the team right now. Please refresh the page.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(data ?? []).map((member, i) => (
          <MemberCard key={member.id} member={member} index={i} />
        ))}
      </div>
    </main>
  );
}
