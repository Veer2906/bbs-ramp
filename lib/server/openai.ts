import "server-only";
import OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";

type Params = Anthropic.MessageCreateParamsNonStreaming;
type Item = OpenAI.Responses.ResponseInputItem;
type Part = OpenAI.Responses.ResponseInputContent;

const textOf = (c: Anthropic.TextBlockParam[] | string | undefined) => (typeof c === "string" ? c : (c ?? []).map((b) => b.text).join("\n\n"));

function partOf(b: Anthropic.ContentBlockParam | Anthropic.ToolResultBlockParam["content"]): Part | undefined {
  if (!b || typeof b !== "object" || Array.isArray(b)) return undefined;
  if (b.type === "text") return { type: "input_text", text: b.text };
  if (b.type === "image" && b.source.type === "base64") return { type: "input_image", detail: "auto", image_url: `data:${b.source.media_type};base64,${b.source.data}` };
  if (b.type === "document" && b.source.type === "base64") return { type: "input_file", filename: "document.pdf", file_data: `data:${b.source.media_type};base64,${b.source.data}` };
  return undefined;
}

/** Anthropic message history → Responses API input items. Images in tool results go in a user message right after the tool outputs. */
function toInput(p: Params): Item[] {
  const out: Item[] = [];
  for (const m of p.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlockParam).text).join("\n");
      if (text) out.push({ role: "assistant", content: text });
      for (const b of m.content) {
        if (b.type === "tool_use") out.push({ type: "function_call", call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) });
      }
      continue;
    }
    const extra: Part[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const parts = typeof b.content === "string" ? [{ type: "text" as const, text: b.content }] : (b.content ?? []);
        const texts: string[] = [];
        for (const c of parts) {
          const part = partOf(c as Anthropic.ContentBlockParam);
          if (part?.type === "input_text") texts.push(part.text);
          else if (part) {
            texts.push("[attached below]");
            extra.push(part);
          }
        }
        out.push({ type: "function_call_output", call_id: b.tool_use_id, output: (b.is_error ? "Error: " : "") + (texts.join("\n") || "ok") });
      } else {
        const part = partOf(b);
        if (part) extra.push(part);
      }
    }
    if (extra.length) out.push({ role: "user", content: extra });
  }
  return out;
}

function parseArgs(s: string) {
  try {
    return JSON.parse(s || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

// A browser task is dozens of short turns, so a little thinking per turn beats a lot.
const EFFORT = "low" as const;

/**
 * Exposes the OpenAI Responses API through the Anthropic `messages.create` shape the agent loop uses.
 * Responses, not Chat Completions: the GPT-5.6 models only accept function tools together with reasoning there.
 */
export function openaiMessages(apiKey: string, baseURL?: string) {
  const client = new OpenAI({ apiKey, baseURL, maxRetries: 3 });
  // Models that turn out not to take a reasoning setting are remembered so only their first call is retried.
  const plain = new Set<string>();
  return {
    messages: {
      async create(p: Params, opts?: { signal?: AbortSignal }): Promise<Anthropic.Message> {
        const tools = (p.tools ?? []).filter((t): t is Anthropic.Tool => "input_schema" in t);
        const request = (reasoning: boolean) =>
          client.responses.create(
            {
              model: p.model,
              instructions: textOf(p.system as Anthropic.TextBlockParam[] | string),
              input: toInput(p),
              max_output_tokens: p.max_tokens,
              store: false,
              ...(reasoning ? { reasoning: { effort: EFFORT } } : {}),
              ...(tools.length
                ? { tools: tools.map((t) => ({ type: "function" as const, name: t.name, description: t.description, parameters: t.input_schema as Record<string, unknown>, strict: false })) }
                : {}),
            },
            { signal: opts?.signal }
          );
        let r: OpenAI.Responses.Response;
        try {
          r = await request(!plain.has(p.model));
        } catch (e) {
          if (plain.has(p.model) || !(e instanceof OpenAI.APIError) || e.status !== 400 || !/reasoning/i.test(e.message)) throw e;
          plain.add(p.model);
          r = await request(false);
        }

        const content: Anthropic.ContentBlock[] = [];
        for (const item of r.output) {
          if (item.type === "message") {
            const text = item.content.map((c) => (c.type === "output_text" ? c.text : "")).join("");
            if (text) content.push({ type: "text", text, citations: null });
          } else if (item.type === "function_call") {
            content.push({ type: "tool_use", id: item.call_id, name: item.name, input: parseArgs(item.arguments) } as Anthropic.ToolUseBlock);
          }
        }
        const cut = r.status === "incomplete" && r.incomplete_details?.reason === "max_output_tokens";
        const cached = r.usage?.input_tokens_details?.cached_tokens ?? 0;
        return {
          id: r.id,
          type: "message",
          role: "assistant",
          model: r.model,
          content,
          stop_reason: cut ? "max_tokens" : content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
          stop_sequence: null,
          usage: { input_tokens: (r.usage?.input_tokens ?? 0) - cached, output_tokens: r.usage?.output_tokens ?? 0, cache_read_input_tokens: cached, cache_creation_input_tokens: 0 },
        } as unknown as Anthropic.Message;
      },
    },
  };
}
