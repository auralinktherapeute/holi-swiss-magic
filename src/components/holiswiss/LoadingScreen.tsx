import lotusAsset from "@/assets/lotus-transparent.png.asset.json";

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background">
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="absolute h-24 w-24 rounded-full bg-[#b86ef9]/30 blur-2xl animate-ping"
        />
        <img
          src={lotusAsset.url}
          alt="Holiswiss"
          width={96}
          height={96}
          className="relative h-24 w-24 object-contain animate-pulse"
          style={{ filter: "drop-shadow(0 0 18px rgba(184,110,249,0.85))" }}
        />
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#b86ef9] [animation-delay:-0.3s]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#b86ef9] [animation-delay:-0.15s]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#b86ef9]" />
        {label ? <span className="ml-2">{label}</span> : null}
      </div>
    </div>
  );
}