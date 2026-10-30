import "server-only";
import OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";

type Params = Anthropic.MessageCreateParamsNonStreaming;
type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Part = OpenAI.Chat.Completions.ChatCompletionContentPart;

const textOf = (c: Anthropic.TextBlockParam[] | string | undefined) => (typeof c === "string" ? c : (c ?? []).map((b) => b.text).join("\n\n"));

function partOf(b: Anthropic.ContentBlockParam | Anthropic.ToolResultBlockParam["content"]): Part | undefined {
  if (!b || typeof b !== "object" || Array.isArray(b)) return undefined;
  if (b.type === "text") return { type: "text", text: b.text };
  if (b.type === "image" && b.source.type === "base64") return { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } };
  if (b.type === "document" && b.source.type === "base64") return { type: "file", file: { filename: "document.pdf", file_data: `data:${b.source.media_type};base64,${b.source.data}` } };
  return undefined;
}

/** Anthropic message history → Chat Completions. Images in tool results go in a user message right after the tool replies, since tool messages are text-only. */
function toChat(p: Params): ChatMsg[] {
  const out: ChatMsg[] = [{ role: "system", content: textOf(p.system as Anthropic.TextBlockParam[] | string) }];
  for (const m of p.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content } as ChatMsg);
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlockParam).text).join("\n");
      const calls = m.content
        .filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use")
        .map((b) => ({ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    const extra: Part[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const parts = typeof b.content === "string" ? [{ type: "text" as const, text: b.content }] : (b.content ?? []);
        const texts: string[] = [];
        for (const c of parts) {
          const part = partOf(c as Anthropic.ContentBlockParam);
          if (part?.type === "text") texts.push(part.text);
          else if (part) {
            texts.push("[attached below]");
            extra.push(part);
          }
        }
        out.push({ role: "tool", tool_call_id: b.tool_use_id, content: (b.is_error ? "Error: " : "") + (texts.join("\n") || "ok") });
      } else {
        const part = partOf(b);
        if (part) extra.push(part);
      }
    }
    if (extra.length) out.push({ role: "user", content: extra as OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"] });
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

/** Exposes OpenAI Chat Completions through the Anthropic `messages.create` shape the agent loop uses. */
export function openaiMessages(apiKey: string, baseURL?: string) {
  const client = new OpenAI({ apiKey, baseURL, maxRetries: 3 });
  return {
    messages: {
      async create(p: Params, opts?: { signal?: AbortSignal }): Promise<Anthropic.Message> {
        const tools = (p.tools ?? []).filter((t): t is Anthropic.Tool => "input_schema" in t);
        const r = await client.chat.completions.create(
          {
            model: p.model,
            max_completion_tokens: p.max_tokens,
            messages: toChat(p),
            ...(tools.length
              ? { tools: tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input_schema as Record<string, unknown> } })) }
              : {}),
          },
          { signal: opts?.signal }
        );
        const msg = r.choices[0]?.message;
        const content: Anthropic.ContentBlock[] = [];
        if (msg?.content) content.push({ type: "text", text: msg.content, citations: null });
        for (const c of msg?.tool_calls ?? []) {
          if (c.type === "function") content.push({ type: "tool_use", id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) } as Anthropic.ToolUseBlock);
        }
        const finish = r.choices[0]?.finish_reason;
        const cached = r.usage?.prompt_tokens_details?.cached_tokens ?? 0;
        return {
          id: r.id,
          type: "message",
          role: "assistant",
          model: r.model,
          content,
          stop_reason: finish === "length" ? "max_tokens" : content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
          stop_sequence: null,
          usage: { input_tokens: (r.usage?.prompt_tokens ?? 0) - cached, output_tokens: r.usage?.completion_tokens ?? 0, cache_read_input_tokens: cached, cache_creation_input_tokens: 0 },
        } as unknown as Anthropic.Message;
      },
    },
  };
}
