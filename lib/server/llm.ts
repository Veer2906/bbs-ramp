import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock, AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { env } from "./env";
import type { Provider, Settings, Usage } from "../types";

export type MessagesClient = Pick<Anthropic, "messages">;

export const MODEL_OPTIONS: Record<Provider, { id: string; label: string; hint: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Best balance" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "Fastest, cheapest" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "Most capable" },
  ],
  bedrock: [
    { id: "global.anthropic.claude-sonnet-4-6", label: "Claude Sonnet 4.6", hint: "Bedrock, global profile" },
    { id: "global.anthropic.claude-haiku-4-5-20251001-v1:0", label: "Claude Haiku 4.5", hint: "Bedrock, fastest" },
    { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Claude Sonnet 4.5", hint: "Bedrock, US profile" },
    { id: "anthropic.claude-sonnet-5", label: "Claude Sonnet 5", hint: "Claude in Bedrock (Mantle)" },
  ],
};

// USD per million tokens: input, output. Cache writes are 1.25x input; reads use `read`.
const PRICES: [RegExp, { input: number; output: number; read: number }][] = [
  [/haiku-5-5/, { input: 0.1, output: 0.5, read: 0.01 }],
  [/haiku-4-5/, { input: 1, output: 5, read: 0.1 }],
  [/sonnet-5-5/, { input: 2, output: 10, read: 0.1 }],
  [/sonnet-5/, { input: 2, output: 10, read: 0.2 }],
  [/sonnet-4/, { input: 3, output: 15, read: 0.3 }],
  [/opus-5-5/, { input: 4, output: 20, read: 0.2 }],
  [/opus/, { input: 5, output: 25, read: 0.5 }],
];

export function addUsage(usage: Usage, model: string, u: Anthropic.Usage | undefined) {
  if (!u) return;
  const p = PRICES.find(([re]) => re.test(model))?.[1] ?? { input: 3, output: 15, read: 0.3 };
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  usage.input += input;
  usage.output += output;
  usage.cacheRead += read;
  usage.cacheWrite += write;
  usage.turns += 1;
  usage.costUsd += (input * p.input + output * p.output + read * p.read + write * p.input * 1.25) / 1e6;
}

export function providerAvailability() {
  return {
    anthropic: Boolean(env.anthropicKey()),
    bedrock: Boolean(env.bedrockToken()) || env.awsKeys(),
  };
}

// Region-prefixed inference profiles and versioned ids go through the InvokeModel
// integration; plain `anthropic.claude-*` ids go to Claude in Bedrock (Mantle).
const isLegacyBedrockId = (m: string) => /^(us|eu|apac|global|jp|au)\./.test(m) || /-v\d+:\d+$/.test(m);

export function llmFor(settings: Settings): { client: MessagesClient; model: string; provider: Provider } {
  if (settings.provider === "bedrock") {
    const model = settings.bedrockModel;
    const apiKey = env.bedrockToken();
    const awsRegion = settings.bedrockRegion || env.awsRegion();
    const client = isLegacyBedrockId(model)
      ? new AnthropicBedrock({ awsRegion, ...(apiKey ? { apiKey } : {}), maxRetries: 3 })
      : new AnthropicBedrockMantle({ awsRegion, ...(apiKey ? { apiKey } : {}), maxRetries: 3 });
    return { client: client as unknown as MessagesClient, model, provider: "bedrock" };
  }
  const apiKey = env.anthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local or switch to Bedrock in settings.");
  return { client: new Anthropic({ apiKey, maxRetries: 3 }), model: settings.anthropicModel, provider: "anthropic" };
}
