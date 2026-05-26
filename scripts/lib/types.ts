export interface RawDiscordMessage {
  source: "discord";
  guild_id: string;
  channel_id: string;
  thread_id: string;
  thread_name: string;
  message_id: string;
  timestamp: string;
  edited_timestamp: string | null;
  author_id: string;
  author_name: string;
  author_is_bot: boolean;
  content: string;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    content_type: string | null;
    size: number;
  }>;
  embeds: Array<{
    title: string | null;
    description: string | null;
    url: string | null;
    type: string | null;
  }>;
  referenced_message_id: string | null;
  fetched_at: string;
  content_hash: string;
}

export interface ReportItem {
  report_id: string;
  source: "discord" | "github";
  thread_id: string;
  thread_name: string;
  message_id: string;
  item_index: number;
  reported_at: string;
  author_name: string;
  cards: string[];
  mechanics: string[];
  summary: string;
  actual: string;
  expected: string;
  evidence: {
    source_url: string;
    attachments: RawDiscordMessage["attachments"];
    raw_content_hash: string;
  };
  extraction_confidence: number;
  status: "unlinked" | "linked" | "duplicate" | "stale" | "ignored";
}

// Mechanical projection of ReportItem into the triage stage. The script does
// not classify, bucket, gate, dedup, or pre-judge — those are all the LLM
// operator's job (running /bug-triage, which calls the bug-coverage-classifier
// per item and applies its own action bucketing). This type intentionally
// excludes heuristic fields (classification, proposed_action, parser_status,
// dedup_group) that an earlier design tried to compute statically and that
// proved unreliable. See `feedback_triage_script_classification_unreliable.md`
// in project memory for the prior-art.
export interface TriageItem {
  report_id: string;
  thread_id: string;
  thread_name: string;
  message_id: string;
  reported_at: string;
  author_name: string;
  cards: string[];
  summary: string;
  actual: string;
  extraction_confidence: number;
  source_url: string;
}

export interface PublishedThread {
  issue_number: number;
  issue_url: string;
  reacted_message_id: string;
  reply_message_id: string;
  published_at: string;
  mode: "created" | "reconciled";
  /** Operator note when marking handled without filing (e.g. "dup of #406"). */
  notes?: string;
}

export interface SyncState {
  last_fetch_at: string;
  /** `last_fetch_at` value from the run *before* the most recent fetch.
   *  Defines the delta window [prev_fetch_at, last_fetch_at): messages with
   *  `fetched_at > prev_fetch_at` are the new-since-last-fetch slice that
   *  `triage` emits to `triage/triage-delta.jsonl`. */
  prev_fetch_at?: string;
  last_thread_cursors: Record<string, string>;
  imported_from_legacy: boolean;
  /** thread_id → record of the GitHub issue tracked in that Discord thread,
   *  OR a handled-without-issue sentinel (issue_number: 0, mode: "reconciled"
   *  with a `notes` field) for threads the operator decided not to file. */
  published_threads?: Record<string, PublishedThread>;
}
