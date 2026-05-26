import type { ReportItem, TriageItem } from "./types.ts";

// ---------------------------------------------------------------------------
// Triage stage: mechanical projection only.
// ---------------------------------------------------------------------------
//
// This module USED TO contain phrase-list heuristics that classified each
// report into one of seven buckets (primary_report / chatter / developer_reply
// / correction / evidence_only / follow_up / additional_report) and proposed
// an action (create_issue / skip / needs_human_review) per item. That output
// was unreliable, drifted from the LLM's later judgement, and produced the
// `[ox / y]`-shaped console noise the user flagged.
//
// New contract (2026-05-26): the script does not classify. The triage stage
// only joins ReportItem rows by thread, sorts them, and projects to TriageItem
// shape. The LLM operator running /bug-triage reads triage-items.jsonl, calls
// the bug-coverage-classifier per card-bearing item, and applies its own
// action bucketing. No heuristic phrase lists. No proposed_action gate.

export async function triageReports(reports: ReportItem[]): Promise<TriageItem[]> {
  // Group by thread, then sort each group by reported_at ascending so the LLM
  // sees thread context in chronological order.
  const byThread = new Map<string, ReportItem[]>();
  for (const r of reports) {
    if (!byThread.has(r.thread_id)) byThread.set(r.thread_id, []);
    byThread.get(r.thread_id)!.push(r);
  }
  for (const items of byThread.values()) {
    items.sort((a, b) => a.reported_at.localeCompare(b.reported_at));
  }

  const result: TriageItem[] = [];
  for (const threadItems of byThread.values()) {
    for (const r of threadItems) {
      result.push({
        report_id: r.report_id,
        thread_id: r.thread_id,
        thread_name: r.thread_name,
        message_id: r.message_id,
        reported_at: r.reported_at,
        author_name: r.author_name,
        cards: r.cards,
        summary: r.summary,
        actual: r.actual,
        extraction_confidence: r.extraction_confidence,
        source_url: r.evidence.source_url,
      });
    }
  }
  return result;
}
