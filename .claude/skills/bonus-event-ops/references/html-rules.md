# HTML Generation Rules

## Currency → clearing time (PLAYER-FACING TEXT ONLY)
| Currency | Clearing time |
|---|---|
| PHP | 12:00 PM |
| VND | 11:00 AM |
| MMK | 10:30 AM |
| BDT | 10:00 AM |
| CAD / USD | 00:00 |
| MYR | 12:00 PM |

⚠️ **This table NEVER touches an API field.** It governs only what a player reads: HTML body copy, banner text, and announcement text. It is the local display time shown to that market.

**Every API date field, in every endpoint, for every currency, uses 12:00 GMT+8** — that is the server's backend time, not a market-local time. Do not "convert" a 12:00 in a brief into a currency clearing time, and do not flag the two as a discrepancy needing confirmation. See "The 12:00 rule" in `api-rules.md`. Verified against all 15 stored template items (PHP, MMK, VND, USD, MYR — 15/15 at hour `12`), and confirmed directly by Brian.

So a single MMK activity legitimately carries **both** times: `startDate = 2026-08-24 12` in the API request, and "10:30 AM" in the Burmese HTML the player sees. That is correct and expected, not a contradiction.

### Why the table looks the way it does
The clearing times are not arbitrary — each is the server's 12:00 GMT+8 expressed in that market's own timezone:

| Currency | Market timezone | 12:00 GMT+8 becomes |
|---|---|---|
| PHP / MYR | UTC+8 | 12:00 PM |
| VND | UTC+7 | 11:00 AM |
| MMK | UTC+6:30 | 10:30 AM |
| BDT | UTC+6 | 10:00 AM |

## The one-line rule for every timestamp (settled)

> **API parameter → server time. Player-facing HTML → converted to market time.**

Confirmed by Brian. It covers every timestamp in both workstreams, including ones with no dedicated rule elsewhere.

| | Timezone | Clock format | Example |
|---|---|---|---|
| Any API field (`startDate`, `endDate`, `bannerStartTime`, `drawFinishDate`, `redeemDeadlineDate`, `startTime`, `displayTime`) | GMT+8 server time, never converted | **24-hour** (`YYYY-MM-DD HH`, hour `00`–`23`) | `2026-10-01 00` |
| Any timestamp inside `infoHtml` / `hintHtml` / `footerHtml` / `tipText` / banner / announcement | converted to the market's timezone | **12-hour AM/PM**, date as `DD-MM-YYYY` | `30-09-2026 10:30 PM` |

Both rows above describe the *same instant* — an MMK activity ending `2026-10-01 00` on the server correctly reads `30-09-2026 10:30 PM` to a Burmese player. Never "reconcile" the two by making them match; a mismatch of exactly the market's UTC offset from GMT+8 is the proof they're right.

⚠️ Writing `00:00` as `12:00 AM` in an API field is a format error — API hours are 24-hour and never carry AM/PM.

## Currency → symbol

### Thousands separators are MANDATORY
**Every money figure of 1,000 or more takes comma thousands separators in HTML copy.** Write `K 90,000`, not `K90000`; `₱3,600`, not `₱3600`. This applies to all currencies and all activity types.

Verified against stored templates: separators are present in every item except the Rebate and Instant Challenge templates, both already flagged as carrying stale content. Those two are not precedent — the ~40 other occurrences are. Amounts under 1,000 take no separator (`K 100`, `₱1`).

Note this is a *display* convention only. API `prizeDistribution` and other numeric fields stay as bare integers with no separators.

### Space after the symbol — per currency
| Currency | Symbol format | Space? | Evidence |
|---|---|---|---|
| MMK | `K 90,000`, `K 100`, `K 1` | **yes** | 10/10 stored occurrences (Roulette, Treasure Pick 3-Tier) |
| VND | **`₫ 100 K`** — see the VND note below | **yes** | 2/2 |
| MYR | `RM 100` | **yes** | — |
| PHP | `₱3,600`, `₱100`, `₱1` | **no** | 7 activities without space; only Raffle uses `₱ 3,900`, treat as outlier |
| BDT | `৳` | no | — |
| CAD | `CA$` | no | — |
| USD | `$` | no | — |

