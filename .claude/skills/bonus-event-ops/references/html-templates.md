# HTML Skeleton Templates (per activity type)

## Coverage status — do NOT ask Brian to re-supply copy that is already here

All 11 activity types below have a complete, parameterised English skeleton. **Never ask Brian for promo copy for a type listed here** — every placeholder is computable from the API brief he already gave (game count, turnover multiplier, expiry hours, deadline, currency symbol, clearing time). Asking again is the failure mode this file exists to prevent.

## Localization: use stored approved copy first, translate only as fallback

Priority order — do not skip step 1:
1. **If this file holds approved market-language copy for the activity type being built, use it.** Substitute only the activity-specific bits (game scope, counts, dates, amounts). Approved copy reads naturally; machine translation does not, and Brian notices.
2. **Only if no approved copy exists for that type**, translate the English skeleton directly using standard gambling terminology.

Never ask Brian to supply localized copy — but when he volunteers it, **store it here verbatim under its activity type** so step 1 works next time. An earlier version of this file said only "translate directly, never ask", which caused Claude to machine-translate a 3-tier Auto Redeem body even though approved Burmese wording existed. That was wrong.

**Wording is per activity type, not global.** Brian's Instant Challenge copy and his Auto Redeem 3-tier copy differ on the same concepts — IC uses `တက်ကတ်` for ticket and translates "Menu / Member Info" into Burmese, while 3AR uses `တိကက်`/`လက်မှတ်` and leaves "Menu / Member Info" in English. Both are correct for their own type. Match the type you are building; never cross-apply wording between types.

Per `html-rules.md`, numbers stay in Arabic numerals in every language (write `12 နာရီ`, not `၁၂ နာရီ`), and currency symbols keep their spacing convention (`K 100`, `₫ 100 K`, `RM 100`).

Standard industry terms. **The Burmese column varies by activity type — check the approved copy for your type before using this table**:

| English | Burmese — Instant Challenge | Burmese — Auto Redeem 3-tier | Vietnamese (VND) |
|---|---|---|---|
| turnover / 流水 | လောင်းကြေးပမာဏ | လောင်းကြေးပမာဏ | doanh thu cược |
| bonus / prize money | ဘောနပ်စ် | **ဆုကြေး** | tiền thưởng |
| ticket | တက်ကတ် | **တိကက်** (in a max-count phrase: လက်မှတ်) | vé |
| challenge | စိန်ခေါ်မှု | — | thử thách |
| instant challenge | အမြန်စိန်ခေါ်မှု | — | thử thách tức thì |
| event / programme | — | အစီအစဉ် | chương trình |
| unlock | — | လော့ခ်ဖွင့် | mở khóa |
| max payout | — | အများဆုံးဆုကြေး | — |
| player | ကစားသမား | ကစားသမား | người chơi |
| promotion | ပရိုမိုးရှင်း | ပရိုမိုးရှင်း | khuyến mãi |
| system | စနစ် | စနစ် | hệ thống |
| Menu / Member Info | မီနူး / အဖွဲ့ဝင်အချက်အလက် | **keep English** | Menu / Thông tin thành viên |

Extend this table when a new market or term comes up.

### A title line is NOT truncated body copy — never ask for "the rest"

When Brian sends a localized line like `JILI အမြန်စိန်ခေါ်မှု` under a heading such as 「提供緬甸文文案如下」, that line **is** the whole thing he's supplying: the activity title. It is not the first line of a paste that got cut off. Generate the body from the skeleton in this file and move on.

**Activity titles are not an API field.** All 14 stored template items have zero `<h1>`–`<h6>`/`<title>` tags in `hintHtml`/`footerHtml`/`infoHtml`/`multiplyHtml`; the title is baked into the banner artwork. So a supplied title needs no field at all — it tells you what the banner image says, nothing more.

### The only two per-activity inputs that can't be derived
Everything else comes from the brief plus these skeletons. Only these two require Brian:
1. **`gameHallBannerUrl`** — the banner path. Store it exactly as given, **without** an `https://` prefix (template convention: `img.mpsimg.com/Bonusevent/Banner/<id>.webp`). Markdown link syntax in his message is his client auto-linking; strip it.
2. **the localized title** — context only, per above.

If he hasn't sent the banner path yet, leave `gameHallBannerUrl` empty and mention it in one line at the end. Do not block the deliverable on it, and do not ask about anything else.

