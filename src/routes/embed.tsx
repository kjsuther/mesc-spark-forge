import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/game/game-canvas";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [{ title: "Blazing the Trail — Embed" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: EmbedPage,
});

function EmbedPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="w-screen h-[100dvh] bg-black overflow-hidden">
      {mounted ? (
        <GameCanvas presentation />
      ) : (
        <div className="grid h-full w-full place-items-center text-white text-sm">
          Loading game…
        </div>
      )}
    </div>
  );
}
