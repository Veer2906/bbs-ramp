"use client";

import type { FinancialDocument } from "@/lib/types";
import { Pill, type Tone } from "./ui";

const MAP: Record<FinancialDocument["status"], [string, Tone]> = {
  extracted: ["Unmatched", "neutral"],
  matched: ["Matched", "green"],
  needs_review: ["Needs review", "amber"],
  approved: ["Approved", "blue"],
  rejected: ["Rejected", "red"],
};

export function DocStatus({ status }: { status: FinancialDocument["status"] }) {
  const [label, tone] = MAP[status];
  return <Pill tone={tone}>{label}</Pill>;
}