These are the reusable structural skeletons observed across real activities, captured in generic English so they can be produced without the user re-pasting a template every time. **Always run the result through `references/html-rules.md`** — translate to the target currency's language, swap the currency symbol, recompute the clearing time, and swap any `class="txt-rate XXX"` currency code — before delivering.

Placeholders use `{CURLY_BRACES}`. `{N}` = day count. System-injected `<span>` fields always stay empty regardless of type.

---

## Daily Mission (with Challenge)
```html
<!-- Footer Html with challenge-EN-->
<div class="ticket-box">
<ul class="list-dot">
    <li>{N} daily missions, one mission per day.</li>
    <li>Complete the daily mission to receive rewards instantly.</li>
    <li>Only {GAME_COUNT} {PROVIDER} games are included in the daily missions:
        {GAME_LIST}. 
        (Click "GO" to enter the event game list)
    </li>
    <li>The company reserves the right to amend, suspend, or cancel the promotion at any time.</li>
</ul>
</div>
```
No hintHtml/infoHtml content typically needed (system-driven progress bar). `{GAME_COUNT}` must equal actual game list length.

---

## Roulette
```html
<!-- Hint Html -->
<div class="tooltip-box">
    <ul class="list-dot">
        <li>Day {i} {date1} {clearing_time} ~ {date2} {clearing_time}</li>
        ... one <li> per day ...
	EX:
	<ul class="list-dot">
        <li>Bet {SYM} {amount1} get {tickets1} tickets</li>
        ... a handful of proportional bet→ticket examples scaled from ticketPrice ...
	</ul>
</div>

<!-- Footer Html 即時版-->
<div class="ticket-box">
    <ul class="list-dot">
        <li>{GAME_COUNT} bonus games, bet <strong>{SYM}{ticketPrice}</strong> to get <strong>1</strong> ticket</li>
		<li>One player Max {dailyCap} tickets everyday.</li>
		<li><strong>Bonus Claim</strong>: redeem 1 ticket to get random bonus instantly!</li>
		<li>All tickets must redeem before {redeemDeadline}.</li>
		<li>{GAME_COUNT} bonus games, bet <strong>{SYM}100</strong> to get <strong>1</strong> MPS VIP Point.</li>
        <li>1 MPS VIP Point is not equivalent to {SYM}1.</li>
        <li>Player can check number of MPS VIP Points at Menu/ Member Info.</li>
		<li>EX: Bet {SYM}{ticketPrice} will get 1 ticket and {ticketPrice/100} MPS VIP Points.</li>
        <li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li>
	</ul>
</div>

<!-- Info Html --> {today-you-bet-progress-bar, see "System progress bar" section below} -->
```

---

## Golden Egg
```html
<!-- Hint Html -->
<div class="tooltip-box">
    <ul class="list-dot">
        <li>Day {i} {date1} {clearing_time} ~ {date2} {clearing_time}</li>
        ...
        EX:
	<ul class="list-dot">
        <li>Bet {SYM}{amount} get {tickets} tickets</li>
        ...
	</ul>
</div>

<!-- Footer Html -->
<div class="ticket-box">
    <ul class="list-dot">
        <li>Bet {GAME_COUNT} bonus games for <strong>{SYM}{ticketPrice}</strong> to get <strong>1</strong> ticket.</li>
		<li>Max {dailyCap} tickets per person per day.</li>
		<li><strong>Bonus Claim</strong>: redeem 1/10/100 tickets to get random bonus instantly</li>
		<li>All tickets must redeem before {redeemDeadline}.</li>		
		<li>Bet {GAME_COUNT} bonus games for <strong>{SYM}100</strong> to get <strong>1</strong> MPS VIP Point.</li>
        <li>1 MPS VIP Point is not equivalent to {SYM}1.</li>
        <li>Player can check number of MPS VIP Points at Menu/Member Info.</li>
        <li>EX: Bet {GAME_COUNT} bonus games for {SYM}{ticketPrice} will get 1 ticket and {ticketPrice/100} MPS VIP Points.</li>
		<li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li>
	</ul>
</div>
```
Note: this activity type always requires `skinName: "egg"` on the API side (see activity-codes.md).

---