⚠️ A past Claude output wrote MMK as `K90000` — no space *and* no separator, wrong on both counts. Check this table rather than copying whatever the previous activity's HTML happened to use.

### VND is displayed at 1:1000 — the trailing `K` is mandatory
VND figures are shown in thousands, so **every VND amount in player-facing copy carries a `K` suffix**. `₫ 100 K` means 100,000 dong. Dropping the K understates the amount by 1000× and is a serious error, not a formatting nit.

| Context | Correct | Wrong |
|---|---|---|
| Rate line | `Cược ... đủ ₫ 100 K để nhận 1 Điểm VIP MPS` | `₫ 100` |
| Non-equivalence line | `1 Điểm VIP MPS không tương đương với ₫ 1 (K).` | `₫ 1` |

Note the second form: when the amount stands alone as a unit reference rather than a sum to bet, the K goes **in parentheses** — `₫ 1 (K)`. Both forms are taken from the stored VND item (Auto Redeem 3-Tier) and both are Brian-confirmed.

Because of the 1:1000 display, VND amounts rarely need thousands separators — the K already absorbs three digits. Apply separators only if the displayed number itself reaches 1,000 or more (i.e. ≥ 1,000,000 dong).

This applies to HTML/banner/announcement copy only. **API numeric fields carry the full unscaled value with no K** — a `prizeDistribution` entry for 100,000 dong is `100000`, not `100`.

