# EuroScout: Free-agent control and performance fixes

Apply the six replacement files from `EuroScout-changed-files.zip` over the matching files in the supplied project. Alternatively, apply `EuroScout-performance.patch` from the project root with `git apply`. The patch targets the uploaded ZIP, so review conflicts if the repository has changed since that export. This work has not been deployed.

## Changes

- Replaced the oversized NBA / G League checkbox with a compact switch using the page's existing colors, borders and spacing. The label is clickable, Space toggles it, keyboard focus survives the result redraw, and a short explanation clarifies its scope. Includes mobile, reduced-motion and forced-color styling. Defaults and saved-filter behavior are preserved.
- Normal HTTP startup now fetches `data/data.json` once instead of also loading the identical `data/data.js`. The JavaScript bundle remains the fallback for direct file opening, failed requests, invalid JSON and a 15-second JSON timeout. Public statistics download alongside authentication; shared reads still await authentication.
- Indexed market research by player ID and agency/client research by normalized name. Birth-year checks, source-record precedence and manual overrides remain authoritative.
- Indexed club names and aliases for transfer matching. Indexes rebuild when the existing team cache changes; ambiguous matches remain rejected.
- Debounced Free-agent text search by 160 ms, avoiding a full results/form rebuild for every keystroke. Other filter changes remain immediate. NBA/G League arrivals now refresh an open Free-agent view.
- Updated the changed assets' version strings so browsers fetch the replacements.

## Measurements and verification

Measured locally in the Codex browser against the supplied data, with a test server selecting the application's existing local mode. No live account was used. The delivered `config.js` is unchanged. Profiling instrumentation and local-mode overrides are not in the replacement files or patch.

- Original core requests: **15,044,068 bytes of JavaScript plus 15,044,043 bytes of JSON**. Updated: **15,044,043 bytes of JSON only** on the successful HTTP path. This removes 15.04 MB of decoded payload and one dataset evaluation; actual compressed network savings depend on hosting.
- Seven filter runs per case, median milliseconds:

| Filter case (all availability statuses) | Original | Updated | Result count |
| --- | ---: | ---: | ---: |
| NBA off, all positions | 243.0 | 156.4 | 6,281 |
| NBA off, bigs | 36.7 | 24.1 | 1,021 |
| NBA on, all positions | 287.0 | 197.8 | 7,131 |
| NBA on, bigs | 51.8 | 37.7 | 1,236 |

The ordered result fingerprints (player IDs, status, evidence note and source URL) matched in all four cases.

- Full bio/agency override passes fell from approximately **0.92–1.49 s** in the original trace to **0.06–0.09 s** after the name indexes.
- The trace before the club-name index showed background auto-transfer passes of **4.33 s and 7.37 s**; the final trace showed **1.56 s and 1.70 s**. These are observed local timings, not controlled production load-time guarantees; feed timing and saved roster state can affect them.
- Syntax checks passed for all inline scripts and changed JavaScript. The included regression runner passes eight loader scenarios, 4,335 research-lookup comparisons, source-order and refresh cases, and club alias/ambiguity/cache invalidation checks. Run `node tests/performance-regression.cjs .` from the project root after applying the replacements.
- Browser checks covered the desktop and 390-pixel mobile layout, switch on/off with Space, retained keyboard focus, search and reset. Mobile had no horizontal document overflow. No browser console errors were recorded in the final checked local session.

## Remaining work for Codex

1. **Profile the deployed site inside authenticated DragonsHub.** Supabase session initialization, membership, scouting and app-data reads still sit on the startup path. Live server latency, actual transfer compression, cache headers and embedded authentication were not measurable from this ZIP/local-mode test.
2. **Reduce the remaining synchronous background work.** Auto-transfer/club processing still blocks for roughly 1.6–1.7 seconds locally. Club-group rebuilding and full dataset passes remain candidates for chunking or further indexing. NBA/G League (1.14 MB) and NCAA (4.91 MB) still download automatically to preserve existing search/deep-link coverage; a true lazy-loading redesign needs loading states and deep-link handling.
3. **Resolve transfer-application intent.** The market feed refresh says manual review only, but the existing extra-league loader still invokes `applyAutoTransfers` for bundled records. That behavior was preserved; decide separately whether background roster writes are intended before removing or restructuring them.
4. **Verify authentication and data exposure separately.** The ZIP includes bundled imported notes/research and a client sign-in gate. This change does not implement the earlier requested DragonsHub session handoff or server-side data-access rules. Test those with the backend and deployment configuration before treating the gate as protection for downloadable assets.

Changed project files: `index.html`, `euroscout-market.css`, `euroscout-market.js`, `euroscout-agency-research.js`, `euroscout-011.js`, `euroscout-transfers.js`.
