"use client";

// Lightweight, dependency-free SVG charts with hover tooltips and responsive width.
import * as React from "react";
import { cn } from "@/lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(range: number, count: number) {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function niceScale(min: number, max: number, count = 4) {
  if (min === max) {
    max = max === 0 ? 1 : max * 1.2;
    min = min > 0 ? 0 : min;
  }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}

/** Monotone cubic interpolation (no overshoot) → SVG path. */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export interface Series {
  key: string;
  name: string;
  color: string;
}

type Row = { label: string } & Record<string, number | string>;

function Tooltip({ x, y, width, title, items, format }: { x: number; y: number; width: number; title: string; items: { name: string; color: string; value: number }[]; format: (v: number) => string }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line-strong bg-elevated/95 px-3 py-2 text-xs shadow-[var(--shadow-pop)] backdrop-blur" style={{ left, top: Math.max(y - 10, 4) }}>
      <div className="mb-1 font-semibold text-fg">{title}</div>
      {items.map((it) => (
        <div key={it.name} className="flex items-center justify-between gap-4 whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: it.color }} />
            {it.name}
          </span>
          <span className="tabular font-semibold text-fg">{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

const PAD = { l: 52, r: 12, t: 12, b: 26 };

export function AreaChart({ data, series, height = 220, format = (v) => String(v), yFormat, area = true, className, empty = "Belum ada data" }: { data: Row[]; series: Series[]; height?: number; format?: (v: number) => string; yFormat?: (v: number) => string; area?: boolean; className?: string; empty?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const gid = React.useId().replace(/:/g, "");
  const values = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const allZero = values.every((v) => v === 0);
  const { lo, hi, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const iw = Math.max(10, width - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 64))));
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.l;
    const i = data.length <= 1 ? 0 : Math.round((px / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block select-none">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`ag${gid}${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? "" : "3 4"} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10.5} fill="var(--color-subtle)">
                {(yFormat ?? format)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const last = i === data.length - 1;
            const show = i % labelEvery === 0 || (last && (data.length - 1) % labelEvery >= labelEvery / 2);
            if (!show) return null;
            return (
              <text key={d.label + i} x={x(i)} y={height - 8} textAnchor={data.length > 1 && i === 0 ? "start" : last && data.length > 1 ? "end" : "middle"} fontSize={10.5} fill="var(--color-subtle)">
                {d.label}
              </text>
            );
          })}
          {!allZero &&
            series.map((s) => {
              const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)] as [number, number]);
              const line = monotonePath(pts);
              return (
                <g key={s.key}>
                  {area && pts.length > 1 && <path d={`${line}L${pts[pts.length - 1][0]},${y(Math.max(lo, 0))}L${pts[0][0]},${y(Math.max(lo, 0))}Z`} fill={`url(#ag${gid}${s.key})`} />}
                  <path d={line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" />
                </g>
              );
            })}
          {hover !== null && data[hover] && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r={4.5} fill="var(--color-card)" stroke={s.color} strokeWidth={2.5} />
              ))}
            </g>
          )}
        </svg>
      )}
      {allZero && width > 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted">{empty}</div>}
      {hover !== null && data[hover] && !allZero && (
        <Tooltip x={x(hover)} y={Math.min(...series.map((s) => y(Number(data[hover][s.key]) || 0)))} width={width} title={data[hover].label} items={series.map((s) => ({ name: s.name, color: s.color, value: Number(data[hover][s.key]) || 0 }))} format={format} />
      )}
      <Legend series={series} />
    </div>
  );
}

