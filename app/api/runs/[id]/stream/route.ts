import { sse } from "@/lib/server/http";
import { runs } from "@/lib/server/runs";

export async function GET(req: Request, ctx: RouteContext<"/api/runs/[id]/stream">) {
  const { id } = await ctx.params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return sse((send, close) => {
    const l = runs.get(id);
    if (!l) {
      close();
      return () => {};
    }
    for (const e of l.run.events) if (e.id > after) send({ type: "event", event: e });
    const { events: _e, ...rest } = l.run;
    void _e;
    send({ type: "run", run: rest });
    if (l.frame) send({ type: "frame", ...l.frame });
    return runs.subscribe(id, send);
  }, req.signal);
}
