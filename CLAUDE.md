# jame gam

Monthly teen game jam YSWS. SvelteKit site (jamegam.hackclub.com) on Vercel, data in Airtable.

## Airtable

Base: **`apprhNJsC9D4nlFRB`** ("jame gam") - https://airtable.com/apprhNJsC9D4nlFRB/

Read it directly with the Airtable MCP (`query` runs DuckDB SQL over a synced cache). Do NOT go through the
unified-db MCP for jame gam questions: the unified DB only sees records that made it through the YSWS
submission automation, so counts lag and don't match this base.

| duckdb table | Airtable table | id | what it is |
| --- | --- | --- | --- |
| `jams` | Jams | `tblMasZDYexglIoI3` | one row per jam (name, itch_url, start_date, end_date) |
| `sign_ups` | Sign Ups | `tblOm8tYH8J6Llv32` | jam signups (HCA/OIDC), Loops sync fields, `hca_access_token` |
| `submission_form` | Submission Form | `tblmnQSVJBu5EBoVY` | the real submissions table (game, hours, NPS text, address, review fields) |
| `ysws_project_submission` | YSWS Project Submission | `tbljQq6tUA9a6sJ30` | staging rows pushed to the Unified YSWS DB |
| `shop_orders` | Shop Orders | `tblqVjQ3ROSx7OuAq` | prize orders + fulfillment state |
| `prize_suggestions` | Prize Suggestions | `tblaBoMc48ShvtM2n` | free-text prize ideas |
| `ysws_config` | YSWS Config | `tblXRomBjyRWN1Xkd` | key/value config (YSWS program record id) |

Notes:
- `submission_form.jam` is a plain string month key: `2026-06`, `2026-07`. `sign_ups.jam` is a link to `jams`.
- Jam months so far: `2026-06` = The Very Serious Juniper Dev Game Jam (Jun 19-27), `2026-07` = GMTK Game Jam 2026 (Jul 22-26).
- Reviewer/eligibility fields on `submission_form`: `review_status`, `reviewed_by`, `augie_spotchecked`,
  `hide_perma_reject`, `verification_status`, `override_hours`, the three `justification_*` fields,
  `extra_cool`, plus `action_send_approved_dm` / `approved_dm_sent_at` for the prize DM.
  (`zzz_archive_override_hours_justification` is a superseded v1 field, kept for June's history. It is
  `fldwXbb2huFn8v62w`; the sync script reads it by ID, not name.)

### Review -> Unified DB pipeline (v2 component, migrated 2026-07-30; spotcheck gate 2026-08-03)

How a submission becomes a weighted project. Six steps, three of them automated. **Two human gates:** a
reviewer's `review_status` and Augie's `augie_spotchecked`. Staging waits on both, so everything in
`YSWS Project Submission` is ready to submit; approval alone only opens the prize shop.

1. **Fillout form -> `Submission Form`.** One row per person, not per game: teammates each submit
   separately with the same `code_url`.
2. **Airtable automations enrich the row**, most notably `github_commits` (commit count on the repo).
3. **A reviewer reviews in `Submission Form`.** The decision lives in `review_status` (single select,
   added 2026-07-30); who made it lives in `reviewed_by`. **Empty means not yet reviewed, and that is what
   the review view filters on**, so rows never vanish mid-edit and new Fillout submissions land unreviewed
   with no automation needed.
   - `Approved` - opens the prize shop immediately, and makes the row eligible to stage once spotchecked
     (staging also requires `override_hours` + `justification_technical_features`)
   - `Rejected` - retracts the staged row if it was never submitted, and blocks the prize shop
   - `Needs Augie` - parked out of the review queue, retracts
   - `Pending` - reviewer asked the submitter something and is waiting on a reply, retracts. No follow-up
     mechanism exists; it is an untracked waiting queue you have to sweep by hand.
   - `Prize Only` - Augie's call, not a reviewer's: reward the project with a prize but never send it to
     the unified DB (e.g. the hours are real but not eligible). Opens the shop, retracts any staged row,
     and can never stage because the sync gates on exactly `Approved`. Costs prize money with no $85/WP
     against it, so it is worth keeping countable rather than faking it by never spotchecking.
   `hide_perma_reject` is untouched and orthogonal. (The v1 `rejected` checkbox is gone.)
   The reviewer-facing justification fields (each carries an in-Airtable description explaining what
   belongs in it):
   - `justification_technical_features` - REQUIRED, gates the sync. Specific features, not languages.
   - `justification_deflation` - only when approving fewer hours than claimed. Reason only; the
     "deflated from Xh to Yh" numbers are generated.
   - `justification_additional` - optional context for a spot-checker.
   `zzz_archive_override_hours_justification` is the **v1 field and is no longer used**. It holds June's
   reasoning for history, sorted to the end of the field list by the `zzz_` prefix. The script logs a loud
   warning if someone types into it out of habit.
4. **Augie spotchecks, ticking `augie_spotchecked`.** The second gate, and the thing that actually stages
   the row. He also ticks `action_send_approved_dm` (fill down the column) to fire the "your project was
   approved, pick your prize" Slack DM: `claude-workspace/approved-dm-automation.js`, deduped by
   `approved_dm_sent_at` and by email-within-jam so repeat submitters only hear once. Same
   checkbox-plus-timestamp shape as `fulfilled-dm-automation.js`. Nothing DMs anyone automatically.
