/** Circle label for structural pillar gaps (pew map + project row diagrams). */
export function PillarGapLabel({
  compact,
  spanning,
  className,
}: {
  /** Map thumbnails: smaller circle + type */
  compact?: boolean;
  /** Draw one marker that visually spans multiple row bands */
  spanning?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center min-w-0 ${className ?? ""}`}
      title="Pillar"
    >
      <div
        className={`rounded-full border border-dashed border-muted-foreground/60 bg-background/90 dark:bg-background/80 flex items-center justify-center shrink-0 ${
          compact
            ? spanning
              ? "w-[26px] h-[26px] border-[0.5px]"
              : "w-[16px] h-[16px] border-[0.5px]"
            : spanning
              ? "w-[68px] h-[68px]"
              : "min-w-[44px] min-h-[44px] w-[min(100%,3.63rem)] h-[min(100%,3.63rem)]"
        }`}
      >
        <span
          className={`font-medium text-muted-foreground leading-none select-none text-center ${
            compact ? "text-[9px] px-px" : "text-[15px]"
          }`}
        >
          Pillar
        </span>
      </div>
    </div>
  );
}
