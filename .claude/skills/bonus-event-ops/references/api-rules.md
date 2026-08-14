# Postman / API Field Rules

## Collection structure
File: `BonusEvent_Admin.postman_collection.json`

- **Collection variables**: `baseUrl` (default `https://testadmin.creditmps.com`) and `sessionCookie` (placeholder text only, e.g. `PASTE_YOUR_COOKIE_HERE` — never a real session value). Every request URL uses `{{baseUrl}}/admin/xxx`; every request has a `Cookie: {{sessionCookie}}` header. The user manages the real value via Postman's Cookie Manager (NOT the Headers tab — Postman silently strips manually-set `Cookie` headers on send, so real cookie values must go through Cookie Manager, while the collection JSON itself keeps the `{{sessionCookie}}` placeholder for documentation/consistency).
- **Permanent template items** — one per `presentType`/endpoint, kept forever as reference: Daily Mission (with Challenge), Roulette, Golden Egg, Rebate, Auto Redeem (Single-Tier), Auto Redeem (3-Tier), Instant Challenge, Treasure Pick (Single/Nine-box), Treasure Pick (3-Tier variants), Signup, Raffle, Rank Record - Insert, Race Win - Insert. Add a new one only when the user supplies a HAR for a genuinely new type.
- **`Latest Activity`** — single item, always overwritten (never duplicated) with whichever real activity the user most recently asked for. This is true even when consecutive activities are for different providers/currencies/types — each new ask replaces the previous one entirely.
- Endpoint `insertBonusEvent` uses **multipart/form-data**. Endpoint `insertRankRecordSetting` uses **application/x-www-form-urlencoded**. Don't mix the two.

## updateTime / createTime
Always fetch the real current GMT+8 timestamp with actual milliseconds immediately before building the item:
```bash
TZ='Asia/Shanghai' date "+%Y-%m-%d %H:%M:%S.%3N"
```
Never hardcode `.000` milliseconds or a stale/arbitrary date.

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
  "challengingGameCount": <e.g. 3 for "8選3">,
  "maxTicketCountInOneDay": <per-player daily cap>,
  "maxChallengePrizeInOneDay": <daily total cap>,
  "winlossCalculatedRate": <decimal, rebate rate on losses>,
  "turnoverCalculatedRate": <decimal, rebate rate on win turnover>,
  "calculatedPlatform": <provider's real platform code, e.g. "POCKET" for PG>,
  "calculatedGameType": "FH,SLOT,ARCADE,RNGTABLE" (or similar — game categories counted)
}
```

### DAILY_MISSION
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
