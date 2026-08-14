# HTML Generation Rules

## Currency → clearing time
| Currency | Clearing time |
|---|---|
| PHP | 12:00 PM |
| VND | 11:00 AM |
| MMK | 10:30 AM |
| BDT | 10:00 AM |
| CAD / USD | 00:00 |
| MYR | 12:00 PM |

## Currency → symbol
| Currency | Symbol format |
|---|---|
| PHP | ₱ |
| VND | **₫ (K)** — special combined format, e.g. `₫ 100 K`, `1 MPS VIP Point is not equivalent to ₫ 1 (K).` |
| MMK | K (with space before number, e.g. `K 100`, `K 330,000`) |
| BDT | ৳ |
| CAD | CA$ |
| USD | $ |
| MYR | RM (with space before number, e.g. `RM 100`) |

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
Fixed at 100 currency units = 1 MPS VIP Point, regardless of currency. E.g. PHP → "Bet ₱100 to get 1 MPS VIP Point", MMK → "K 100 လောင်းပါက...", VND → "₫ 100 K...".

## grandPrize field
`grandPrize` is NOT computed from ticket values or turnover — it comes verbatim from the number stated in the activity's promotional copy (e.g. English announcement text saying "RM 500,000" → `grandPrize: 500000`). Always ask for or wait for the promo copy if it hasn't been provided; don't invent a round number as a placeholder.

## Activity ID (also produced alongside HTML — see references/activity-codes.md for the full naming scheme)
