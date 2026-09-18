# Postman / API Field Rules

## Collection structure
File: `BonusEvent_Admin.postman_collection.json`

- **Collection variables**: `baseUrl` (default `https://testadmin.creditmps.com`) and `sessionCookie` (placeholder text only, e.g. `PASTE_YOUR_COOKIE_HERE` — never a real session value). Every request URL uses `{{baseUrl}}/admin/xxx`; every request has a `Cookie: {{sessionCookie}}` header. The user manages the real value via Postman's Cookie Manager (NOT the Headers tab — Postman silently strips manually-set `Cookie` headers on send, so real cookie values must go through Cookie Manager, while the collection JSON itself keeps the `{{sessionCookie}}` placeholder for documentation/consistency).
- **Permanent template items** — one per `presentType`/endpoint, kept forever as reference: Daily Mission (with Challenge), Roulette, Golden Egg, Rebate, Auto Redeem (Single-Tier), Auto Redeem (3-Tier), Instant Challenge, Treasure Pick (Single/Nine-box), Treasure Pick (3-Tier variants), Signup, Raffle, Rank Record - Insert, Race Win - Insert, Query Rank Record Setting. Add a new one only when the user supplies a HAR for a genuinely new type.
- `{{baseUrl}}` covers both the test host (`testadmin.creditmps.com`, the collection default) and production (`admin.creditmps.com`). Real submissions often happen on production — that's the user's choice via the collection variable. Never hardcode either host into a request.
- **Query endpoints are the best validation source.** `findAllRankRecordSetting` (POST, **empty body, no Content-Type header**) returns every stored rank-record setting. When a user shares a HAR that includes a query response, mine it for real-world field distributions before trusting any single template item — see "Validating defaults against production history" below.
- **`Latest Activity`** — single item, always overwritten (never duplicated) with whichever real activity the user most recently asked for. This is true even when consecutive activities are for different providers/currencies/types — each new ask replaces the previous one entirely.
- Endpoint `insertBonusEvent` uses **multipart/form-data**. Endpoint `insertRankRecordSetting` uses **application/x-www-form-urlencoded**. Don't mix the two.

## The 12:00 rule — all API date fields (settled; do not re-ask)

**Every date field in every request to this admin API uses hour `12` (12:00 GMT+8), for every currency and every `presentType`.** This is the server backend's time. It is NOT a market-local time and is NOT derived from the currency clearing-time table in `html-rules.md` — that table exists purely for player-facing HTML, banners, and announcements.

Applies to `startDate`, `endDate`, `bannerStartTime`, `drawFinishDate` on `insertBonusEvent`, and to `startTime` / `displayTime` on `insertRankRecordSetting`. Evidence: all 15 stored template items across PHP/MMK/VND/USD/MYR carry hour `12`, and 114 production RACE_WIN records do the same. Brian has confirmed this directly and has been asked more than once — **do not raise it again as a discrepancy to confirm.**

