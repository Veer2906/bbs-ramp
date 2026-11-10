"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MemoryKind, MemoryNode } from "@/lib/types";
import { cx } from "./ui";

export const KINDS: { value: MemoryKind; label: string }[] = [
  { value: "date", label: "Key dates" },
  { value: "invoice", label: "Invoices" },
  { value: "vendor", label: "Vendors" },
  { value: "rule", label: "Rules" },
  { value: "note", label: "Notes" },
];
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<MemoryKind, string>;

type Edge = { a: string; b: string; explicit: boolean };

/** Explicit links plus implied ones: a fact whose text mentions another fact's title. */
export function edges(nodes: MemoryNode[]): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  const add = (a: string, b: string, explicit: boolean) => {
    const k = [a, b].sort().join("|");
    if (a === b || seen.has(k)) return;
    seen.add(k);
    out.push({ a, b, explicit });
  };
  for (const n of nodes) for (const l of n.links) if (nodes.some((m) => m.id === l)) add(n.id, l, true);
  for (const n of nodes) {
    const text = `${n.title} ${n.detail}`.toLowerCase();
    for (const m of nodes) if (m.id !== n.id && m.title.length >= 3 && text.includes(m.title.toLowerCase())) add(n.id, m.id, false);
  }
  return out;
}

const W = 760;
const H = 420;
const hub = (k: MemoryKind) => `hub:${k}`;
type Body = { id: string; x: number; y: number; vx: number; vy: number; fixed: boolean };
type Pos = Record<string, { x: number; y: number }>;

const seed = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
};