## Rebate
```html
<!-- Hint Html -->
<div class="tooltip-box">
     <ul class="list-dot">
         <li>rebate {ratePct}% if total bet >{threshold}.</li>
         <li>Total bet will be reset everyday.  ex: Day1 total bet: {threshold}, can get {threshold*ratio} {currency}.  Day2 total bet: {threshold-1}, no rebate on Day2.</li>
         <li>Rebate amount will be auto issued every minute.</li>
         <li>No cap limit. The more you bet, the more rebate to you.</li>
     </ul>
 </div>

<!-- Info Html Rebate活動使用中-->
Start to rebate {ratePct}% after total bet>={SYM}{threshold}.
Today bet: <span id="eventTurnover"  class="txt-rate"></span>
```
No footerHtml content typically needed for this type (leave as `<!-- Info Html -->` placeholder if nothing given).

---

## Auto Redeem — 3-Tier (Instant Pay) / Treasure Pick — 3-Tier (Instant Pay style)
Same skeleton for both — the LV1/LV2/LV3 unlock structure:
```html
<!-- Hint Html -->
<div class="tooltip-box">
    <ul class="list-dot">
        <li>Day {i} {date1} {clearing_time} ~ {date2} {clearing_time}</li>
        ... one per day ...
    </ul>
</div>

<!-- Footer Html -->
<div class="ticket-box">
    <ul class="list-dot">
        <li>Bet {ALL_GAMES_OR_GAME_COUNT} to earn tier tickets.</li>      
        <li>Players can receive unlimited tickets.</li>
        <li>The event starts from LV1. LV2 will be unlocked after LV1 reaches its max ticket amount, and LV3 will be unlocked after LV2 reaches its max ticket amount.</li>
        <li class="ticket-tier-summary">
            <ul class="ticket-tier-list">
                <li class="ticket-tier-item tier-min">
                    <span class="ticket-tier-label"><i class="icon icon-ticket" aria-hidden="true"></i>LV1</span>
                    <span class="ticket-tier-caption">Max Payout :</span>
                    <span class="txt-rate {CURRENCY}" id="miniMaxPrize"></span>
                </li>
                <li class="ticket-tier-item tier-med">
                    <span class="ticket-tier-label"><i class="icon icon-ticket" aria-hidden="true"></i>LV2</span>
                    <span class="ticket-tier-caption">Max Payout :</span>
                    <span class="txt-rate {CURRENCY}" id="majorMaxPrize"></span>
                </li>
                <li class="ticket-tier-item tier-max">
                    <span class="ticket-tier-label"><i class="icon icon-ticket" aria-hidden="true"></i>LV3</span>
                    <span class="ticket-tier-caption">Max Payout :</span>
                    <span class="txt-rate {CURRENCY}" id="megaMaxPrize"></span>
                </li>
            </ul>
        </li>
        <li><strong>Bonus Claim</strong>: once players reach the required turnover, {click-the-treasure-box OR the system automatically issues} the Instant Pay bonus of the corresponding tier, and the bonus will be credited instantly.</li>
        <li><strong>If the rewards are not claimed, all rewards will be cleared at {clearing_time}.</strong></li>
        <li>Bet {ALL_GAMES_OR_GAME_COUNT} for <strong>{SYM}100</strong> to get <strong>1</strong> MPS VIP Point.</li>
        <li>1 MPS VIP Point is not equivalent to {SYM}1.</li>
        <li>Players can check the number of MPS VIP Points at Menu / Member Info.</li>
        <li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li>
    </ul>
</div>
```
Two sub-variants for the "Bonus Claim" line, depending on whether the source type is treasure-pick-styled (click a box) or auto-redeem-styled (fully automatic, no click):
- Treasure-pick 3-tier: "...click the treasure box to redeem tickets of the corresponding level, and the rewards will be credited instantly." + a "cleared at {time} if unclaimed" line.
- Auto-redeem 3-tier: "...the system will automatically issue the Instant Pay bonus of the corresponding tier, and the bonus will be credited instantly." (no "cleared if unclaimed" line — nothing to claim, it's automatic.)

`{ALL_GAMES_OR_GAME_COUNT}` — use "all {PROVIDER} games" if the brief says all of a provider's games qualify, otherwise "{N} bonus games" with the actual count.

### Approved Burmese (MMK) copy — use verbatim, do not re-translate
Brian-supplied. Substitute only the game-scope phrase and any counts; leave every other word alone.

```
<li>{GAME_SCOPE}တွင် လောင်း၍ အဆင့်တိကက်များကို ရယူပါ။</li>
<li>ကစားသမားများသည် တိကက်များကို အကန့်အသတ်မရှိ ရရှိနိုင်သည်။</li>
<li>အစီအစဉ်ကို နေ့စဉ် LV1 မှစတင်ပြီး LV1 သည် အများဆုံးလက်မှတ်အရေအတွက်သို့ရောက်ရှိပြီးနောက် LV2 ကို လော့ခ်ဖွင့်မည်ဖြစ်ပြီး LV2 သည် အများဆုံးလက်မှတ်အရေအတွက်သို့ရောက်ရှိပြီးနောက် LV3 ကို လော့ခ်ဖွင့်မည်ဖြစ်သည်။</li>
[tier summary block — caption text is "အများဆုံးဆုကြေး :" for LV1/LV2/LV3, value spans stay EMPTY]
<li><strong>ဆုကြေးရယူခြင်း</strong>: ကစားသမားများသည် သတ်မှတ်ထားသော လောင်းကြေးပမာဏ ပြည့်မီပါက စနစ်မှ သက်ဆိုင်ရာအဆင့်၏ Instant Pay ဆုကြေးကို အလိုအလျောက် ထုတ်ပေးမည်ဖြစ်ပြီး၊ ဆုကြေးများ ချက်ချင်းရရှိမည်ဖြစ်သည်။</li>
<li>{GAME_SCOPE}တွင် {SYM} 100 လောင်းပါက MPS VIP Point 1 မှတ် ရရှိမည်။</li>
<li>MPS VIP Point 1 မှတ်သည် {SYM} 1 နှင့် မညီမျှပါ။</li>
<li>ကစားသမားသည် MPS VIP Points အရေအတွက်ကို Menu / Member Info တွင် စစ်ဆေးနိုင်သည်။</li>
<li>ကုမ္ပဏီသည် ပရိုမိုးရှင်းကို အချိန်မရွေး ပြင်ဆင်ခြင်း၊ ရပ်ဆိုင်းခြင်း သို့မဟုတ် ပယ်ဖျက်ခြင်း ပြုလုပ်ပိုင်ခွင့်ရှိသည်။</li>
```

`{GAME_SCOPE}`: a fixed game count → `ဘောနပ်စ်ဂိမ်း N ခု`; all of one provider's games → `<PROVIDER> ဂိမ်းအားလုံး`.

Points to preserve exactly, because earlier Claude output got each one wrong:
- **`ဆုကြေး`** is the word for bonus/prize money throughout this type — not the transliteration `ဘောနပ်စ်`.
- **`တိကက်`** for ticket in lines 1–2; **`လက်မှတ်`** inside the max-count phrase in line 3. The mix is intentional.
- **`အစီအစဉ်`** for the event — not `ပွဲတော်` (that means festival).
- **`လော့ခ်ဖွင့်`** for unlock; **`အများဆုံးဆုကြေး`** for max payout.
- **"Menu / Member Info" stays in English** for this type.
- `ပရိုမိုးရှင်းကို` has no space before `ကို`; the closing line ends `ပြုလုပ်ပိုင်ခွင့်ရှိသည်။`

---

## Treasure Pick — 3-Tier with Daily/Weekly MedalSame LV1/LV2/LV3 skeleton as above, but the intro line is simpler ("Bet {N} bonus games to earn tier tickets.") since no medal-specific HTML line is needed — medal payouts are shown by the game UI automatically from `rankRewardSetting`, not from custom HTML text.

---

## Instant Challenge
```html
<!-- Info Html --> <div class="ticket-box"> <ul class="list-dot"> 
<li>System issues instant challenge tickets every day.</li> 
<li>Start challenge and bet on {challengingGameCount} challenge games with {turnoverMultiplier}X turnover. (Bonus = turnover ÷ {turnoverMultiplier})</li> 
<li>Player can give up current ticket and start next one.</li> 
<li>Each ticket may challenge with different games.</li> 
<li>New tickets will be issued daily at {clearing_time}, and the challenge must be completed within {challengeExpireHours} hours after clicking challenge to receive the bonus.</li> 
<li>All tickets must finished challenge before {redeemDeadline}.</li> 
<li>MPS VIP Points are calculated based on challenge turnover (MPS VIP Points = turnover ÷ 100).</li> 
<li>1 MPS VIP Point is not equivalent to {SYM}1.</li> 
<li>Player can check number of MPS VIP Points at Menu/ Member Info.</li> 
<li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li> 
<li>EX: Start first ticket challenge than bet {SYM}{turnoverExample} turnover to get {SYM}{bonusExample} bonus ({turnoverExample} ÷ {turnoverMultiplier}) and {points} MPS VIP Points ({turnoverExample} ÷ 100). System will issue bonus to player instantly when challenge finish. Player can give up the first ticket challenge to start next ticket challenge.</li> 
</ul> </div>
```
This type puts everything in `infoHtml`, not `footerHtml`/`hintHtml`.

### Formatting the numbers in this skeleton
`{SYM}` in the skeleton is written flush against the placeholder, but that is shorthand — apply the per-currency spacing and the mandatory thousands separators from "Currency → symbol" in `html-rules.md`. For MMK that means `K 90,000` and `K 5,000`, not `K90000`. The bare figures inside the parenthesised working (`90,000 ÷ 18`) take separators too but no symbol.

### Show the arithmetic, don't just state a rate (Brian's approved format)
This skeleton was revised to Brian's own wording. Three deliberate choices — keep them:
1. **Write formulas inline.** `(Bonus = turnover ÷ {turnoverMultiplier})` and `(MPS VIP Points = turnover ÷ 100)`, plus the parenthesised working in the EX line. The older phrasing "Bet on bonus games for {SYM}100 to get 1 MPS VIP Point" is ambiguous enough that it caused a real error — it reads as if points come from the payout. Prefer the explicit division.
2. **VIP points get their own line stating the basis** (challenge turnover), replacing the old rate-only line.
3. **Keep "Player can give up current ticket and start next one"** as a standalone line *and* the equivalent sentence at the end of the EX line. Brian confirmed both stay — do not drop either.

All 11 `<li>` remain; nothing was removed, two lines were reworded.

`{points}` = `{turnoverExample}` ÷ 100 (the **turnover**, not the payout) — see "MPS VIP Point rule" in `html-rules.md`. The stored template item's EX line showing ₱100,000 turnover → 50 points is **wrong**; the correct figure there is 1,000. Never reuse that 50.

Three values in that stored item (`PGPHPIC07080729`) are stale and must not be copied: the 50-point figure above; its EX turnover/bonus numbers, which contradict its own `prizeDistribution` (`challengePrize` 50 × `turnoverMultiplier` 20 = 1,000, not the ₱100,000 shown); and its `gameHallBannerUrl`, which says `PGMMIC` while the currency is PHP. Take structure from this item, take numbers from the brief.

---

## Treasure Pick — Single-Tier (single or nine-box)
```html
<!-- Hint Html -->
<div class="tooltip-box">
    <ul class="list-dot">
        <li>Day {i} {date1} {clearing_time} ~ {date2} {clearing_time}</li>
        ...
        <p><strong>EX:</strong></p>
        <ul class="list-dot">
            <li>Bet {SYM}{amount} → {tickets} tickets</li>
            ...
        </ul>
    </ul>
</div>

<!-- Footer Html 即時版-->
<div class="ticket-box">
    <ul class="list-dot">
        <li>Bet {GAME_COUNT} bonus games for <strong>{SYM}{ticketPrice}</strong> to get <strong>1</strong> ticket</li>
        <li>One player Max <strong>{dailyCap}</strong> tickets everyday.</li>
        <li><strong>Bonus Claim</strong>: redeem 1 ticket to get random bonus instantly!</li>
        <li>All tickets must redeem before <strong>{redeemDeadline}</strong></li>
        <li>Bet {GAME_COUNT} bonus games for <strong>{SYM}100</strong> to get <strong>1</strong> MPS VIP Point.</li>
        <li>1 MPS VIP Point is not equivalent to {SYM}1.</li>
        <li>Player can check number of MPS VIP Points at Menu / Member Info.</li>
        <li>EX: Bet {GAME_COUNT} bonus games for {SYM}{ticketPrice} will get 1 ticket and {ticketPrice/100} MPS VIP Points.</li>
        <li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li>
    </ul>
</div>
```

---

## Signup (with Challenge)
```html
<!-- Footer Html SingUp Bonus-->
<div class="ticket-box">
    <ul class="list-dot">
        <li><strong>Congrats. You get {ticketCount} free signup bonus tickets!</strong></li>
        <li>Click bonus icon to redeem tickets.</li>
        <li><strong>Bonus Claim:</strong><br>
        Pick up bonus and start challenge mode, bet on {challengingGameCount} challenge games with {turnoverMultiplier}X turnover for bonus.</li>
        <li><strong>Bonus Cancelled:</strong> Challenge mode would be expired in {challengeExpireHours} hours or at event close.</li>
        <li>All tickets must redeem and finish challenge by {redeemDeadline}.</li>
        <li>The company has the right to revoke, cancel or suspend the promotion at any time.</li>
        <li>EX: Ticket redeem on {exampleDate} get {SYM}{ticketValue} bonus and start challenge mode, bet {SYM}{turnoverExample} turnover to get {SYM}{ticketValue} bonus. Challenge mode will expire on {exampleExpiry}.
    </ul>
</div>
```

---

## Raffle (戳戳樂 / Raffle Multi)
Identical skeleton to Treasure Pick Single-Tier above (same Hint EX-list + Footer structure) — only `presentPrizeNum` (8 vs 24) and `prizeDistribution` shape differ on the API side, not the HTML. Reuse that skeleton with the actual `{GAME_COUNT}` (8 for standard raffle, still describe actual games for multi).

---

## Auto Redeem — Single-Tier
```html
<!-- Hint Html -->
<div class="tooltip-box">
  <ul class="list-dot">
    <li>Day {i} {date1} {clearing_time} ~ {date2} {clearing_time}</li>
    ...
  </ul>
  <p><strong>Example:</strong></p>
  <ul class="list-dot">
    <li>Bet {SYM}{amount} → {tickets} tickets</li>
    ...
  </ul>
</div>

<!-- Footer Html 即時版-->
<div class="ticket-box">
  <ul class="list-dot">
    <li>Bet {GAME_COUNT} bonus games for <strong>{SYM}{ticketPrice}</strong> to get <strong>1</strong> ticket</li>
    <li>One player can get unlimited tickets every day. (or state the actual daily cap if one is given)</li>
    <li><strong>Bonus Claim</strong>: system auto redeem tickets and give random bonus instantly.</li>
    <li>All tickets must redeem before {redeemDeadline}</li>
    <li>Bet {GAME_COUNT} bonus games for <strong>{SYM}100</strong> to get <strong>1</strong> MPS VIP Point.</li>
    <li>1 MPS VIP Point is not equivalent to {SYM}1.</li>
    <li>Player can check number of MPS VIP Points at Menu/ Member Info.</li>
    <li>EX: Bet {GAME_COUNT} bonus games for {SYM}{ticketPrice} will get 1 ticket and {ticketPrice/100} MPS VIP Points.</li>
    <li>Company reserves the right to amend, suspend or cancel the promotion at any time.</li>
  </ul>
</div>
```

---

## System progress bar (`infoHtml`) — used by Roulette, Golden Egg, Treasure Pick, Raffle, Auto Redeem
This tracking widget recurs across ticket-based types (not Rebate, not Instant Challenge, not Signup, not Daily Mission):
```html
<!-- Info Html -->
TODAY you bet <span id="eventTurnover" class="txt-rate"></span> → 
<span id="todayTickets"></span> ticket(s) <br>
Bet <span id="needMoreTurnover" class="txt-rate"></span>
to get <span id="earnTicket"></span> more ticket
```
All four `<span>` values stay empty — system-injected.

---

## Rank Record / Race Win (`tipText`, not hintHtml/footerHtml/infoHtml)
These two types don't use the `insertBonusEvent` HTML fields at all — they use a single `tipText` field on the `insertRankRecordSetting` endpoint. Structure is a flat `<ul>`, no tier/progress-bar patterns:
```html
<ul>
<li class="tit">{PROVIDER} {Single Win Tournament / Race Winner} ({startDate} ~ {endDate})</li>
<li class="tit">Term and Condition</li>
<li class="number_1">{PROVIDER} Platform(Any games)</li>
<li class="number_2">{rule description, e.g. winning amount / target amount threshold}</li>
<li>Reward</li>
<li class="number_3">List {N} Ranking</li>
<li class="number_4">{Daily/Prize structure, listing each rank's payout}</li>
<li class="tit">(1) {payout timing note}</li>
<li class="tit">(2) {claim requirement note}</li>
</ul>
```
