export function DemoBanner() {
  return (
    <div
      role="alert"
      className="w-full bg-accent-gold text-mn-blue text-center text-xs sm:text-sm font-semibold px-4 py-2 border-b-2 border-mn-blue/20"
    >
      <span className="uppercase tracking-widest text-[10px] font-black mr-2 bg-mn-blue text-accent-gold px-2 py-0.5 rounded">
        Demo
      </span>
      Built for the MESC 2026 MN DHS poster session — not an official eligibility system or consumer
      service. <strong>Do not enter personal or sensitive information.</strong>
    </div>
  );
}
