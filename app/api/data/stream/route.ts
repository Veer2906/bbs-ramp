import { sse } from "@/lib/server/http";
import { runs } from "@/lib/server/runs";

export async function GET(req: Request) {
  return sse((send) => {
    send({ type: "data" });
    return runs.onData(() => send({ type: "data" }));
  }, req.signal);
}
