---
name: bonus-event-ops
description: Generate promotional bonus event HTML content and Postman API collections for gaming platform admin backend (creditmps.com) submissions across PHP/MMK/VND/BDT/CAD/USD markets. Use this skill whenever the user gives activity details (game provider, currency, dates, ticket/prize settings, game list) and wants either (a) promotional HTML output for an activity, or (b) a Postman collection/JSON to submit the activity to the admin API. Trigger on activity briefs mentioning currency market codes (PH/MM/VN/BDT), activity type keywords (寶箱/自爆/輪盤/戳戳樂/簽到/龍虎榜/快贏/registration/daily mission/roulette/raffle/rebate/jackpot), or explicit mentions of bonusId, presentType, insertBonusEvent, or insertRankRecordSetting. Also use when asked to update/manage the "BonusEvent_Admin" Postman collection.
---

# Bonus Event Operations (HTML + Postman API)

This skill covers two parallel workstreams for gaming platform promotional bonus events:
1. **HTML generation** — producing currency-localized promotional HTML from a template + activity brief
2. **Postman API generation** — producing a `insertBonusEvent` / `insertRankRecordSetting` request, packaged as an importable Postman collection

Read `references/html-rules.md` before producing any HTML output.
Read `references/html-templates.md` for the reusable HTML skeleton per activity type — this means the user does NOT need to re-paste an HTML template every time; only the activity-specific numbers/dates/games need to be supplied.
Read `references/api-rules.md` before producing any Postman/API output.
Read `references/activity-codes.md` for activity type code lookups and provider abbreviation quirks.

## Core principle: templates are reference-only

Whatever template (HTML or HAR/API example) the user provides is a **structural reference only**. Every currency-dependent, provider-dependent, or activity-specific value in it must be replaced with the actual activity's values — never carry over a template's placeholder currency, clearing time, symbol, language, provider name, or game list. If Claude catches itself about to leave a template value unchanged "because it's probably fine," that's the signal to double check against the actual brief.

## Settled conventions — never raise these as open questions again

Brian has already answered these more than once. Treating them as ambiguous wastes his time.

1. **All API date fields use hour 12 (12:00 GMT+8), every currency, every type.** That's server backend time. The currency clearing times (MMK 10:30, VND 11:00, etc.) belong only to player-facing HTML/banner/announcement copy. One MMK activity correctly shows `12` in the API and 10:30 in the Burmese HTML. The sole computed exception is `redeemDeadlineDate`. See "The 12:00 rule" in `api-rules.md`.
2. **INSTANT_CHALLENGE caps are always daily caps** — 「每人上限X, 上限張數Y張」 means X/day and Y/day.
3. **「可設定為公開 / 僅某某站台開放」 is announcement content**, not an API field. `accessLevel` stays `public`.
4. **`calculatedGameType` codes** are exactly: `LIVEARENA`, `LIVE`, `SPORTS`, `LOTTERY`, `FH`, `SLOT`, `ARCADE`, `RNGTABLE`. "FISH" in a brief means `FH`.
5. **MPS VIP Point totals in an EX/example line are `bonus ÷ 100`**, for every activity type — not turnover ÷ 100. See `html-rules.md`.
6. **Localized HTML is translated directly from the English skeleton** in every language, using standard gambling terminology. Never ask Brian for a localized sample, HAR, or reference translation — `html-templates.md` already holds every skeleton he needs supplied.
7. **API parameter → server time (GMT+8, 24-hour). Player-facing HTML → converted to market time (12-hour AM/PM).** This covers every timestamp including `redeemDeadlineDate`. The two intentionally differ by the market's offset from GMT+8; that is not a bug to reconcile. See `html-rules.md`.

## Workflow: HTML request

1. Identify the activity type and pull its skeleton from `references/html-templates.md`. If the user supplies their own template instead (they still can, and it should be respected as the source of truth for that request), use theirs.
2. Identify currency from the activity name/code (PH→PHP, MM→MMK, VN→VND, etc.) — cross-check against the currency symbol in any promo copy given, since market-code prefixes like "MY" are ambiguous (see activity-codes.md)
3. Apply the matching clearing time, currency symbol, and third-language rules (see `references/html-rules.md`)
4. Rewrite ALL HTML text content into the correct language — do not leave residual language from a stored skeleton or a user-provided template
5. Only exception to "don't change HTML structure": currency codes embedded in `class` attributes (e.g. `class="txt-rate PHP"`) must be updated to the real currency
6. Compute the activity ID using the naming convention in `references/activity-codes.md`
7. Output: the modified HTML block(s) + the activity ID + three-language Announcement titles (EN / Simplified Chinese / market language)

