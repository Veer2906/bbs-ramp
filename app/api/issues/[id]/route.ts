import { body, fail, json } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import type { Issue } from "@/lib/types";

export async function PATCH(req: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  const { status } = await body<Issue>(req);
  const issues = store.issues();
  const issue = issues.find((i) => i.id === id);
  if (!issue) return fail("Issue not found", 404);
  if (status === "open" || status === "resolved") issue.status = status;
  store.saveIssues(issues);
  return json(issue);
}
