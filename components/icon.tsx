import type { CSSProperties, ReactNode } from "react";

/* Line icons on a 24 grid, drawn in currentColor. */
const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  compose: (
    <>
      <path d="M11.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
      <path d="M17.8 3.7a1.9 1.9 0 0 1 2.7 2.7L12.4 14.5l-3.6.9.9-3.6z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c-2.8 2.4-4.2 5.2-4.2 8.5s1.4 6.1 4.2 8.5c2.8-2.4 4.2-5.2 4.2-8.5S14.8 5.9 12 3.5z" />
    </>
  ),
  cursor: <path d="m5.5 4.5 5.8 15 2.2-6.2 6.2-2.2z" />,
  key: (
    <>
      <circle cx="8" cy="15.5" r="3.8" />
      <path d="m10.8 12.8 8.2-8.3M15.5 8l2.8 2.8" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2.2" />
      <path d="M7 10.5h.01M10.3 10.5h.01M13.7 10.5h.01M17 10.5h.01M8 14h8" />
    </>
  ),
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  enter: <path d="M19.5 5v6.5a3 3 0 0 1-3 3H5M9 10.5l-4 4 4 4" />,
  camera: (
    <>
      <path d="M4 8.5h3l1.8-2.7h6.4L17 8.5h3v10H4z" />
      <circle cx="12" cy="13.3" r="3.2" />
    </>
  ),
  download: <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15.5V4.5M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />,
  doc: (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5z" />
      <path d="M13.5 3.5V8H18M9.5 12.5h5.5M9.5 16h4" />
    </>
  ),
  docCheck: (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5z" />
      <path d="M13.5 3.5V8H18M9.3 14.3l2 2 3.7-3.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.7 15.7 4.3 4.3" />
    </>
  ),
  ledger: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="2.2" />
      <path d="M4 9.5h16M4 14.5h16M10 9.5v10" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1" />
      <path d="M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1" />
    </>
  ),
  alert: <path d="M12 4.5 20.5 19h-17zM12 10v4.2M12 16.7h.01" />,
  flag: <path d="M5.5 20.5v-16M5.5 5h11.5l-2.2 3.7L17 12.5H5.5" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10.2 10.5v6M13.8 10.5v6" />,
  memory: (
    <>
      <circle cx="6.5" cy="7" r="2.3" />
      <circle cx="17.5" cy="8" r="2.3" />
      <circle cx="12" cy="17.5" r="2.3" />
      <path d="m8.8 7.2 6.4.6M7.7 9l3.2 6.5M16.3 10l-3.2 5.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  next: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  arrowUp: <path d="M12 19V5.5M6.5 11 12 5.5 17.5 11" />,
  repeat: <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6" />,
  screen: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2.2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7.5h9.5M18.5 7.5H20M4 16.5h1.5M10.5 16.5H20" />
      <circle cx="16" cy="7.5" r="2.3" />
      <circle cx="8" cy="16.5" r="2.3" />
    </>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0, ...style }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
