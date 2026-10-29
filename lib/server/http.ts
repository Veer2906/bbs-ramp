import "server-only";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const fail = (e: unknown, status = 400) => json({ error: e instanceof Error ? e.message : String(e) }, status);

export async function body<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function sse(setup: (send: (data: unknown) => void, close: () => void) => () => void, signal: AbortSignal) {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(ping);
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = (data: unknown) => {
        if (open) controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const ping = setInterval(() => open && controller.enqueue(enc.encode(": ping\n\n")), 15000);
      cleanup = setup(send, close);
      signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