## Workflow: Postman API request

1. Determine `presentType` from the activity type (see `references/activity-codes.md` for the mapping table)
2. If this exact type has an established template in the collection, reuse its **field structure** and substitute actual values (dates, currency, platform, game IDs, prize/probability tables, medal settings). Reuse the structure, not the values — a template item is a single data point and can carry an outlier value. Where a reference file states a per-type default (e.g. the RACE_WIN table in `api-rules.md`), that default wins over whatever the template item happens to contain. If any HAR in the conversation includes a `findAll*` query response, mine it for the real field distribution before trusting either.
3. If this is a brand new type with no template yet, ask the user for a HAR file of that type before proceeding
4. Compute `updateTime`/`createTime` using the actual current GMT+8 time with real milliseconds — run:
   ```
   TZ='Asia/Shanghai' date "+%Y-%m-%d %H:%M:%S.%3N"
   ```
   Never hardcode `.000` or a fabricated time.
5. Apply field-specific rules from `references/api-rules.md` (challenge-type games, isInstantPay, medal/rank reward settings, platform code mismatches, presentPrizeNum conventions, etc.)
6. Update the **`Latest Activity`** item in `BonusEvent_Admin.postman_collection.json` — overwrite its body entirely with the new activity's fields. Do NOT create a new item per activity; do NOT keep multiple "latest activity" slots — even for companion activities meant to be submitted together (e.g. a Hacksaw daily mission and a BNG daily mission sharing one announcement title are still two separate, sequential asks — each one replaces the previous "Latest Activity" content, full stop). Every new activity submission replaces whatever was there before, even if it's a completely different provider/currency/type than what was there previously — this is intentional, not a bug to work around.
7. Permanent per-type template items (Daily Mission, Roulette, Golden Egg, Rebate, Auto Redeem single/3-tier, Instant Challenge, Treasure Pick single/nine/3-tier, Signup, Raffle, Rank Record, Race Win, etc.) are never removed or overwritten — they stay as reference. Only add a new permanent template item when the user provides a HAR for a genuinely new `presentType`/endpoint not yet covered.
8. Cookie/session handling: always use `{{sessionCookie}}` as a Cookie header placeholder and `{{baseUrl}}` for the host — never hardcode an actual session value or environment URL. These are Postman collection-level variables the user sets themselves via Postman's Cookie Manager and Collection Variables.
9. If a HAR of an attempted submission is available, read the response **body** before treating the submission as done — this endpoint returns HTTP 200 for rejections and only signals failure via an `error` key (see `references/api-rules.md`).
10. After building/updating the collection JSON, validate it parses as JSON, copy to the outputs directory, and use `present_files` to hand it to the user. Briefly summarize what changed (activity ID, key computed values) — don't just say "here you go."

## When the user shares a HAR of their own submission

Brian sometimes submits an activity by hand and then hands over the HAR to compare. Do a real field-by-field diff (script it, don't eyeball it) and report every delta with evidence. His submission is authoritative about the API's *shape* — field names, encoding, which fields exist — but it is not automatically authoritative about *values*: a `{"status":"200","message":"success"}` response only proves the payload parsed. Where his value contradicts both the brief text and the historical convention, that's a probable data-entry slip in a live production record and needs flagging, not silent adoption into this skill. See "Reconciling a user's own submission HAR" in `references/api-rules.md` for the three-bucket sorting rule.

## When something doesn't fit the known rules

If a brief includes a setting with no established rule (e.g. a new game-type code, a new medal structure, a currency/provider combination never seen before), don't guess silently — state the assumption you're making and flag it for the user to confirm, the same way you would flag an ambiguous instruction. Once confirmed, this skill's reference files should be updated to capture the new rule for next time (edit `references/*.md` directly).
