# Google Tasks Commands

Google Tasks creation is confirmation-gated. `create_task` creates one item; `create_tasks` creates a list of 1–20 independent items after one confirmation.

Task items follow a structured 3-field layout: `title` (required concise action), `notes` (optional detailed instructions/sub-steps), and `due` (optional RFC 3339 / ISO 8601 deadline). The AI assistant systematically extracts and populates these fields.

Before confirmation, creation checks up to 50 active tasks for a normalized title match or an expanded version of the same title. A match produces a warning only: users can still confirm because similarly named tasks may be intentional. Warning metadata is UI-only and is never sent to Google Tasks.

Batch creation is sequential because the Google Tasks API has no multi-item transaction. The result retains per-item successes and failures, so a partial failure never hides already-created tasks.

zalo routes `/tasks` and `/task` list pending Tasks. Task-list language is routed to `create_tasks` when two or more independent items are named.
