import type { ReportItem, TriageItem } from "./types.ts";

function confidenceBand(confidence: number): string {
  if (confidence >= 0.9) return "high (≥0.9)";
  if (confidence >= 0.7) return "medium (0.7–0.9)";
  if (confidence >= 0.5) return "low-medium (0.5–0.7)";
  if (confidence >= 0.3) return "low (0.3–0.5)";
  return "very low (<0.3)";
}

function bandKey(confidence: number): string {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  if (confidence >= 0.5) return "low-medium";
  if (confidence >= 0.3) return "low";
  return "very low";
}

function formatReport(r: ReportItem, index: number): string {
  const cards = r.cards.length > 0 ? r.cards.join(", ") : "_none detected_";
  const mechanics = r.mechanics.length > 0 ? r.mechanics.slice(0, 5).join(", ") : "_none_";
  return [
    `### ${index + 1}. ${r.thread_name}`,
    `- **ID**: \`${r.report_id}\``,
    `- **Author**: ${r.author_name}`,
    `- **Reported**: ${r.reported_at}`,
    `- **Confidence**: ${r.extraction_confidence.toFixed(2)} (${confidenceBand(r.extraction_confidence)})`,
    `- **Cards**: ${cards}`,
    `- **Mechanics**: ${mechanics}`,
    `- **Summary**: ${r.summary}`,
    `- **Source**: [Discord link](${r.evidence.source_url})`,
    r.evidence.attachments.length > 0
      ? `- **Attachments**: ${r.evidence.attachments.map((a) => `[${a.filename}](${a.url})`).join(", ")}`
      : null,
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function renderTriageDashboard(items: TriageItem[]): string {
  // The script does not classify; this dashboard renders the raw triage items
  // grouped by thread so the LLM operator (running /bug-triage) can scan and
  // bucket. No heuristic actionable/needs-review/skipped splits.
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`# Triage Dashboard`);
  lines.push(`_Generated: ${now}_`);
  lines.push(``);
  lines.push(`Total items: ${items.length}`);
  lines.push(``);
  lines.push(`> Classification is the LLM's responsibility. Run /bug-triage to`);
  lines.push(`> classify these items via bug-coverage-classifier and your own judgement.`);
  lines.push(``);

  // Group items by thread and sort threads alphabetically for stable diffs.
  const byThread = new Map<string, TriageItem[]>();
  for (const item of items) {
    if (!byThread.has(item.thread_id)) byThread.set(item.thread_id, []);
    byThread.get(item.thread_id)!.push(item);
  }

  // Light informational signal only: which cards show up across multiple
  // threads. This is descriptive metadata, not a dedup decision.
  const cardThreads = new Map<string, Set<string>>();
  for (const item of items) {
    if (item.cards.length === 0) continue;
    const key = item.cards[0].toLowerCase();
    if (!cardThreads.has(key)) cardThreads.set(key, new Set());
    cardThreads.get(key)!.add(item.thread_id);
  }
  const multiThread = [...cardThreads.entries()]
    .filter(([, threads]) => threads.size > 1)
    .sort((a, b) => b[1].size - a[1].size);

  lines.push(`## Cards appearing in multiple threads (informational)`);
  lines.push(``);
  if (multiThread.length === 0) {
    lines.push(`_No cards appear in multiple threads._`);
  } else {
    for (const [card, threads] of multiThread.slice(0, 30)) {
      lines.push(`- **${card}**: ${threads.size} threads`);
    }
    if (multiThread.length > 30) {
      lines.push(`_…and ${multiThread.length - 30} more_`);
    }
  }
  lines.push(``);

  lines.push(`## Items by thread`);
  lines.push(``);
  for (const [threadId, threadItems] of [...byThread.entries()].sort()) {
    lines.push(`### ${threadItems[0].thread_name}`);
    lines.push(`_thread_id: \`${threadId}\` · ${threadItems.length} item${threadItems.length === 1 ? "" : "s"}_`);
    lines.push(``);
    for (const item of threadItems) {
      lines.push(`- **${item.summary || "_(no summary)_"}**`);
      lines.push(`  - ID: \`${item.report_id}\` | Confidence: ${item.extraction_confidence.toFixed(2)} | [Discord](${item.source_url})`);
      lines.push(`  - Cards: ${item.cards.join(", ") || "_none_"}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

export function renderDashboard(reports: ReportItem[]): string {
  const now = new Date().toISOString();

  // Status breakdown
  const byStatus = new Map<string, number>();
  for (const r of reports) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }

  // Confidence band breakdown
  const byBand = new Map<string, number>();
  for (const r of reports) {
    const band = bandKey(r.extraction_confidence);
    byBand.set(band, (byBand.get(band) ?? 0) + 1);
  }

  // Group by thread
  const byThread = new Map<string, ReportItem[]>();
  for (const r of reports) {
    const key = `${r.thread_id}:${r.thread_name}`;
    if (!byThread.has(key)) byThread.set(key, []);
    byThread.get(key)!.push(r);
  }

  const unlinked = reports
    .filter((r) => r.status === "unlinked")
    .sort((a, b) => b.extraction_confidence - a.extraction_confidence);

  const needsReview = reports.filter(
    (r) => r.extraction_confidence < 0.5 && r.extraction_confidence >= 0.3,
  );

  const evidenceOnly = reports.filter((r) => r.summary.startsWith("[evidence only"));

  const lines: string[] = [];

  lines.push(`# Bug Triage Dashboard`);
  lines.push(`_Generated: ${now}_`);
  lines.push(``);

  // Summary stats
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total report items | ${reports.length} |`);
  for (const [status, count] of [...byStatus.entries()].sort()) {
    lines.push(`| Status: ${status} | ${count} |`);
  }
  lines.push(``);
  lines.push(`### By Confidence Band`);
  lines.push(``);
  lines.push(`| Band | Count |`);
  lines.push(`|------|-------|`);
  for (const band of ["high", "medium", "low-medium", "low", "very low"]) {
    lines.push(`| ${band} | ${byBand.get(band) ?? 0} |`);
  }
  lines.push(``);

  // Unlinked reports sorted by confidence
  lines.push(`## Unlinked Reports (sorted by confidence)`);
  lines.push(``);
  if (unlinked.length === 0) {
    lines.push(`_No unlinked reports._`);
  } else {
    unlinked.forEach((r, i) => lines.push(formatReport(r, i)));
  }

  // Reports by thread
  lines.push(`## Reports by Thread`);
  lines.push(``);
  for (const [key, threadReports] of [...byThread.entries()].sort()) {
    const [, threadName] = key.split(":");
    lines.push(`### ${threadName} (${threadReports.length} item${threadReports.length === 1 ? "" : "s"})`);
    lines.push(``);
    threadReports.forEach((r, i) => lines.push(formatReport(r, i)));
  }

  // Low confidence items
  lines.push(`## Low-Confidence Items Needing Human Review`);
  lines.push(``);
  if (needsReview.length === 0) {
    lines.push(`_None._`);
  } else {
    needsReview.forEach((r, i) => lines.push(formatReport(r, i)));
  }
  lines.push(``);

  // Evidence-only items
  lines.push(`## Evidence-Only Items`);
  lines.push(``);
  if (evidenceOnly.length === 0) {
    lines.push(`_None._`);
  } else {
    evidenceOnly.forEach((r, i) => lines.push(formatReport(r, i)));
  }
  lines.push(``);

  return lines.join("\n");
}
