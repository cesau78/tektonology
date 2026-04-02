import type { LifecycleLoopDescriptor } from "@/data/types";

/** Angle (radians) for step `index` of `total`, starting at top (−π/2). */
function baseAngle(index: number, total: number) {
  return (index / total) * 2 * Math.PI - Math.PI / 2;
}

function polar(cx: number, cy: number, r: number, index: number, total: number) {
  const rad = baseAngle(index, total);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function polarFromAngle(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

type RingVariant = "restoration" | "planning";

const ringStyles: Record<RingVariant, { track: string; marker: string; nodeStroke: string }> = {
  restoration: {
    track: "stroke-amber-400/90",
    marker: "fill-amber-600",
    nodeStroke: "stroke-amber-400/80",
  },
  planning: {
    track: "stroke-teal-500/85",
    marker: "fill-teal-600",
    nodeStroke: "stroke-teal-400/80",
  },
};

interface LifecycleRingProps {
  loop: LifecycleLoopDescriptor;
  variant: RingVariant;
  markerId: string;
}

export function LifecycleRing({ loop, variant, markerId }: LifecycleRingProps) {
  const steps = loop.phaseDetails.map((p) => p.label);
  const { centerNote } = loop;
  const n = steps.length;
  const cx = 200;
  const cy = 200;
  /** Tighter ring without a center hub; larger nodes read clearly at this radius. */
  const rRing = 112;
  const nodeRadius = 34;
  /** Trim arcs so segments run between step discs along that circle. */
  const segment = (2 * Math.PI) / n;
  const angleInset = Math.min(segment * 0.16, 0.34);
  const s = ringStyles[variant];
  const maxLabelLen = Math.max(...steps.map((x) => x.length));
  const nodeFontClass = maxLabelLen > 9 ? "text-[10px]" : "text-[11px]";

  const srSummary = `${loop.title}: ${steps.join(", then ")}. ${centerNote}`;

  return (
    <figure className="w-full max-w-md mx-auto" aria-label={srSummary}>
      <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-sm" role="img">
        <title>{srSummary}</title>
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className={s.marker} />
          </marker>
        </defs>

        {steps.map((_, i) => {
          const next = (i + 1) % n;
          const a0 = baseAngle(i, n) + angleInset;
          const a1 = baseAngle(next, n) - angleInset;
          const start = polarFromAngle(cx, cy, rRing, a0);
          const end = polarFromAngle(cx, cy, rRing, a1);
          return (
            <path
              key={`${markerId}-arc-${i}`}
              d={`M ${start.x} ${start.y} A ${rRing} ${rRing} 0 0 1 ${end.x} ${end.y}`}
              fill="none"
              className={s.track}
              strokeWidth="3"
              strokeLinecap="butt"
              markerEnd={`url(#${markerId})`}
            />
          );
        })}

        {steps.map((label, i) => {
          const { x, y } = polar(cx, cy, rRing, i, n);
          return (
            <g key={`${markerId}-node-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={nodeRadius}
                className={`fill-white ${s.nodeStroke}`}
                strokeWidth="2"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`fill-stone-800 font-semibold ${nodeFontClass}`}
                style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

