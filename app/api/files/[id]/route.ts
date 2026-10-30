import path from "node:path";
import { fail } from "@/lib/server/http";
import { mimeFor } from "@/lib/server/mime";
import { store } from "@/lib/server/store";


export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const doc = (await store.documents()).find((d) => d.id === id);
  if (!doc?.fileName) return fail("No file for this document", 404);
  const ext = path.extname(doc.fileName).toLowerCase() || ".bin";
  const data = await store.getFile(`${doc.id}${ext}`);
  if (!data) return fail("File missing from the repository", 404);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeFor(ext),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName.replace(/"/g, "")}"`,
      // HTML documents come from third-party portals; never let them run script on this origin.
      ...(ext === ".html" || ext === ".htm" ? { "Content-Security-Policy": "sandbox" } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
