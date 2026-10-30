import type { CSSProperties } from "react";

/*
  8-bit icon set. Each glyph is a bitmap drawn on a small grid:
  k = outline (currentColor), g = leaf green, d = deep green, l = lime, w = paper. Anything else is transparent.
  Icons render at an integer scale so every pixel lands on whole screen pixels.
*/
const BITMAPS = {
  globe: ["..kkkkkk..", ".kllwwggk.", "kgggwwgggk", "kwwwwwwwwk", "kggwggwggk", "kggwggwggk", "kwwwwwwwwk", "kgggwwgddk", ".kggwwddk.", "..kkkkkk.."],
  cursor: ["k.........", "kk........", "klk.......", "kllk......", "klllk.....", "kllllk....", "klllllk...", "kllkkkkk..", "kk..klk...", "k....kk..."],
  key: [".kkkk.....", "kllllk....", "kl..lkkkkk", "kl..lggggk", "kllllkkgkk", ".kkkk.kgk.", "......kk.."],
  keyboard: ["kkkkkkkkkk", "kgwgwgwgwk", "kwgwgwgwgk", "kgwllllwgk", "kkkkkkkkkk"],
  list: ["ll.kkkkkkk", "ll........", "..........", "gg.kkkkkkk", "gg........", "..........", "dd.kkkkk..", "dd........"],
  enter: ["........kk", "........kk", "..l.....kk", ".ll.....kk", "llkkkkkkkk", ".ll.......", "..l......."],
  camera: ["...kkkk...", "kkkkkkkkkk", "kwwkkkkwlk", "kwkggggkwk", "kwkglggkwk", "kwkgggdkwk", "kwwkkkkwwk", "kkkkkkkkkk"],
  download: ["...kkkk...", "...kllk...", "...kllk...", "kkkkllkkkk", ".kllllllk.", "..kllllk..", "...kllk...", "....kk....", "..........", "dddddddddd"],
  upload: ["....kk....", "...kllk...", "..kllllk..", ".kllllllk.", "kkkkllkkkk", "...kllk...", "...kllk...", "...kkkk...", "..........", "dddddddddd"],
  doc: ["kkkkkk...", "kwwwwkk..", "kwwwwklk.", "kwwwwkkkk", "kwggggwwk", "kwwwwwwwk", "kwgggggwk", "kwwwwwwwk", "kwddddwwk", "kwwwwwwwk", "kkkkkkkkk"],
  docCheck: ["kkkkkk...", "kwwwwkk..", "kwwwwklk.", "kwwwwkkkk", "kwwwwwwwk", "kwwwwwwgk", "kwwwwwggk", "kwgwwggwk", "kwggggwwk", "kwwggwwwk", "kkkkkkkkk"],
  search: ["..kkkk....", ".kllwwk...", "kllwwwwk..", "klwwwwwk..", "kwwwwwwk..", ".kwwwwk...", "..kkkkdd..", "......ddd.", ".......ddd", "........dd"],
  ledger: ["kkkkkkkkk", "kdkwwwwwk", "kdkwkkkwk", "kdkwwwwwk", "kdkwkkkwk", "kdkwwwwwk", "kdkwkkwwk", "kdkwwwwwk", "kkkkkkkkk", ".llllllll"],
  link: ["kkkkkk...", "kggggk...", "kggggk...", "kggkkkkkk", "kggkwkllk", "kkkkkkllk", "...kllllk", "...kllllk", "...kkkkkk"],
  alert: ["....kk....", "...kllk...", "...kllk...", "..kllllk..", "..klkklk..", ".kllkkllk.", ".kllllllk.", "klllkklllk", "kllllllllk", "kkkkkkkkkk"],
  trash: ["...kkkk...", "kkkkkkkkkk", ".kwwwwwwk.", ".kwgwwgwk.", ".kwgwwgwk.", ".kwgwwgwk.", ".kwwwwwwk.", ".kkkkkkkk."],
  check: [".....k", "....kk", "k..kk.", "kkkk..", ".kk..."],
  x: ["k....k", ".k..k.", "..kk..", "..kk..", ".k..k.", "k....k"],
  plus: ["..kk..", "..kk..", "kkkkkk", "kkkkkk", "..kk..", "..kk.."],
  chevron: ["k.....k", ".k...k.", "..k.k..", "...k..."],
  next: ["kk..", ".kk.", "..kk", ".kk.", "kk.."],
} as const;

export type PixelName = keyof typeof BITMAPS;

const FILL: Record<string, string> = {
  k: "currentColor",
  g: "var(--color-leaf)",
  d: "var(--color-leaf-deep)",
  l: "var(--color-lime)",
  w: "#fffefb",
};

export function Px({ name, scale = 2, className, style }: { name: PixelName; scale?: number; className?: string; style?: CSSProperties }) {
  const rows = BITMAPS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      className={className}
      style={{ flexShrink: 0, ...style }}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rows.flatMap((r, y) =>
        r.split("").map((c, x) => (FILL[c] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FILL[c]} /> : null))
      )}
    </svg>
  );
}

const STAIRS = ["var(--color-lime)", "var(--color-leaf-light)", "var(--color-leaf)", "var(--color-leaf-deep)", "var(--color-moss-2)"];

/** Mistral-style stack of flat color blocks, stepped like an 8-bit staircase. Heights are in blocks per column. */
export function PixelStairs({ heights, block = 12, className, reverse }: { heights: number[]; block?: number; className?: string; reverse?: boolean }) {
  return (
    <div aria-hidden className={className} style={{ display: "flex", alignItems: "flex-end", flexDirection: reverse ? "row-reverse" : "row" }}>
      {heights.map((n, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column-reverse" }}>
          {Array.from({ length: n }, (_, j) => (
            <span
              key={j}
              className="stair-block"
              style={{ width: block, height: block, background: STAIRS[Math.min(j, STAIRS.length - 1)], animationDelay: `${(i + j) * 70}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
