# Activity ID Naming & Type Codes

## Activity ID format
```
[GameProvider][Currency][TypeCode][StartMMDD][EndMMDD-1]
```
- The end-date component is ALWAYS the day before the actual end date, regardless of any "+0"/"+1" redemption-deadline note the user gives (that note affects the `redeemDeadlineDate` API field, not the ID's date math — these are two separate concepts).
- Full currency code always used (e.g. `JILIUSDDM`, never `JILIUDM`).
- This naming scheme applies to `insertBonusEvent`-type activities. `insertRankRecordSetting` activities (Rank Record / Race Win, see below) have NO bonusId field at all — don't invent one.
- SIGNUP-type activities also don't need to follow the date-suffix convention if the user has their own internal label — confirm with the user which convention they want for SIGNUP IDs going forward (default to the standard date-based scheme unless told otherwise).

## Provider abbreviation quirks (ID text vs. API field value)
Some providers use a short form in the activity ID/display text but a different, longer/different string in the actual API `platform` field. Always check this table before generating an API request — using the wrong one silently fails.

| Provider | ID / display text uses | API `platform` field uses |
|---|---|---|
| SVCASINO | `SV` | `SVCASINO` (full name) |
| PG | `PG` | `POCKET` |
| Hacksaw | `HS` | `HACKSAW` (confirm if a shorter API code ever surfaces) |

If a new provider is encountered with a possible mismatch, ask the user to confirm rather than assuming the ID abbreviation equals the API value.

## Market-code prefix ambiguity
A 2-letter market prefix in an activity label (e.g. "MY1", "PH2", "MM1") is NOT the same thing as an ISO currency code, and can be ambiguous — e.g. "MY" could mean Myanmar (MMK) or Malaysia (MYR). Cross-check against the currency symbol used in the brief/promo copy (K→MMK, RM→MYR, ₱→PHP, ₫→VND, ৳→BDT) before locking in a currency, and ask the user to confirm if there's any doubt. Getting this wrong cascades into wrong clearing time, wrong symbol, wrong language, and a wrong activity ID.

## Activity type code table (insertBonusEvent, `presentType` field)
| presentType | Code |
|---|---|
| TREASURE_PICK (single-tier / 單層寶箱) | TP |
| TREASURE_PICK (3-tier / 三層寶箱) | 3TP |
| ROULETTE | RL |
| RAFFLE (戳戳樂) | RF |
| RAFFLE_MULTI (多重戳戳樂) | RM |
| MARIOSLOT | MS |
| SIGNUP (註冊) | SIG |
| AUTO_REDEEM (single-tier / 單層自爆) | AR |
| AUTO_REDEEM (3-tier / 三層自爆) | 3AR |
| DAILY_MISSION (簽到) | DM |
| GOLDEN_EGG | GE |
| JACKPOT | JP |
| REBATE | RB |
| INSTANT_CHALLENGE | IC |
| JACKPOT_INSTANT_PAY | JIP |

Provider prefix in an activity name (e.g. `*FC挑戰簽到遊戲：Star Hunter` or `*JILI三級單寶箱`) — the leading provider tag before the activity-type Chinese description is the `platform`/ID provider segment.

## Rank Record family (separate API — no bonusId, no presentType code table entry above)
These go to `insertRankRecordSetting`, NOT `insertBonusEvent`. Completely different field schema (see `references/api-rules.md`).

| Chinese label | presentType |
|---|---|
| LH / 龍虎榜 / 排行榜 | `RANK_RECORD` |
| 快贏 | `RACE_WIN` |

The number in a label like "LH2" is the `displayOrder` API field value, not part of any ID — this API has no ID field at all. "LH" itself is just Brian's internal shorthand for "this is a leaderboard-type activity," not something to write into any parameter.

## presentPrizeNum conventions by type
| Type | presentPrizeNum |
|---|---|
| TREASURE_PICK single-tier / 單寶箱 | 1 |
| TREASURE_PICK nine-box / 九寶箱 | 9 |
| RAFFLE (戳戳樂) | 8 |
| RAFFLE_MULTI (多重戳戳樂) | 24 |
| AUTO_REDEEM (single or 3-tier) | 0 |
| REBATE | 0 |
| INSTANT_CHALLENGE | 0 |
| DAILY_MISSION | 1 |
| ROULETTE | = number of bonus games in the game list |

## isInstantPay logic
Set `true` whenever the activity type is a "三級/三層" (3-tier) variant — 3AR (三級自爆), 3TP (三層寶箱), or any other 3-tier variant — regardless of whether it's structurally an "auto redeem" or a "treasure pick." This is what unlocks the `mini`/`major`/`mega` three-level `prizeDistribution` structure. Single-tier variants of the same base type are `false`.

For 3-tier `prizeDistribution.<mini|major|mega>.prizes`, when the activity is instant-pay style (auto-issued, no fixed total pool), set every prize count to `2147483647` (effectively unlimited) rather than trying to compute a total from daily-count × days — instant-pay tickets aren't capped by a pre-allocated pool, only by `turnoverPerTicket` and `maxTicketPerPlayer`.

## "Unlimited tickets" ≠ a fixed magic number
When a brief says "無限張(設定N張)" (unlimited, but capped at N for system purposes), use the actual N the user gives — don't default to a fixed placeholder like 9999 unless the user explicitly says to use that. If the user says "無限張" with no number at all, ask what cap to use rather than guessing.
