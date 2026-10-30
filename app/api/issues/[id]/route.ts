import { body, fail, json } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import type { Issue } from "@/lib/types";

export async function PATCH(req: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  const { status } = await body<Issue>(req);
  if (status !== "open" && status !== "resolved") return fail("status must be open or resolved");
  const issue = await store.updateIssue(id, { status });
  if (!issue) return fail("Issue not found", 404);
  return json(issue);
}