5. **Sync automation stages a `YSWS Project Submission` row.** Script:
   `claude-workspace/jamegam-sync-automation.js` (the copy in Airtable is the live one; keep this in sync;
   `jamegam-sync-automation.v1.js` is the pre-migration version). It fires on edits to `review_status` /
   `augie_spotchecked` / `override_hours` / the three `justification_*` fields, and:
   - gates on `review_status == "Approved" && augie_spotchecked && override_hours != null && justification_technical_features != ""`,
     refusing to stage (with a loud log line) if it is past both gates but something required is missing;
   - writes the split `Justification - *` fields, generating the ones that can be generated: the Hackatime
     date range (from the jam's start/end dates), the Alternate Tracking Method paragraph, and the
     Additional Justification block (claimed/approved hours, commits, team size, sibling count, jam);
   - **auto-fills `Optional - Override Duplicate Justification`** for team repos by scanning
     `Submission Form` for other non-rejected rows with the same normalized `code_url`;
   - **explicitly clears `Optional - Override Hours Spent Justification` on every write** (see footgun below);
   - maps identity + address + URLs + screenshot + NPS text across;
   - upserts via the `Submission` link field (reverse link `ysws_project_submission_record` on the form
     row is the dedup key), and **retracts** the staged row (delete, only if never submitted) whenever the
     row falls back out of Approved-and-spotchecked, including unticking the spotcheck;
   - deliberately leaves `Automation - Submit to Unified YSWS` unticked;
   - warns in the log on: deflation with no reason given, a submitter who looks 18+, or v1-field usage.
6. **Augie ticks `Automation - Submit to Unified YSWS`** on the staged row, which is the stock component
   automation that creates the record in the Unified YSWS DB and writes back
   `Automation - YSWS Record ID` / `Automation - First Submitted At` / `Automation - Status`. Under v2 you
   can edit a staged row and tick submit again to **update** an existing unified record. Because everything
   staged is already spotchecked, this is safe to fill down the whole column.

The `YSWS Project Submission` table + step-6 automation are the shared Hack Club **component** (library
template), not jame gam code. Everything in steps 1-5 is jame gam's own.

**The prize shop gates on `review_status` directly** - `SHOP_STATUSES` in `src/lib/shop.js`, currently
`Approved` and `Prize Only` - in `src/routes/prizes/+page.server.js` and
`src/routes/api/shop/order/+server.js`. NOT on the presence of a staged row: that was the pre-2026-08-03
proxy, and it breaks now that staging waits on the spotcheck. Ordering backfills address and birthday onto
the submission row, and mirrors into the staged YSWS row only if one exists yet; when it doesn't, the sync
carries the address across at staging time.

**Shop deadlines are per person** (2026-08-03). Each submitter gets `PICK_WINDOW_DAYS` (4) from the moment
their prize DM sends, expiring 11:59pm ET that day, capped by `SHOP.closesAt` so fulfillment still has one
batch end. `closesAtFor()` / `closesTextFor()` in `src/lib/shop.js` compute it from `approved_dm_sent_at`;
`approved-dm-automation.js` computes the same date and writes it into the DM. **The DM script duplicates
`PICK_WINDOW_DAYS` and `SHOP.closesAt`** because an Airtable automation cannot import from the repo - if
they drift, the DM promises a date the shop won't honour. Nobody DMed yet has no clock running and sees
the global date.

**Submitting before they order** leaves the unified record holding the form-typed address. A later shop
order updates Airtable only, so re-tick `Automation - Submit to Unified YSWS` to push the change.

**The footgun.** The component's `Automation - Unified Justification` formula returns
`Optional - Override Hours Spent Justification` verbatim whenever it is non-empty, ignoring all seven
`Justification - *` fields. That is why the script writes `""` to it rather than omitting it: a re-synced
June row would otherwise silently keep its v1 blob. Never write that field again.

**Why duplicate justification is auto-filled.** jame gam submits per person, not per team, so teammates
legitimately share a repo: 78 of 178 July rows share a `code_url` (24 repos, one with 9 submitters). Under
v1 this cost real money, every team submission was auto-flagged `is_duplicated` and set to "Needs Changes"
by drydock sonar, needing a human second pass, and one June project is still out of the unified DB because
of it (48 in the DB against 49 submitted).

**Known gaps.** The Fillout form does not collect the numeric Hackatime ID, so
`Justification - Submitter Hackatime ID` is a constant "not reported" string. The component's
`[HACKATIME]` block is emitted unconditionally even for the ~60% of submitters with no Hackatime, so the
script writes an explicit "none reported" sentence there rather than leaving it blank.

State on 2026-08-03: `2026-06` done (54 subs, 49 in the unified DB, 5 rejected), and all 49 were
backfilled `augie_spotchecked = true` so the new gate holds retroactively. `2026-07` is 184 subs, 108
unreviewed, 50 Approved / 12 Needs Augie / 10 Pending / 4 Rejected, reviewed by Jack Jacobson (43) and
Gabin Tavernier (31). 49 of those rows were staged under the pre-spotcheck rules and are grandfathered:
they sit staged-but-unspotchecked until Augie gets to them, and any edit to a watched field retracts them
until he does. Only 1 July project is in the unified DB. Pre-migration snapshot of both tables plus the
staged-row link map: `claude-workspace/v2-migration-snapshot/`.

### NPS

- Score lives in `submission_form.nps_recommend` (1-10), free text in `nps_doing_well` / `nps_improve`.
- Categories (HC convention): promoter 9-10, passive 7-8, detractor 1-6. NPS = %promoters - %detractors.
- **Partial gap: the July/GMTK form only started collecting the 1-10 score on 2026-07-27**, so 18 of 178
  `2026-07` rows have a score and 160 have only the free text. June is complete (54/54).
  `scripts/sync-nps.mjs` skips scoreless rows. July's NPS is computable but from a late, self-selected
  18-row tail, so treat it as unreliable rather than missing.