One legitimate exception exists and it is computed, never chosen: `redeemDeadlineDate` takes whatever hour falls out of its own formula (e.g. INSTANT_CHALLENGE's `endDate + challengeExpireHours` → `2026-10-01 00`). An hour other than `12` on that one field is expected.

A brief for an MMK activity that says "12pm" is correct as written. The 10:30 that belongs to MMK shows up only in the Burmese copy the player reads.

## updateTime / createTime
Always fetch the real current GMT+8 timestamp with actual milliseconds immediately before building the item:
```bash
TZ='Asia/Shanghai' date "+%Y-%m-%d %H:%M:%S.%3N"
```
Never hardcode `.000` milliseconds or a stale/arbitrary date.

**Only `insertBonusEvent` has these fields.** `insertRankRecordSetting` (RANK_RECORD / RACE_WIN) has **no** `updateTime` or `createTime` parameter — the server generates both. Don't add them, and don't run the date command for these two types. Server-generated fields that appear in query responses but must never be posted: `id`, `createTime`, `updateTime`, `nextRewardTime` (start + 1 day), `rankRecordHouseArray`, `rewardProgress`, and `latestSuccessSyncTime` (server sets it equal to `startTime`).

## Challenge-type activities
When `isAllowChallenge=true`:
- `requiredGames` is set EMPTY per platform, e.g. `{"JDB":[""]}` — do not list actual game IDs there.
- The actual game list goes in `challengeGames`, e.g. `{"JDB":["7003","14098","14100"]}`.
- This applies uniformly whenever `isAllowChallenge=true`, regardless of `presentType` (Daily Mission with challenge, Signup with challenge, etc.)

When a plain activity is NOT challenge-based (Roulette, Raffle, Treasure Pick, Auto Redeem, Golden Egg, etc.), the real game list goes in `requiredGames` instead, keyed by platform.

## isInstantPay
See `activity-codes.md` — driven purely by "3-tier/三級/三層" status, independent of whether the type is auto-redeem, treasure-pick, etc.

## Medal / Rank Reward settings (可以出現在任何活動類型)
Applies independent of `presentType` — Golden Egg, Treasure Pick, Roulette, etc. can all carry medal rewards:
- `isAllowRankReward`: `true`
- `rankRewardSetting`: JSON object that can contain a `"daily"` key, a `"weekly"` key, or both — each a comma-separated string of reward values (not a JSON array).
  ```json
  {"daily":"60,60,60,60,400,400,400,400,1000,1000","weekly":"300,300,300,300,300,800,800,800,1500,1500"}
  ```
- Reward value = base ticket unit (commonly 100) × multiplier stated in the brief. E.g. base 100: "60%" → 60, "3X" → 300, "4X" → 400, "5X" → 500, "8X" → 800, "10X" → 1000, "15X" → 1500.
- The count of values in the comma list = the count given (e.g. "日 50%×4, 3X×3, 5X×2" → 4 fives of 50, then 3 of 300, then 2 of 500 = 9 comma-separated values total).

## Brief lines that map to NO API field — don't hunt for one, don't ask

- **「可設定為公開」 / 「僅某某站台(m9 / inf / m7spin / agd88 等)會被打開」** — this is announcement copy describing which sites will publicise the event. It is not an API setting. `accessLevel` stays `public` (15/15 template items) and no site/agent list is posted. Confirmed by Brian; do not raise it as an open question again.
- **`c: 26W` cost notes** — see `activity-codes.md`. Compute the real figure and compare, but don't look for a field.

## Skin-specific required params
| presentType | Required field | Known values |
|---|---|---|
| GOLDEN_EGG | `skinName` | `"egg"` (only known value so far — ask/update this table if a new skin value shows up) |

## presentType-specific prizeDistribution shapes

### TREASURE_PICK / RAFFLE (single-tier, pool-based)
`prizeDistribution.prizes.<amount>` = (daily ticket count for that amount) × (total activity days). This is a fixed pool, not instant-pay-unlimited.

### AUTO_REDEEM / TREASURE_PICK 3-tier (instant-pay style)
`prizeDistribution` has `mini`/`major`/`mega` keys, each with:
```json
{
  "probability": {"<amount>": <pct>, ...},
  "adjust": {"min": -50, "max": 50},
  "prizes": {"<amount>": 2147483647, ...},
  "turnoverPerTicket": <tier turnover threshold>,
  "maxTicketPerPlayer": <tier daily/total cap>
}
```
`adjust.min`/`adjust.max` encode a "+/- X%" randomization note from the brief (e.g. "+/-50%" → `{"min": -50, "max": 50}`).
`prizes` values are `2147483647` (effectively unlimited) for instant-pay types — see activity-codes.md.

### REBATE
```json
{"minRebateTurnover": <threshold>, "prizes": {}, "rebateRatio": <decimal, e.g. 0.002 for 0.2%>}
```
No ticket concept — `presentPrizeNum: 0`, `maxTicketPerPlayer: 0`.

### INSTANT_CHALLENGE
```json
{
  "challengePrize": <base ticket amount>,
  "maxChallengePrizeInOneDay": <per-player DAILY prize cap>,
  "challengingGameCount": <e.g. 3 for "8挑3">,
  "maxTicketCountInOneDay": <per-player DAILY ticket count cap>,
  "calculatedGameType": "FH,SLOT,ARCADE,RNGTABLE",
  "prizes": {},
  "winlossCalculatedRate": <decimal, rebate rate on losses>,
  "calculatedPlatform": <provider's real platform code, e.g. "POCKET" for PG>,
  "turnoverCalculatedRate": <decimal, rebate rate on win turnover>
}
```
- **`prizes: {}` is always present and always empty** — INSTANT_CHALLENGE has no prize pool. Don't drop the key.
- **Every cap on this type is a DAILY cap** (confirmed by Brian). A brief saying "每人上限4萬, 上限張數2張" with no 每日 wording still means 4萬/day and 2張/day. Never read either as a whole-activity total, and don't ask.
- `challengePrize` is the *base* ticket value; the actual ticket is computed from the loss rebate, so it can exceed the base. That's why `maxChallengePrizeInOneDay` can sit well above `challengePrize × maxTicketCountInOneDay` without being an error — don't flag the gap.
- The brief's 「綁定流水 N 倍」 is **not** in `prizeDistribution` — it's the top-level `turnoverMultiplier`. Likewise 「票券 N 小時過期」 is top-level `challengeExpireHours`.

#### calculatedGameType — the complete code set
`LIVEARENA`, `LIVE`, `SPORTS`, `LOTTERY`, `FH`, `SLOT`, `ARCADE`, `RNGTABLE`

Comma-separated, no spaces. `FH` = fish/捕魚 — a brief writing "FISH" means `FH`. Use only codes from this list; if a brief names a category not on it, ask rather than inventing a code.

#### INSTANT_CHALLENGE top-level fields that differ from other types
| Field | Value |
|---|---|
| `isAllowChallenge` / `isForcingChallenge` / `isChallengeFailNoBonus` | all `true` |
| `turnoverMultiplier` | the brief's 綁定流水倍數 (other types leave this at `1`) |
| `challengeExpireHours` | the brief's 票券過期小時 (other types leave this at `1`) |
| `requiredGames` | `{"<PLATFORM>":[]}` — empty array. Note the Daily Mission template uses `[""]` instead; both forms are accepted, so match the template for the type you're building |
| `challengeGames` | `{"<PLATFORM>":["id","id",...]}` — the real 8挑3 game list |
| `presentPrizeNum`, `maxTicketPerPlayer` | `0` |
| `grandPrize`, `turnoverPerTicket`, `bonusMultiplier` | `1` |
| `isInstantPay` | `false` |
| `dailyMissionSetting`, `miniGamePrizeDistribution` | `{}` |

#### INSTANT_CHALLENGE date relationships
- `bannerStartTime` = `startDate`
- `drawFinishDate` = `startDate` **minus 1 day**, hour 12 (14/15 template items follow this; the Instant Challenge template's own value is an edit artifact — its `drawFinishDate` equals its `updateTime` date, so ignore that one)
- `redeemDeadlineDate` = `endDate` **plus `challengeExpireHours`** — the only field allowed an hour other than 12. A brief's 「(+N hours)」 / 「打流水結束」 note is stating exactly this, and it should reconcile to the same value; if it doesn't, say so.

### DAILY_MISSION

**The turnover ladder does not have to ascend.** Brian confirmed a `500 → 700 → 900 → 800` sequence is intentional, with the reward staying at 5 across the last two steps. Never flag a mid-ladder drop as a suspected typo, and never "fix" the ordering — transcribe the amounts exactly as the brief lists them, in brief order.

**`dailySchedule` length must equal the activity's day count.** Verified across the stored 21-day template and two 14-day builds. If a brief's ladder is shorter than the span (e.g. 14 steps for a 28-day activity), that is a genuine gap — ask which it is (ladder repeats / rest not yet supplied / dates wrong) rather than repeating the cycle or padding.

```json
{
  "missionSetting": {
    "1": {"action": "CHECK_IN", "atLeast": "1"},
    "2": {"action": "TURNOVER_REQUIRE_CHALLENGE", "atLeast": "<turnover amount>"},
    ...one entry per distinct turnover tier seen across the daily list...
  },
  "dailySchedule": [
    {"missionDate": "YYYY-MM-DD", "reward": "<reward amount>", "missions": ["1", "<tier id>"]},
    ...one entry per day of the activity...
  ],
  "isActiveCumulativeSetting": false
}
```
Every day's mission list includes `"1"` (check-in) plus whichever turnover-tier mission ID matches that day's requirement. Group consecutive days with identical turnover requirements under the same tier ID rather than creating a new tier per day.

## Field ↔ brief cross-checks to always run before finalizing
- Daily ticket counts × activity days == the "total" number the brief states (e.g. "300張(4.2K張)" for a 14-day activity → 300×14=4200 ✓)
- Number of games in `requiredGames`/`challengeGames` == number of games listed in the brief
- `presentPrizeNum` matches the type-specific convention (see activity-codes.md) unless the brief explicitly overrides it
- Activity day count recomputed independently, not just copied from the user's bracketed note

---

# RACE_WIN (快贏) — full field spec

Endpoint `insertRankRecordSetting`, `application/x-www-form-urlencoded`. No `bonusId`, no activity ID, no `updateTime`/`createTime`. Verified against 114 production RACE_WIN records.

## Fields carrying real values
| Field | Value | Notes |
|---|---|---|
| `presentType` | `RACE_WIN` | |
| `currency` / `walletCurrency` | market currency | both always the same value |
| `allowPlatform` | provider's **API** platform value | see activity-codes.md provider table — ID abbreviation ≠ API value for several providers |
| `startTime` | `YYYY-MM-DD HH:mm:ss` | activity start. **12:00 GMT+8 regardless of currency** — see "The 12:00 rule" above; this is the universal API convention, not a RACE_WIN quirk. Verified: MMK 29/31, PHP 53/55, USD 20/22, VND 6/6, BDT 1/1 |
| `rankDays` | whole days between start and end | recompute independently from the two timestamps |
| `displayTime` | activity **END** time | i.e. `startTime` + `rankDays`. This is NOT a "start showing" time despite the name — verify it equals the brief's end datetime |
| `displayOrder` | number in the activity label | `RACE2` → `2`, `LH2` → `2` (confirmed in production) |
| `beforeStartDisplayTime` | hours the event shows **before** start | from "設定 N 小時前露出". **Default 12** — 73/114 records, and confirmed by Brian after he corrected a record that had been submitted with 0 |
| `afterStartDisplayTime` | hours the event keeps showing **after** end | from "獎項領取後 N 小時後結束顯示". **Default 12** — 85/114 records, same confirmation |
| `rewardSetting` | JSON string, see below | |
| `tipText` | the promo block Brian supplies, **verbatim including its leading HTML comment** | Markers vary by language and are not interchangeable: `<!-- eventTipEN -->` for English copy (40 records), `<!-- 說明 -->` for localized copy such as Burmese/Vietnamese (22 records), and 45 records have no comment at all. Use exactly the marker Brian pastes; never substitute `eventTipEN` onto a non-English block. Body language still follows the currency (html-rules.md): MMK → Burmese, VND → Vietnamese, PHP → English |

## Fields that are always fixed / always empty for RACE_WIN
| Field | Value | Evidence |
|---|---|---|
| `allowGameType` | **EMPTY** | 109/114 null. The race is already pinned to one `gameId` inside `rewardSetting`, so the game-type filter is redundant. Do NOT fill in `SLOT,ARCADE` — that value belongs to RANK_RECORD, and the 2 RACE_WIN records carrying it are outliers |
| `weeklyOrderType` | `0` | 113/114, and confirmed by Brian after he corrected a record submitted with 1. Non-zero values are a RANK_RECORD concept (leaderboard sort), meaningless for a race |
| `monthlyOrderType` | `0` | 114/114 |
| `rankType` | `0` | 112/114 |
| `isOnlyWeek` | `0` | 114/114 |
| `amountLimit`, `winRateLimit`, `dailyRankLimit`, `weeklyRankLimit`, `monthlyRankLimit`, `reserveRanking` | empty | RACE_WIN has no ranking list, so no rank/qualification limits |
| `latestSuccessSyncTime`, `freeSpinExpiredTime`, `challengeLimitHour`, `turnoverMultiplier`, `challengeGames` | empty | 114/114 |
| `syncUserIds` | empty | 87/114 empty; only fill when the brief explicitly names a house/agent code |

### displayOrder mirrors the internal LH number
Brian's internal label carries it: `202608-LH4` → `displayOrder: 4`, `PHLH1` → `displayOrder: 1`. Take the digit from the label rather than asking.

## rewardSetting shape
```json
{"1":{"id":1,"name":"<prize amount>","quotas":<次數>,"target":<最快贏取金額>,"gameId":"<game ID>","nextQuotasInHours":"<週期小時>"},
 "2":{...}, "3":{...}}
```
- Object key = tier number as a string, and must equal that tier's `id`.
- `name` = the payout, as a **string**. `target` = the win amount that must be hit, as a **number**.
- `quotas` = 次數 (how many winners that tier pays out in total).
- `nextQuotasInHours` = 每個週期 N 小時, as a **string**. **Optional** — absent in 45/440 historical tiers. Include it whenever the brief states a 週期; omit the key entirely when it doesn't.
- `gameId` = the single game from the brief. **All tiers share the same `gameId`** — 114/114 records; a race is always on one game. If a brief lists more than one game, stop and ask.
- **A `gameId` belongs to exactly one platform.** The server rejects any mismatch, so `allowPlatform` and `gameId` must come from the same provider. When a brief's provider tag and its promo copy disagree about the provider (e.g. a brief labelled 快贏 for one provider carrying another provider's name in the `tipText`), the game ID is the reliable half — resolve the provider to whoever owns that game ID, don't change the game ID to fit a provider name. Known ownership from production RACE_WIN records:

  | Platform | gameIds seen |
  |---|---|
  | JILI | 49, 103, 109, 145, 223, 238, 240, 259, 523, 696, 720 |
  | JDB | 14065, 14093, 14098 (Fruity Bonanza Combo), 14100, 14104 |
  | YB | 1048, 1051, 1068 (Calavera Fiesta) |
  | POCKET (PG) | 108, 135, 1473388, 1492288 |
  | FACHAI | 22043, 22056, 22069, 22071 |
  | BNG | 259, 286 |
  | HACKSAW | 201079, 201119, 201204 |
  | ACEWIN | 1021 |
  | VERTEXPLAY | VP_230028_1 |

  Note `259` appears under both JILI and BNG, so ID ranges are a hint, not proof — when the brief's provider and game ID both look plausible, trust the brief's provider tag and let the server validate.
- Tier count = however many the brief lists. 3 is the norm (95/114) but 4, 5, 6 and 10 tiers all occur — never force it to 3.

## Cross-checks before finalizing a RACE_WIN request
- Each tier's `target`/`name` pair matches the corresponding line in `tipText` (e.g. `target: 1000000` ↔ "The 1st 1M winner can get 30,000").
- `startTime` + `rankDays` == `displayTime` == the brief's end datetime.
- Time-of-day on `startTime`/`displayTime` == 12:00 (NOT the currency clearing time — see the `startTime` row above).
- Tier count in `rewardSetting` == tier count in the brief == line count in `tipText`.
- The brief's cost note (`c: 26W` style) maps to **no API field**. Compute Σ(`name` × `quotas`) and compare; if it disagrees with the stated cost, flag it rather than adjusting any field to force a match.

## probability and prizes are INDEPENDENT — never cross-check them

`probability` sets the draw odds; `prizes` sets each amount's stock cap. They are separate controls and **do not have to be proportional to each other.** Two amounts with the same stock but different odds (e.g. both `150張`, one at 20% and one at 15%) is perfectly valid — the higher-odds one simply exhausts its stock sooner. An earlier pass through this skill wrongly called that a contradiction; it is not.

The only hard requirement is that `probability` values sum to **100**.

**The brief's 每張價值 / per-ticket value is Brian's own cost estimate, not an API field.** It usually equals the probability-weighted expected value, so it is a useful sanity signal — but when it doesn't match, say so in one line and carry on building. It is never a blocker and never a reason to withhold the request. (Example: the JILI MYR nine-box brief stated 2.87 while the stated probabilities give 3.15; Brian confirmed the probabilities as written are what matters.)

## presentPrizeNum is per type — and RAFFLE enforces it server-side

`insertBonusEvent` rejects a RAFFLE whose `presentPrizeNum` differs from the number of entries in `prizeDistribution.probability`:

```
{"error": "RAFFLE: Present Prize Num should be equal to Prize Distribution count:9"}
```

So for RAFFLE it is **the prize count, not the game count**. An earlier build set it to the game count and was rejected.

| presentType | presentPrizeNum | Template evidence |
|---|---|---|
| RAFFLE | **8** — the physical number of poke holes, and `prizeDistribution` must hold exactly that many prizes (Brian-confirmed) | 8 prizes / 8 |
| RAFFLE_MULTI | **24** — same rule, 24 holes (Brian-confirmed) | — |
| TREASURE_PICK single-tier | **prize count** | 9 prizes / 6 games / 9 |
| ROULETTE | **prize count** — a wheel's segments *are* its prizes, so 9 prizes means 9 segments | 8 / 8 / 8 |

### Zero-probability prizes: keep or drop depends on the type
Briefs routinely list a headline amount at `0張 / 0%` (e.g. `金額：100 0張 0%`). Whether it belongs in `prizeDistribution` is type-specific:

- **RAFFLE / RAFFLE_MULTI — drop it.** The hole count is fixed at 8 / 24, and the server checks `presentPrizeNum` against the prize count, so a 9th zero-probability entry breaks the activity. The stored Raffle template has no zero entries at all.
- **TREASURE_PICK single-tier — keep it.** Its template carries `777` at 0% inside the 9 prizes and `presentPrizeNum` counts it.
- **ROULETTE — keep it.** The wheel segments are the prizes, so a 0% headline amount is a visible segment nobody lands on. 9 prizes means 9 segments.

The distinction is what the number counts. RAFFLE/RAFFLE_MULTI have a **fixed board** (8 or 24 holes) that the prize list has to fit; ROULETTE and TREASURE_PICK have a **variable board built from the prize list**. Never carry the rule from one group to the other — an earlier build dropped to the game count on a Roulette and set `presentPrizeNum` 8 against 9 prizes, which is wrong.

Dropping a 0% entry never disturbs the probability sum, so re-check that it still totals 100 and move on. Remove the amount from `prizeDisplayOrder` too.
| GOLDEN_EGG | `3` — neither prize (9) nor game (8) count; likely the egg count | 3 |
| AUTO_REDEEM, REBATE, INSTANT_CHALLENGE | `0` | — |
| DAILY_MISSION, TREASURE_PICK 3-tier, SIGNUP | `1` | — |

⚠️ **Never infer this field from a template whose prize count and game count happen to be equal.** Raffle and Roulette both have 8/8/8 and are useless as evidence on their own. Cross-check against a template where the two differ — Treasure Pick single-tier (9 prizes vs 6 games) is the one that settles it.

## "無限張" has no sentinel value — pick the same-type template's number

A brief saying a tier is 無限張 / unlimited does **not** map to a magic constant. The stored templates disagree:

| Template | mega `maxTicketPerPlayer` |
|---|---|
| Auto Redeem 3-tier (VND) | `100` |
| Treasure Pick 3-tier Instant Pay (MMK) | `1000` |
| Treasure Pick 3-tier + Medal (PHP) | `9999` |

`maxTicketPerPlayer` at tier level is a **daily** cap (the SVCASINO build's 每人每天1張 tiers use `1`). "Unlimited" just needs a number the tier's turnover threshold makes unreachable — at 30,000 per ticket, `100` already means 3,000,000 turnover in a day.

Rule: use the value from the **same activity type's** template, and say which number you used in one line so Brian can raise it. When the brief gives an explicit count instead (e.g. 設定2000張), use that number directly.

The HTML always reads "Players can receive unlimited tickets" regardless of the number — that line is not derived from this field.

## rankType 3 (週累計贏額) — field conventions

Mirror image of rankType 0. Evidence is 35 stored records from `findAllRankRecordSetting`; **no verified successful insert exists for this type yet** — unlike rankType 0, where Brian's LH4 submission confirms the send format. Treat the empty-vs-`0` encoding below as inferred by symmetry and ask Brian for a HAR after the first weekly submission succeeds.

| Field | rankType 3 | rankType 0 | Evidence |
|---|---|---|---|
| `weeklyRankLimit` | the ranking count | send empty | 15/35 use 5, 8/35 use 6 |
| `dailyRankLimit` | send empty (stored as `0`) | the ranking count | 28/35 stored as 0 |
| `monthlyRankLimit` | send empty (stored as `0`) | send empty | 35/35 stored as 0 |
| `weeklyOrderType` | `1` | `0` | 27/35 vs 131/140 |
| `isOnlyWeek` | `1` (true) | `0` (false) | 27/35 vs 134/140 |
| `allowGameType` | `SLOT,ARCADE,FH,RNGTABLE` | `SLOT,ARCADE` | 27/35 vs 121/140 — the two types differ, don't copy across |
| `rankDays` | 14 is the norm | varies | 28/35 |
| `reserveRanking` | `2` | `2` | 24/35 |

`rewardSetting` puts the prizes under `weekly` and sends `[{"name":"0","quotas":0}]` placeholders for `daily` and `monthly` — the inverse of a daily board.

### The rule sentence in tipText identifies the type
Each stored record's own `tipText` `number_2` line states its ranking rule, and the four types separate cleanly with no overlap. This is what the rankType decode was derived from:

| rankType | Rule sentence keyword | Sample count |
|---|---|---|
| 0 | **Single** Winning amount / single bet | 19+18+9 |
| 1 | Winning **Ratio** / win rate | — |
| 2 | **Daily Wager** | — |
| 3 | **Weekly Total Winning** amount | 11+4+3 |

When a brief's mode wording is ambiguous, match it against this table rather than guessing from the field values.

## rankRewardSetting (勛章) — values are PERCENTAGES

Used by `insertBonusEvent` types that carry medals (TREASURE_PICK 3-tier, GOLDEN_EGG). Not to be confused with RANK_RECORD's `rewardSetting`, which holds absolute amounts.

Comma-separated string of exactly 10 values per period, ranked positions 1–10. **The numbers are percentages, not currency amounts**: `50` = 50%, `300` = 3X, `600` = 6X, `1200` = 12X. Confirmed by Brian.

```
{"daily":"50,50,50,50,50,300,300,300,600,600","weekly":"300,300,300,300,300,600,600,600,1200,1200"}
```

A brief written as 「日勛章 50%*5, 3X*3, 6X*2」 maps position by position: 5 entries of `50`, then 3 of `300`, then 2 of `600`. Multiply any `NX` by 100; drop the `%` sign from a percentage. The 5/3/2 grouping matches the stored template (`50,50,50,50,50,300,300,300,500,500` = 50%×5, 3X×3, 5X×2).

Set `isAllowRankReward: true` whenever this field is populated; types without medals leave it `false` and the field empty. Medal payouts render from this field automatically — **no medal line goes in the HTML.**

# RANK_RECORD (龍虎榜/排行榜) — full field spec

Same endpoint and encoding as RACE_WIN: `POST /admin/insertRankRecordSetting`, `application/x-www-form-urlencoded`, 29 fields, **no `updateTime`/`createTime`** (server-generated). There is no `bonusId` on this endpoint — leaderboards are not given an activity ID like `insertBonusEvent` types are.

## rankType decodes the leaderboard variant — this is the field that matters

Derived from 354 production records pulled from `findAllRankRecordSetting`:

| `rankType` | Variant | Chinese | Threshold field | Records |
|---|---|---|---|---|
| **0** | Single Winning amount | **單筆贏額** | `amountLimit` | 253 |
| **1** | Winning Ratio / win rate | **單筆倍數** | `winRateLimit` | 20 |
| **2** | Daily Wager / turnover | **日流水** | `amountLimit` | 46 |
| **3** | Weekly Total Winning amount | **週累計贏額** | `amountLimit` | 35 |

The threshold split is clean and exclusive — among RANK_RECORD rows: rankType 0 has `amountLimit` set in 139/140 and `winRateLimit` set in 0; rankType 1 is the exact inverse (0 and 18/18); rankTypes 2 and 3 are 46/46 and 35/35 on `amountLimit`. **Set exactly one threshold field and leave the other empty.** Decoded from the `number_2` rule sentence in each record's own `tipText`, so the mapping is the platform's own wording, not an inference.

Note `rankType` is a RANK_RECORD concept. RACE_WIN rows also carry `rankType: 0`, but with `amountLimit: 0` — for RACE_WIN it is filler, not a variant selector.

## rankType 0 (單筆贏額) — field conventions

| Field | Value | Evidence (of 140 rankType-0 RANK_RECORD rows) |
|---|---|---|
| `rankType` | `0` | |
| `amountLimit` | the single-bet win threshold from the brief | 139/140 populated |
| `winRateLimit` | **empty** | 0/140 populated |
| `allowGameType` | `SLOT,ARCADE` | 121/140; `SLOT` alone in 19. Unlike RACE_WIN, this **is** filled for RANK_RECORD |
| `dailyRankLimit` | how many ranks the board shows | varies with the brief (10/7/5/9 common) |
| `weeklyRankLimit` / `monthlyRankLimit` | **send empty** on insert | The `0` seen in `findAllRankRecordSetting` output is the server's default *after* it stores an empty value — do not copy it back into a request. Two verified-successful production inserts (LH4 BNG, LH1 JDB) both sent these empty. Same for `winRateLimit` on a rankType-0 board, and for `challengeLimitHour` / `turnoverMultiplier` / `challengeGames` / `syncUserIds` / `latestSuccessSyncTime`. |
| `weeklyOrderType` / `monthlyOrderType` | `0` | 131/140 and 139/140 |
| `isOnlyWeek` | `0` | 134/140 |
| `reserveRanking` | from the brief; `2` is most common | 2 (51), 0 (39), 3 (31) |
| `challengeLimitHour`, `turnoverMultiplier`, `challengeGames`, `syncUserIds`, `latestSuccessSyncTime` | empty | |

`amountLimit` reference values by market, for sanity-checking a brief — not for filling in blind: PHP 2,000 / 10,000 / 5,000 · MMK 50,000 / 500,000 · VND 500 · USD 1 / 10.

## Date fields

- `startTime` — 12:00 GMT+8, per the 12:00 rule (131/138 land on 04:00 UTC = 12:00 GMT+8)
- **`displayTime` = `startTime` + `rankDays`** — 128/138 confirm; treat a mismatch as an error to query
- **`freeSpinExpiredTime` = `displayTime`** — 132/140
- `beforeStartDisplayTime` / `afterStartDisplayTime` — `0` for RANK_RECORD (RACE_WIN uses 12)

### displayOrder mirrors the internal LH number
Brian's internal label carries it: `202608-LH4` → `displayOrder: 4`, `PHLH1` → `displayOrder: 1`. Take the digit from the label rather than asking.

## rewardSetting shape

```json
{"daily":[{"name":"12000","quotas":1},{"name":"5000","quotas":1},{"name":"1500","quotas":1},
          {"name":"1000","quotas":1},{"name":"500","quotas":1}],
 "weekly":[{"name":"0","quotas":0}],
 "monthly":[{"name":"0","quotas":0}]}
```

`name` is the prize amount as a **string**, `quotas` the number of winners at that rank. Array order is rank order, 1st place first. **Unused periods are not omitted** — send a single placeholder `[{"name":"0","quotas":0}]` for `weekly`/`monthly` when the board is daily-only.

## Cross-checks before finalizing a RANK_RECORD request

Run all of these. Two of them caught real errors in a production submission (`202608-LH4`, BNG PHP, submitted live with both wrong):

1. **`tipText` prize list must match `rewardSetting` rank-for-rank.** The live BNG record pays 12,000 / 5,000 / 1,500 / 1,000 / 500 but its copy advertises 12,000 / 5,000 / 2,000 / 1,500 / 500 — an extra tier inserted at 3rd place shifted everything below it, and the advertised total (21,000) exceeds what is actually paid (20,000).
2. **The date range in `tipText` must equal `startTime` ~ `startTime + rankDays`.** That same record starts 26 Aug with `rankDays: 14`, so it ends 9 **September** — the copy says "9th August". Also check both dates carry the year.
3. `dailyRankLimit` must equal the number of `rewardSetting.daily` entries (accounting for `quotas` > 1 spanning a range like "3rd~5th").
4. Exactly one of `amountLimit` / `winRateLimit` is set, matching `rankType`.
5. `displayTime` and `freeSpinExpiredTime` both equal `startTime + rankDays`.

# Validating defaults against production history

A single template item in the collection is one data point and can carry an outlier value — the Race Win template's `allowGameType: SLOT,ARCADE` was copied from a 2-in-114 exception and propagated into a generated request. When a HAR containing a `findAll*` response is available:

1. Parse the response array, filter by `presentType`.
2. Build a value distribution per field (`collections.Counter`).
3. Sort by `createTime` and look at the ~12 most recent records — recent convention beats all-time counts when they disagree.
4. Prefer the dominant/recent value over the template's value, and record the finding in this file.

## Reconciling a user's own submission HAR
When the user submits an activity by hand and shares the HAR to compare against generated output, diff every field and sort the deltas into three buckets:
- **Generated output wrong** → fix it and write the rule here.
- **User's submission disagrees with the brief AND with historical convention** → this is a probable data-entry slip in a live record. Flag it plainly with the evidence (brief line + history counts) and ask; do NOT silently adopt it as the new rule, and do NOT silently "correct" their live record either.
- **Both defensible** → ask which they want as the standing convention.

A successful `{"status":"200","message":"success"}` response only means the payload was well-formed. It is not evidence that every value was intended.

# Reading the response: HTTP 200 does not mean accepted

`insertRankRecordSetting` returns **HTTP 200 for rejections too**, signalling failure only in the body:
```json
{"status":"200","message":"success"}          // accepted, record created
{"error":"GameId not found: 1068,platform: JILI"}   // REJECTED, nothing created
```
Always read the body and check for an `error` key before reporting a submission as done — a HAR entry showing status 200 proves nothing on its own. Observed rejection: `GameId not found: <gameId>,platform: <PLATFORM>` means the game ID does not belong to that platform. Fix the **platform**, not the game ID (see the gameId ownership rule above).

When a HAR contains both an insert and a following `findAll*`, reconcile them: confirm the new record actually exists in the query response, check its stored values, and check whether earlier records were deleted. A record ID present in an older HAR but missing from a newer one means it was removed — say so rather than assuming the earlier submission is still live.

# updateRankRecordSetting — correcting an existing RANK_RECORD / RACE_WIN

An already-created record can be edited in place. Endpoint `updateRankRecordSetting`, `application/x-www-form-urlencoded`, and the response is the bare string `1` — not JSON, so don't try to parse it as `{"status":...}`.

## It takes 25 fields, and the differences from insert matter
- **Adds** `id` — the record's ID from a `findAll*` response. Required.
- **Drops** `startTime`, `weeklyOrderType`, `monthlyOrderType`, `isOnlyWeek`, `walletCurrency`. **These five cannot be changed by an update.** A record submitted with the wrong `weeklyOrderType` must be deleted and re-inserted — observed in production: an update fixed `beforeStartDisplayTime`/`afterStartDisplayTime` from 0 to 12 but left `weeklyOrderType` at 1, and the record was then deleted and re-created to fix it.
- Empty-value encoding differs from insert: numeric fields go as `0` (`amountLimit`, `dailyRankLimit`, `weeklyRankLimit`, `monthlyRankLimit`, `reserveRanking`, `challengeLimitHour`, `turnoverMultiplier`, `rankType`), while `winRateLimit` and `freeSpinExpiredTime` go as a literal `-` (hyphen), not an empty string.
- `latestSuccessSyncTime` is echoed back with the record's `startTime` value rather than left empty.

## Field list
`id`, `currency`, `syncUserIds`, `allowPlatform`, `allowGameType`, `amountLimit`, `winRateLimit`, `dailyRankLimit`, `weeklyRankLimit`, `monthlyRankLimit`, `reserveRanking`, `latestSuccessSyncTime`, `beforeStartDisplayTime`, `afterStartDisplayTime`, `freeSpinExpiredTime`, `displayTime`, `displayOrder`, `challengeLimitHour`, `turnoverMultiplier`, `challengeGames`, `rewardSetting`, `tipText`, `rankType`, `rankDays`, `presentType`

## Choosing update vs. delete-and-reinsert
| What's wrong | Action |
|---|---|
| `beforeStartDisplayTime` / `afterStartDisplayTime`, prize table, tipText, `displayTime`, `displayOrder`, `rankDays`, platform, game | `updateRankRecordSetting` |
| `startTime`, `weeklyOrderType`, `monthlyOrderType`, `isOnlyWeek`, `walletCurrency` | delete + `insertRankRecordSetting` again (the record ID will change) |

Before proposing either, get the record `id` from a `findAll*` response — never guess it, and never assume an ID from an older HAR is still live.