/** Force-directed memory graph: facts cluster around their type, links pull related facts together. Drag to rearrange, click to edit. */
export function MemoryGraph({ nodes, selected, onSelect }: { nodes: MemoryNode[]; selected?: string; onSelect: (id: string) => void }) {
  const links = useMemo(() => edges(nodes), [nodes]);
  const kinds = useMemo(() => KINDS.map((k) => k.value).filter((k) => nodes.some((n) => n.kind === k)), [nodes]);
  const bodies = useRef(new Map<string, Body>());
  const alpha = useRef(1);
  const drag = useRef<{ id: string; moved: number } | undefined>(undefined);
  const svg = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState<Pos>({});
  const [hover, setHover] = useState<string>();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const m = bodies.current;
    const ids = new Set([...kinds.map(hub), ...nodes.map((n) => n.id)]);
    for (const k of [...m.keys()]) if (!ids.has(k)) m.delete(k);
    kinds.forEach((k, i) => {
      if (m.has(hub(k))) return;
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / kinds.length;
      m.set(hub(k), { id: hub(k), x: W / 2 + Math.cos(a) * 190, y: H / 2 + Math.sin(a) * 120, vx: 0, vy: 0, fixed: false });
    });
    for (const n of nodes) {
      if (m.has(n.id)) continue;
      const h = m.get(hub(n.kind))!;
      m.set(n.id, { id: n.id, x: h.x + seed(n.id) * 90, y: h.y + seed(n.id + "y") * 90, vx: 0, vy: 0, fixed: false });
    }
    alpha.current = 1;
  }, [nodes, kinds]);

  useEffect(() => {
    let raf = 0;
    const springs: [string, string, number, number][] = [
      ...nodes.map((n) => [n.id, hub(n.kind), 92, 0.05] as [string, string, number, number]),
      ...links.map((e) => [e.a, e.b, 150, 0.02] as [string, string, number, number]),
    ];
    const tick = () => {
      const a = alpha.current;
      if (a > 0.004) {
        const list = [...bodies.current.values()];
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const p = list[i];
            const q = list[j];
            const dx = q.x - p.x || 0.01;
            const dy = q.y - p.y || 0.01;
            const d2 = Math.max(dx * dx + dy * dy, 120);
            const f = (5200 / d2) * a;
            const d = Math.sqrt(d2);
            p.vx -= (dx / d) * f;
            p.vy -= (dy / d) * f;
            q.vx += (dx / d) * f;
            q.vy += (dy / d) * f;
          }
        }
        for (const [x, y, len, k] of springs) {
          const p = bodies.current.get(x);
          const q = bodies.current.get(y);
          if (!p || !q) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (d - len) * k * a;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          q.vx -= (dx / d) * f;
          q.vy -= (dy / d) * f;
        }
        const next: Pos = {};
        for (const b of list) {
          if (!b.fixed) {
            b.vx += (W / 2 - b.x) * 0.002 * a;
            b.vy += (H / 2 - b.y) * 0.004 * a;
            b.vx *= 0.78;
            b.vy *= 0.78;
            b.x = Math.min(W - 40, Math.max(40, b.x + b.vx));
            b.y = Math.min(H - 30, Math.max(26, b.y + b.vy));
          }
          next[b.id] = { x: b.x, y: b.y };
        }
        alpha.current = a * 0.988;
        setPos(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes, links]);

  const point = (e: ReactPointerEvent) => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const grab = (id: string) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    const b = bodies.current.get(id);
    if (b) b.fixed = true;
    drag.current = { id, moved: 0 };
    setDragging(true);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const b = bodies.current.get(d.id);
    if (!b) return;
    const p = point(e);
    d.moved += Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
    b.x = p.x;
    b.y = p.y;
    alpha.current = Math.max(alpha.current, 0.35);
  };
  const release = () => {
    const d = drag.current;
    drag.current = undefined;
    setDragging(false);
    if (!d) return;
    const b = bodies.current.get(d.id);
    if (b) b.fixed = false;
    if (d.moved < 4 && !d.id.startsWith("hub:")) onSelect(d.id);
  };

  const focus = hover ?? selected;
  const near = new Set(focus ? [focus, ...links.filter((e) => e.a === focus || e.b === focus).flatMap((e) => [e.a, e.b])] : []);
  const degree = (id: string) => links.filter((e) => e.a === id || e.b === id).length;
  const hovered = nodes.find((n) => n.id === hover);
  const hp = hover ? pos[hover] : undefined;

  return (
    <div className="card relative overflow-hidden">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label="Memory graph"
        onPointerMove={move}
        onPointerUp={release}
        onPointerLeave={release}
      >
        {nodes.map((n) => {
          const p = pos[n.id];
          const h = pos[hub(n.kind)];
          if (!p || !h) return null;
          return <line key={`h-${n.id}`} x1={h.x} y1={h.y} x2={p.x} y2={p.y} className="stroke-zinc-900/[0.1]" strokeWidth={1} />;
        })}
        {links.map((e) => {
          const p = pos[e.a];
          const q = pos[e.b];
          if (!p || !q) return null;
          const on = focus && (e.a === focus || e.b === focus);
          return (
            <line
              key={`${e.a}-${e.b}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              className={cx("transition-[stroke,opacity] duration-200", on ? "flow stroke-zinc-950" : "stroke-zinc-900/30", focus && !on && "opacity-30")}
              strokeWidth={on ? 1.6 : 1}
              strokeDasharray={on ? undefined : e.explicit ? undefined : "3 3"}
            />
          );
        })}
        {kinds.map((k) => {
          const p = pos[hub(k)];
          if (!p) return null;
          const label = KIND_LABEL[k];
          const w = label.length * 6.2 + 22;
          return (
            <g key={k} className="graph-node cursor-grab active:cursor-grabbing" onPointerDown={grab(hub(k))} style={{ opacity: focus && !nodes.some((n) => n.kind === k && near.has(n.id)) ? 0.4 : 1, transition: "opacity 200ms" }}>
              <rect x={p.x - w / 2} y={p.y - 11} width={w} height={22} rx={11} className="fill-[#1f1e1d] stroke-zinc-900/20" strokeWidth={1} />
              <text x={p.x} y={p.y + 3.8} textAnchor="middle" className="pointer-events-none fill-zinc-800 text-[10.5px] font-medium">
                {label}
              </text>
            </g>
          );
        })}
        {nodes.map((n, i) => {
          const p = pos[n.id];
          if (!p) return null;
          const r = 5 + Math.min(degree(n.id), 4) * 1.2 + (n.id === hover ? 2 : 0);
          const dim = focus && !near.has(n.id);
          return (
            <g
              key={n.id}
              className="graph-node tree-node cursor-pointer"
              style={{ animationDelay: `${i * 40}ms`, opacity: dim ? 0.3 : 1, transition: "opacity 200ms" }}
              onPointerDown={grab(n.id)}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(undefined)}
            >
              <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
              {n.id === selected ? <circle cx={p.x} cy={p.y} r={r + 5} className="fill-none stroke-zinc-900/40" strokeWidth={1} /> : null}
              <circle cx={p.x} cy={p.y} r={r} className={n.id === selected ? "fill-zinc-950 stroke-zinc-950" : "fill-[#141413] stroke-zinc-800"} strokeWidth={1.5} />
              <text x={p.x} y={p.y + r + 14} textAnchor="middle" className="pointer-events-none fill-zinc-700 text-[11px] font-medium">
                {n.title.length > 24 ? `${n.title.slice(0, 23)}…` : n.title}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && hp && !dragging ? (
        <div
          className="pop sheet pointer-events-none absolute z-10 w-[250px] rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed"
          style={{ left: `${Math.min(Math.max((hp.x / W) * 100, 16), 84)}%`, top: `${(hp.y / H) * 100}%`, transform: hp.y > H * 0.6 ? "translate(-50%, calc(-100% - 18px))" : "translate(-50%, 22px)" }}
        >
          <p className="text-[11.5px] text-zinc-500">{KIND_LABEL[hovered.kind]}</p>
          <p className="mt-0.5 font-medium text-zinc-950">{hovered.title}</p>
          {hovered.detail ? <p className="mt-1 line-clamp-3 text-zinc-600">{hovered.detail}</p> : null}
        </div>
      ) : null}
      <p className="pointer-events-none absolute bottom-3 left-4 text-[12px] text-zinc-500">Drag to rearrange. Click a fact to edit it.</p>
    </div>
  );
}
