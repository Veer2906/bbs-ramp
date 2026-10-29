import "server-only";

const pick = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
};

export const env = {
  sailKey: () => pick("SAIL_API_KEY", "SAIL_KEY"),
  anthropicKey: () => pick("ANTHROPIC_API_KEY", "CLAUDE_KEY"),
  bedrockToken: () => pick("AWS_BEARER_TOKEN_BEDROCK", "AWS_BEARER_TOKEN"),
  awsKeys: () => Boolean(pick("AWS_ACCESS_KEY_ID") && pick("AWS_SECRET_ACCESS_KEY")) || Boolean(pick("AWS_PROFILE")),
  awsRegion: () => pick("AWS_REGION", "AWS_DEFAULT_REGION") ?? "us-east-1",
  sailApp: () => pick("SAIL_APP") ?? "ledger-agent",
  dataDir: () => pick("AGENT_DATA_DIR") ?? `${process.cwd()}/.data`,
};