## Currency → HTML content language
| Currency | Language |
|---|---|
| PHP | **English** (not Tagalog — Tagalog/TL is ONLY used for the third Announcement title, never for HTML body text) |
| MMK | Burmese (MY) |
| VND | Vietnamese (VI) |
| BDT | Bengali (BN) |
| CAD (Quebec) | French (FR) |
| MYR | English (same as PHP's approach) |

Rewrite the ENTIRE HTML body into the target language. Do not leave the template's original language in place. Numbers, currency symbols, HTML tags/attributes/comments stay as-is; only human-readable text is translated.

## Announcement title — always 3 languages
For every activity, produce three title variants:
1. **EN** — as given by the user, or a reasonable inference from the activity name if not given (flag that it's an inference)
2. **Simplified Chinese**
3. **Market language** — PHP→TL (Tagalog), VND→VI, MMK→MY (Burmese, ISO code "my"), BDT→BN (Bengali), CAD(Quebec)→FR, MYR→**ms** (Malay — use the ISO 639-1 code `ms`, NOT "BM" or "MS" as a display label). If a currency has no third-language mapping (e.g. USD), skip the third title.

⚠️ **"MY" is ambiguous as a market-code prefix**: it can mean Myanmar (currency MMK) or Malaysia (currency MYR). Never assume — check the promo copy/currency symbol used in the brief (RM = Malaysian Ringgit → MYR; K = Kyat → MMK) or ask the user to confirm before generating anything currency-dependent.

This is ONE set of 3 titles per activity, regardless of how many days the activity runs (e.g. a 21-day Daily Mission still gets exactly one set of titles, not one per day).

## HTML structure rule (and its one exception)
Only modify text content. Do not change tags, `id` attributes, other `class` names, or `style` attributes.

**Exception**: if a `class` attribute embeds a currency code (e.g. `class="txt-rate PHP"`), replace that currency code with the activity's real currency (e.g. `class="txt-rate VND"`). This is the ONLY structural change permitted. `id` values and all other classes stay untouched. System-injected `<span>` fields (e.g. `id="miniMaxPrize"`, `id="megaMaxPrize"`, `id="eventTurnover"`) must be left EMPTY — do not fill them with computed values, the backend injects them at render time.

If the source HTML template is itself malformed (e.g. missing closing tag, oddly nested `<ul>`), preserve the malformation exactly rather than silently fixing it — flag it to the user instead of unilaterally "fixing" structure.

## Game names / IDs
Game IDs in parentheses after a game name (e.g. `Alibaba (110)`) are for identification only — never write the ID into the HTML, only the name. Verify the count of games mentioned in HTML text (e.g. "8 bonus games") matches the actual number of games in the provided list, and correct the number if it doesn't match the template's leftover count.

## Dates and day counts
- Date format in HTML: **DD-MM-YYYY** (or DD-MM if year is implied by context)
- Activity day count = actual elapsed time between start and end (not naive date subtraction +1). A bracketed day count given by the user is for cross-checking only, not something to blindly trust or blindly override — recompute independently and flag any mismatch.
- Per-day hint lists (e.g. "1st day X~Y", "2nd day Y~Z" for turnover/ticket unlock schedules) must have exactly as many entries as the day count, with dates/times rewritten to the actual activity dates and the currency's clearing time — never left as template placeholder dates.

## MPS VIP Point rule
Fixed at 100 currency units = 1 MPS VIP Point, regardless of currency. E.g. PHP → "Bet ₱100 to get 1 MPS VIP Point", MMK → "K 100 လောင်းပါက...", VND → "₫ 100 K..." (never "₫ 100" — VND always takes the K suffix, see above).

### Point count in an EX / example line — divide the TURNOVER (settled)
When a skeleton's example line states a point total, compute it as **turnover ÷ 100**, i.e. `turnoverPerPoint`:

```
points = {turnoverExample} / turnoverPerPoint      # turnoverPerPoint is 100 in every stored item
```

This is just the "Bet {SYM}100 on bonus games to get 1 MPS VIP Point" line in the same block applied to the example's turnover figure — the two are consistent, not in tension.

Verified across every stored item carrying an EX line (5 of 6 agree; the 6th is the known-bad Instant Challenge template):

| Activity | EX turnover | EX points | turnover ÷ 100 |
|---|---|---|---|
| Roulette (MMK) | K 330,000 | 3,300 | 3,300 ✓ |
| Golden Egg (PHP) | ₱3,600 | 36 | 36 ✓ |
| Treasure Pick single-tier (PHP) | ₱3,900 | 39 | 39 ✓ |
| Raffle (PHP) | ₱3,900 | 39 | 39 ✓ |
| Auto Redeem single-tier (PHP) | ₱8,000 | 80 | 80 ✓ |
| Instant Challenge (PHP) | ₱100,000 | 50 | 1,000 ✗ **stale template** |

⚠️ **Do not take the Instant Challenge template's 50 as the rule.** It is the single outlier in the collection and it is wrong; the correct figure for that example is 1,000. An earlier pass through this skill read it as authoritative because only that one item was checked — when a formula is in doubt, test it against *every* item that carries an example, not the nearest template.

Terminology note: 「bonus」 in Brian's phrasing (and in the copy itself) means **bonus games** — the qualifying game pool being wagered on — not the bonus payout. "用 bonus 去除" therefore means dividing the turnover bet on bonus games.

Worked example (JILI MMK Instant Challenge): ticket base K 5,000 × 18X = K 90,000 turnover → EX line reads **K 90,000 turnover → K 5,000 bonus → 900 MPS VIP points** (90,000 ÷ 100).

## grandPrize field
`grandPrize` is NOT computed from ticket values or turnover — it comes verbatim from the number stated in the activity's promotional copy (e.g. English announcement text saying "RM 500,000" → `grandPrize: 500000`). Always ask for or wait for the promo copy if it hasn't been provided; don't invent a round number as a placeholder.

## Activity ID (also produced alongside HTML — see references/activity-codes.md for the full naming scheme)
