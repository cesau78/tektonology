/** Grey strip for structural pillar gaps; heights match pew map kneeler (`h-2`) or rail (`h-[5px]`) rows. */
export function PillarGapLabel(props: {
  compact?: boolean;
  spanning?: boolean;
  /** `kneeler` = same as `KneelerPartStripMap` (`h-2`). `rail` = same as pew rail bar (`h-[5px]`). */
  stripHeight?: "kneeler" | "rail";
  className?: string;
}) {
  const { stripHeight = "kneeler", className } = props;
  const hClass = stripHeight === "rail" ? "h-[5px]" : "h-2";
  return (
    <div
      className={`flex min-w-0 w-full min-h-0 flex-col items-stretch justify-center ${className ?? ""}`}
      title="Pillar"
      aria-label="Pillar (structural gap)"
    >
      <div
        className={`${hClass} w-full min-w-0 shrink-0 rounded-sm border border-neutral-400/70 bg-neutral-300 dark:border-neutral-500 dark:bg-neutral-600`}
      />
    </div>
  );
}
