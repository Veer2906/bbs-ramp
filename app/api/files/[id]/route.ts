import fs from "node:fs";
import path from "node:path";
import { fail } from "@/lib/server/http";
import { store } from "@/lib/server/store";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const doc = store.documents().find((d) => d.id === id);
  if (!doc?.fileName) return fail("No file for this document", 404);
  const ext = path.extname(doc.fileName).toLowerCase() || ".bin";
  const file = path.join(store.filesDir(), `${doc.id}${ext}`);
  if (!fs.existsSync(file)) return fail("File missing from the repository", 404);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName.replace(/"/g, "")}"`,
      // HTML documents come from third-party portals; never let them run script on this origin.
      ...(ext === ".html" || ext === ".htm" ? { "Content-Security-Policy": "sandbox" } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
