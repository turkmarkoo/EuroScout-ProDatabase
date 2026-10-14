# Protect pending scouting edits and reduce cloud-save traffic

Small note edits previously queued complete private snapshots every 500 ms. A failed save had no delayed retry. Ordinary localStorage edits could be replaced by cloud hydration on reload, while only quota-overflow values were tracked as pending.

This update introduces a durable, account- and tab-scoped IndexedDB journal, with localStorage fallback when IndexedDB cannot open. Journal persistence precedes a local save confirmation. Unconfirmed edits are restored before cloud hydration; pre-update local data is kept as a recovery copy. An initialization failure prevents editing and offers a local recovery download rather than hydrating over the cache.

Nearby edits share an upload, with at most one upload running and a ten-second minimum interval. Unchanged snapshots are skipped. Throttled and transient requests retry with exponential delay and jitter, preserving the delay across reloads. Cloud confirmation acknowledges only the uploaded version; subsequent edits remain pending. Ordinary player saves resolve after durable local persistence, so note navigation does not wait for a cloud retry.

The cloud representation remains schema 1, with the existing compressed chunks and seed reference. Each actual changed upload is still a complete compressed private snapshot for compatibility with current hub/report readers; this release reduces repeated snapshots rather than introducing a cloud schema migration. The current head still uses a conditional version check. Confirmation comes from the commit response, avoiding a subsequent racing head read. An explicit undo during an uncertain upload remains protected and, when needed, establishes a new conditional cloud head.

Independent fields and note categories merge against their known baseline. Conflicting text, ratings, deletes and arrays without stable IDs are held for review, with both copies retained. The Recovery control exports private account copies and device-only active/last-good session data. Closed-tab pending work and pre-update cache copies can be reviewed and recovered. A document lock gives duplicated tabs separate journals in browsers with Web Locks.

Automatic identity consolidation respects active note editing and defers its page refresh. Cloud state is shown separately from local persistence in the profile and matchup. The existing overflow store, public player/statistics files, manual assignments and historical source data retain their established formats.

Cancelling a player deletion after a failed cloud confirmation also journals its rollback, so an automatic retry cannot later hide the player after the UI reports that it was kept.

## Validation

- `node tests/cloud-sync.cjs`: rapid edits, unchanged saves, delayed acknowledgements, retry timing, reloads, separate changes, conflicting fields, ambiguous commits, explicit in-flight undo, slow rebase races, intentional reverts, account separation, closed tabs and local write failures.
- `node tests/cloud-access-save.cjs`: schema compatibility, seed references, conditional head updates, commit confirmation, denied writes, ambiguous confirmation and forced protection of an uncertain undo.
- `node tests/cloud-sync-browser.cjs`: actual Store integration in isolated Chrome, real IndexedDB and localStorage, 429 rejection/recovery, reload, duplicated tabs, local save responsiveness, conflict controls, backup download, mobile layout and quota overflow. Local initialization failure retains the pre-update cache and blocks unsafe edits.
- `node tests/storage-preservation.cjs`: existing overflow durability, original bytes, notes, jerseys, historical sessions, merge undo, cross-tab updates and failed durable writes.
- `node tests/report-history-recovery.cjs`, `node tests/automatic-identity.cjs`: existing history/identity safeguards.
- `node tests/cloud-cancel-delete.cjs`, `node tests/profile-hub-sync.cjs`: cancellation supersedes pending deletion intent and existing profile handoff behavior remains intact.
- `node tests/matchup-notebook-browser.cjs`: real application flow, focused editor protection, rapid player switches and preservation of notes, jerseys, revisions and September history; no page errors.

The older `tests/session-browser.cjs` fails its long-note scrolling assertion on both the unmodified published baseline and this branch: the note viewport lies outside the test's 720 px window. This pre-existing layout/test issue is recorded and not counted as a passing check for this release.

All save failures were simulated in isolated fixtures. No live private data was read, modified, deleted or used as test data. The release is local and requires publishing. Browser/site data clearing still removes local recovery copies; a downloaded recovery file is independent of browser storage.

## First use after publishing

Keep the currently open scouting tab until the update is deployed. On the first updated load, the old local cache is captured before cloud hydration. If “recovery copies available” appears, open Recovery to download or review that cache. Conflicts require an explicit choice; choosing a version preserves a recovery copy of both. A closed tab's pending edits remain available through Recovery in a new tab.