export function BarChart({ data, series, height = 220, format = (v) => String(v), yFormat, className, signedColors, empty = "Belum ada data" }: { data: Row[]; series: Series[]; height?: number; format?: (v: number) => string; yFormat?: (v: number) => string; className?: string; signedColors?: [string, string]; empty?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const values = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const allZero = values.every((v) => v === 0);
  const { lo, hi, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const iw = Math.max(10, width - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const band = iw / Math.max(1, data.length);
  const groupW = Math.min(band * 0.72, series.length * 22);
  const barW = Math.max(2, groupW / series.length - (series.length > 1 ? 2 : 0));
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const zero = y(0);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} className="block select-none" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? "" : "3 4"} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10.5} fill="var(--color-subtle)">
                {(yFormat ?? format)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = PAD.l + i * band + (band - groupW) / 2;
            return (
              <g key={d.label + i} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.l + i * band} y={PAD.t} width={band} height={ih} fill={hover === i ? "rgb(148 163 184 / 0.06)" : "transparent"} />
                {series.map((s, si) => {
                  const v = Number(d[s.key]) || 0;
                  const top = Math.min(y(v), zero);
                  const h = Math.max(v === 0 ? 0 : 2, Math.abs(y(v) - zero));
                  const color = signedColors ? (v >= 0 ? signedColors[0] : signedColors[1]) : s.color;
                  return <rect key={s.key} x={gx + si * (barW + (series.length > 1 ? 2 : 0))} y={top} width={barW} height={h} rx={Math.min(5, barW / 2)} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} style={{ transition: "opacity .15s" }} />;
                })}
                {(i % labelEvery === 0) && (
                  <text x={PAD.l + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-subtle)">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {allZero && width > 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted">{empty}</div>}
      {hover !== null && data[hover] && !allZero && (
        <Tooltip
          x={PAD.l + hover * band + band / 2}
          y={Math.min(...series.map((s) => Math.min(y(Number(data[hover][s.key]) || 0), zero)))}
          width={width}
          title={data[hover].label}
          items={series.map((s) => ({ name: s.name, color: signedColors ? ((Number(data[hover][s.key]) || 0) >= 0 ? signedColors[0] : signedColors[1]) : s.color, value: Number(data[hover][s.key]) || 0 }))}
          format={format}
        />
      )}
      <Legend series={series} />
    </div>
  );
}

export function DonutChart({ data, size = 180, thickness = 22, center, format = (v) => String(v) }: { data: { name: string; value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode; format?: (v: number) => string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const gap = data.length > 1 ? 2.5 : 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(148 163 184 / 0.1)" strokeWidth={thickness} />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * c;
            const el = (
              <circle
                key={d.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={hover === i ? thickness + 5 : thickness}
                strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: "stroke-width .15s", cursor: "pointer" }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {hover !== null && data[hover] ? (
          <div className="px-4">
            <div className="text-[11px] text-muted">{data[hover].name}</div>
            <div className="tabular text-sm font-semibold">{format(data[hover].value)}</div>
            <div className="text-[11px] text-muted">{total ? Math.round((data[hover].value / total) * 100) : 0}%</div>
          </div>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = "#38BDF8", height = 40, className }: { values: number[]; color?: string; height?: number; className?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = React.useId().replace(/:/g, "");
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)] as [number, number]);
  const line = monotonePath(pts);
  return (
    <div ref={ref} className={cn("w-full", className)} style={{ height }}>
      {width > 0 && values.length > 1 && (
        <svg width={width} height={height}>
          <defs>
            <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#sp${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.8} />
        </svg>
      )}
    </div>
  );
}

/** Segmented semicircle gauge (inspired by the reference "Task Completion" widget). */
export function SegmentGauge({ value, size = 220, segments = 26, children }: { value: number; size?: number; segments?: number; children?: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - size * 0.12;
  const active = Math.round((v / 100) * segments);
  const segs = Array.from({ length: segments }, (_, i) => {
    const a0 = Math.PI + (i / segments) * Math.PI + 0.025;
    const a1 = Math.PI + ((i + 1) / segments) * Math.PI - 0.025;
    const mid = (a0 + a1) / 2;
    const w = (a1 - a0) * ((rOuter + rInner) / 2);
    const x = cx + Math.cos(mid) * ((rOuter + rInner) / 2);
    const y = cy + Math.sin(mid) * ((rOuter + rInner) / 2);
    return { x, y, w, h: rOuter - rInner, rot: (mid * 180) / Math.PI + 90, on: i < active, i };
  });
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 18 }}>
      <svg width={size} height={size / 2 + 18}>
        <defs>
          <linearGradient id="gauge-on" x1="0" x2="1">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        {segs.map((s) => (
          <rect
            key={s.i}
            x={s.x - s.w / 2}
            y={s.y - s.h / 2}
            width={s.w}
            height={s.h}
            rx={Math.min(5, s.w / 2)}
            transform={`rotate(${s.rot} ${s.x} ${s.y})`}
            fill={s.on ? "url(#gauge-on)" : "rgb(148 163 184 / 0.16)"}
            style={{ transition: `fill .4s ease ${s.i * 18}ms` }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function HBar({ label, value, max, color, right, sub }: { label: React.ReactNode; value: number; max: number; color: string; right?: React.ReactNode; sub?: React.ReactNode }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="tabular shrink-0 text-xs text-muted">{right}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
      {sub && <div className="mt-1 text-[11px] text-subtle">{sub}</div>}
    </div>
  );
}
