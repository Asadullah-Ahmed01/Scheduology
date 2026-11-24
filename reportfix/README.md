# ReportFix

Students report campus problems -> AI understands and routes -> departments act ->
students confirm whether the fix was real. Built for CODE QUEST 2026.

## Run (zero dependencies, pure Python stdlib)

```bash
cd reportfix
python3 server.py
# open http://localhost:8000
```

SQLite DB (`reportfix.db`) is created and seeded automatically. `Reset all data`
in the header does a full reseed.

## The approach: how work is split between AI and regular code

| AI (`engine.py`) - understanding text | Regular code (`server.py`) - rules & math |
|---|---|
| English + Roman Urdu + mixes, typos tolerated (`wyfi` -> wifi) | Trust score math and audit log |
| Category detection (wifi/AC/fire/ragging/...) | Vote weights, thresholds, reopen rule |
| Department routing + one-line reason | Permissions (own-department-only queues) |
| Location extraction + "no guessing" flag | Me-too grouping, crowd impact counting |
| Safety-hazard detection by content words | Security affordances (fields not client-writable) |
| Injection filter (directives stripped & flagged) | State machine + brigading detection |

Key design decision: the API **never accepts** department, priority, status or
location from the report text or from the client - the only path into those
fields is the rule code. The AI layer proposes; code decides.

## Rule-by-rule map

1. **Understand & route** - `engine.analyze()` returns dept, location, priority,
   one-line reason. Shown on every report card.
2. **Group by meaning** - same category + same location = one issue; a new
   wording of the same problem becomes a "me too" join, not a second issue.
   `Lab 3 WiFi` and `Lab 3 AC` stay separate (different category, same place).
3. **Impact over tone** - SHOUTING caps and "urgent/jaldi/fori" are detected only
   to visibly state they were ignored. Safety words (fire/aag, smoke/dhuan,
   gas, sparks/current, medical) force CRITICAL from content, never tone.
4. **Reports are data, not commands** - directive clauses ("ignore all previous
   rules", "mark this as critical") are removed before classification and shown
   red-flagged as INJECTION IGNORED; the API-level design makes them powerless.
5. **Protect the vulnerable** - harassment/ragging reports are confidential
   server-side: stripped from `/api/state` for everyone except admin, absent
   from the public board and department queues, reporter shown as Anonymous
   everywhere (admin included). The reporter sees only a status card.
6. **No guessing** - an unrecognized place parks the report in
   NEEDS_CLARIFICATION with sensible options; not routed until the student
   confirms a real campus location.
7. **"Resolved" is not the end** - staff resolve -> only affected students
   (reporter + me-too joiners; server-verified, one vote each) confirm/dispute.
   Dispute weight >= 3 and > confirm weight REOPENS the issue back into the
   department queue; confirms close it and pay out trust.
8. **Not every voice weighs the same** - trust 0-100, starts 50. Weight:
   <30 -> 0.5, <70 -> 1.0, <85 -> 1.5, else 2.0. Rises when votes/reports prove
   right (+2/+3), falls for spam or wrong votes (-2, spam -10). Every change has
   a logged reason ("why you have your score").
9. **Crowds matter** - impact = sum of weights of DISTINCT affected students.
   One max-trust student = 2.0 can never alone reach the bump threshold
   (impact >= 6 raises MEDIUM -> HIGH). Several credible students can.
10. **Bonus** - trending board (sorted by impact), AI admin situation summary,
    brigading detection (3+ brand-new accounts voting together get
    zero-weighted and raise an admin alert).

## Sign-in flow (two pages, no passwords)

1. **Student portal** (default page on open): enter your Student ID
   (`STU-001 ... STU-007` in the demo) -> student dashboard.
2. Below the box: **"I am an admin / staff member"** -> separate staff portal
   page -> enter a staff/admin ID (`STAFF-EE`, `STAFF-CSE`, `STAFF-IS`,
   `STAFF-LIB`, `STAFF-CAFE`, `STAFF-LABS`, `ADMIN-01`) -> your department's or
   admin dashboard. Wrong portal gives a clear error, wrong ID is rejected.
3. **Judge quick access** stays at the bottom of both login pages: one-click
   sign-in as any user, instant new student (auto-assigned `STU-1xx` ID),
   reset all data.

The UI uses a stormy-morning palette (overcast blue-gray sky, silver light,
deep slate contrast), and every issue card shows a 4-step **priority meter**
(LOW / MEDIUM / HIGH / CRITICAL) with the engine's verdict highlighted.
Department and priority are decided by the AI engine from the report text
(content-based: safety hazards are critical regardless of tone; LOUD/urgent
words cannot move the meter).

## Judge access

- One-click user switch (Judge quick access, no passwords): admin, 6 department
  staff, 7 students with different trust histories.
- `+ New student` creates an instant fresh-trust-50 account and signs you in.
- `Reset all data` reseeds the demo.

## Honest limitations

- The router is a keyword/fuzzy lexicon, not a neural model; unknown phrasings
  fall back to admin triage instead of guessing.
- A bare "lab 3" always asks which lab (deliberate: no guessing).
- Brigading detection uses account age <= 2h + fresh flag; patient attackers
  with aged accounts need admin review to catch.
- Admin sees the full text of confidential reports (needed to act) but never
  the reporter's identity.
- Live updates are a 5-second poll, not push.

## Suggested 2-minute pitch beats

1. Live attack: injection report + calm safety report side by side.
2. Same problem in three languages becomes one issue with a me-too count.
3. Resolve -> dispute -> reopen loop, then the trust audit trail.
