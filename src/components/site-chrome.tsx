import { DemoBanner } from "./demo-banner";
import { SiteHeader } from "./site-header";
import { PixelBackdrop } from "./pixel/pixel-backdrop";
import { useIsEmbedded } from "@/hooks/use-is-embedded";

export function SiteChrome() {
  const embedded = useIsEmbedded();
  if (embedded) return null;
  return (
    <>
      <PixelBackdrop />
      <DemoBanner />
      <SiteHeader />
    </>
  );
}

