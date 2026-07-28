import { useQuery } from "@tanstack/react-query";
import { gameFeedbackQuery, splitFeedback, type GameFeedback } from "@/lib/feedback.queries";

type Props = {
  /** "page" = attendee site, "poster" = projected dark theme. */
  variant?: "page" | "poster";
};

export function FeedbackBoard({ variant = "page" }: Props) {
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const { backlog, implemented } = splitFeedback(rows);

  if (variant === "poster") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <header className="flex items-center justify-between gap-2 border-b-2 border-accent-gold/60 bg-accent-orange px-4 py-2 text-white">
          <span className="font-display text-sm uppercase tracking-widest">
            ★ Feedback backlog
          </span>
          <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-black tabular-nums">
            {implemented.length} built
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {backlog.length === 0 ? (
            <p className="p-6 text-center text-sm text-cream/70">
              No open feedback — tell us what to build next!
            </p>
          ) : (
            <ol className="space-y-1.5">
              {backlog.map((f, i) => (
                <li
                  key={f.id}
                  className="flex items-start gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-accent-gold text-[11px] font-black text-mn-blue">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-cream">
                    {f.description}
                    <span className="ml-1 text-[11px] text-cream/60">— {f.submitter_name}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }

  return (
    <section id="backlog" className="mt-10 scroll-mt-24">
      <h2 className="font-display text-2xl uppercase tracking-wide text-mn-blue">
        The feedback backlog
      </h2>
      <p className="mt-1 text-sm text-dark-gray/80">
        Everything players have asked for, in the order the team plans to build it — and
        everything that's already live in the Current Version of the game.
      </p>


      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Column
          title={`Up next (${backlog.length})`}
          tone="orange"
          empty="No open feedback yet. Be the first!"
          items={backlog}
          numbered
        />
        <Column
          title={`Implemented (${implemented.length})`}
          tone="green"
          empty="Nothing built yet — check back after the team ships the first item."
          items={implemented}
        />
      </div>
    </section>
  );
}

function Column({
  title,
  tone,
  items,
  empty,
  numbered = false,
}: {
  title: string;
  tone: "orange" | "green";
  items: GameFeedback[];
  empty: string;
  numbered?: boolean;
}) {
  const head = tone === "orange" ? "bg-accent-orange" : "bg-mn-green";
  return (
    <div className="overflow-hidden rounded-lg border-2 border-mn-blue/30 bg-white">
      <h3 className={`${head} px-4 py-2 text-sm font-black uppercase tracking-wide text-white`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-dark-gray/60">{empty}</p>
      ) : (
        <ol className="divide-y divide-light-gray">
          {items.map((f, i) => (
            <li key={f.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-black ${
                  tone === "orange" ? "bg-accent-orange/15 text-accent-orange" : "bg-mn-green/15 text-mn-green"
                }`}
              >
                {numbered ? i + 1 : "✓"}
              </span>
              <span className="min-w-0 flex-1 text-sm text-dark-gray">
                {f.description}
                <span className="mt-0.5 block text-xs font-semibold text-dark-gray/60">
                  — {f.submitter_name}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
