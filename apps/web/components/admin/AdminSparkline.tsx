import clsx from "clsx";
import type React from "react";
import { SPARKLINE_STOP_COLORS } from "@/lib/charts/tokens";

export interface AdminSparklineProps {
  data: number[];
  color?: "indigo" | "emerald" | "rose" | "amber" | "zinc" | "black" | "white";
  className?: string;
}

const strokeColorMap = {
  indigo: "stroke-indigo-500 dark:stroke-indigo-400",
  emerald: "stroke-emerald-500 dark:stroke-emerald-400",
  rose: "stroke-rose-500 dark:stroke-rose-400",
  amber: "stroke-amber-500 dark:stroke-amber-400",
  zinc: "stroke-zinc-500 dark:stroke-zinc-400",
  black: "stroke-zinc-950 dark:stroke-zinc-950",
  white: "stroke-white/70",
};

const stopColorMap = SPARKLINE_STOP_COLORS;

export function AdminSparkline({
  data,
  color = "indigo",
  className,
}: AdminSparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 100;
  const height = 32;

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = 2 + (height - 4) - ((d - min) / range) * (height - 4);
    return { x, y };
  });

  const linePath = pts.reduce((acc, pt, i, a) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = a[i - 1];
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pt.x},${pt.y}`;
  }, "");

  return (
    <div className={clsx("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <path
          d={linePath}
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={strokeColorMap[color]}
        />
      </svg>
    </div>
  );
}
