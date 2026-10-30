import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "./ui";

const REF = /^(doc|ledger|issue):(.+)$/;
const refHref = (kind: string, id: string) =>
  kind === "doc" ? `/documents?doc=${encodeURIComponent(id)}` : kind === "ledger" ? `/ledger?entry=${encodeURIComponent(id)}` : `/issues?issue=${encodeURIComponent(id)}`;

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 flex list-disc flex-col gap-1 pl-5 marker:text-zinc-400 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 flex list-decimal flex-col gap-1 pl-5 marker:text-zinc-400 first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <p className="mt-4 mb-1.5 font-semibold text-zinc-900 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-4 mb-1.5 font-semibold text-zinc-900 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-3 mb-1 font-semibold text-zinc-900 first:mt-0">{children}</p>,
  code: ({ children }) => <code className="bg-zinc-900/[0.06] px-1 py-px font-mono text-[0.88em]">{children}</code>,
  a: ({ children, href }) => {
    const m = href?.match(REF);
    if (m)
      return (
        <Link href={refHref(m[1], m[2])} className="ref" title={m[1] === "doc" ? "Open document" : m[1] === "ledger" ? "Open ledger line" : "Open issue"}>
          {children}
        </Link>
      );
    return (
      <a href={href} target="_blank" rel="noreferrer" className="ref ref-web">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-left text-[13px] tabular-nums">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-zinc-900/[0.04] px-2 py-1 font-medium text-zinc-600">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 align-top">{children}</td>,
  hr: () => <div className="h-3" />,
};

/** Renders agent text (summaries, notes, questions) as Markdown without raw HTML. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={(u) => (REF.test(u) ? u : defaultUrlTransform(u))}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
