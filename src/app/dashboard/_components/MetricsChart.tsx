"use client";

import { useState } from "react";
import { formatCentsCompact } from "@/lib/money";

export interface ChartPoint {
  date: string;
  label: string;
  players: number;
  bookings: number;
  fill: number;
  revenueCents: number;
}

type MetricKey = "players" | "bookings" | "fill" | "revenue";

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: "players", label: "Players", color: "#12a06f" },
  { key: "bookings", label: "Bookings", color: "#3b82f6" },
  { key: "fill", label: "Fill rate", color: "#a855f7" },
  { key: "revenue", label: "Revenue", color: "#f59e0b" },
];

const raw = (p: ChartPoint, m: MetricKey) =>
  m === "players" ? p.players : m === "bookings" ? p.bookings : m === "fill" ? p.fill : p.revenueCents;

const fmt = (v: number, m: MetricKey) =>
  m === "fill" ? `${v}%` : m === "revenue" ? formatCentsCompact(v) : String(v);

export function MetricsChart({ data, canSeeRevenue }: { data: ChartPoint[]; canSeeRevenue: boolean }) {
  const metrics = METRICS.filter((m) => m.key !== "revenue" || canSeeRevenue);
  const [metric, setMetric] = useState<MetricKey>("players");
  const active = metrics.find((m) => m.key === metric) ?? metrics[0];
  const color = active.color;

  const values = data.map((p) => raw(p, metric));
  const max = Math.max(1, ...values);
  const latest = values[values.length - 1] ?? 0;
  const peak = Math.max(0, ...values);
  const total = values.reduce((n, v) => n + v, 0);

  const W = 700, H = 130, padX = 8, padY = 12;
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);
  const points = values.map((v, i) => `${Math.round(x(i))},${Math.round(y(v))}`).join(" ");
  const area = `${padX},${H - padY} ${points} ${W - padX},${H - padY}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <b className="text-sm font-bold">{active.label} · last 14 days</b>
          <span className="ml-2 text-xs text-foreground/45">
            latest {fmt(latest, metric)} · peak {fmt(peak, metric)}
            {metric !== "fill" && ` · ${fmt(total, metric)} total`}
          </span>
        </div>
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          {metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${metric === m.key ? "bg-white text-[#14181c] shadow-sm" : "text-foreground/55 hover:text-foreground/80"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[130px] w-full overflow-visible">
        <defs>
          <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="#eef0f3">
          <line x1="0" y1={padY} x2={W} y2={padY} />
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} />
          <line x1="0" y1={H - padY} x2={W} y2={H - padY} />
        </g>
        {/* Y-axis labels */}
        <g className="text-[10px] font-medium text-foreground/35">
          <text x={"-4"} y={padY + 3} textAnchor="end">{fmt(max, metric)}</text>
          <text x={"-4"} y={H / 2 + 3} textAnchor="end">{fmt(Math.round(max / 2), metric)}</text>
          <text x={"-4"} y={H - padY + 3} textAnchor="end">0</text>
        </g>
        <polygon fill="url(#mc-fill)" points={area} />
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3.5 : 2} fill={color} opacity={i === values.length - 1 ? 1 : 0.5} />
            {/* Larger transparent hit area with a native hover tooltip. */}
            <circle cx={x(i)} cy={y(v)} r={14} fill="transparent" style={{ cursor: "pointer" }}>
              <title>{`${data[i].label} — ${fmt(v, metric)}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between px-1 text-[10px] text-foreground/35">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label} (today)</span>
      </div>
    </div>
  );
}
