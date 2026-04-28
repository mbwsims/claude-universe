---
name: forecast
description: >-
  This skill should be used when the user asks "what's about to become a problem", "predict
  issues", "trend analysis", "which files are growing", "what's getting worse", "complexity
  forecast", "what should I refactor next", mentions "/forecast", or wants to predict which
  files are on concerning trajectories before they become critical.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__timewarp__timewarp_trends
  - mcp__timewarp__timewarp_history
argument-hint: "[directory]"
---

# Forecast

Predict which files are about to become problems. Hotspots look backward — what's risky
now. Forecast looks forward — what's BECOMING risky. By the time a file is a hotspot, it's
already painful. Forecast catches it while there's still time to intervene.

## Workflow

### 1. Scope

- **No argument:** Analyze the whole project. Surface the top 5 files on concerning
  trajectories.
- **With argument:** Focus on a specific directory.

### 2. Gather Trend Data

**With timewarp-mcp (preferred):** Call `timewarp_trends` to get computed growth rates,
acceleration data, and churn trends for all source files. This provides precise time-series
data sampled at intervals. Then call `timewarp_history` on the top concerning files to add
commit-count and author-context before writing recommendations.

**Without timewarp-mcp:** Compute manually by sampling git history:
```bash
# Line count 6 months ago vs now
git log --oneline --since="6 months ago" --until="3 months ago" --format=format: --name-only | sort | uniq -c | sort -rn | head -20
git log --oneline --since="3 months ago" --format=format: --name-only | sort | uniq -c | sort -rn | head -20
```

Compare churn in the first half vs second half of the period to detect acceleration.

### 3. Analyze Trends

For each source file with meaningful history, assess:

- **Churn trend:** Is it changing more frequently recently than historically?
  - Accelerating: more commits per month now than 3 months ago
  - Stable: consistent commit rate
  - Decelerating: activity is tapering off
- **Complexity growth:** Is it getting larger/more complex?
  - Track: line count, function count, import count over time
  - A file growing 10% per month will double in 7 months
- **Author fragmentation:** Are more people touching it? (knowledge spreading thin)

See `references/trend-analysis.md` for methodology.

### 4. Project Forward

For files on concerning trajectories, project the trend forward:
- When will it cross size thresholds? (300-500 lines = large/hard to reason about, >500 lines = critical/should be split)
- When will churn make it a hotspot? (if not already)
- Is the growth accelerating (exponential) or linear?

### 5. Check for Cached Data

Read `.timewarp/` for existing drift or dissect data on trending files. If a file is both
drifting AND growing, that's a stronger signal — note the connection.

### 6. Present and Save

**Report format:**

```
## Forecast — {scope}

Analyzed {n} source files over {period}

### Files on Concerning Trajectories

| Rank | File | Growth Pattern | Lines/Month | %/Month | Churn Pattern | Projection (3mo) | Projection (6mo) | Threshold |
|------|------|---------------|-------------|---------|--------------|------------------|------------------|-----------|
| 1 | src/lib/auth.ts | accelerating | +26.7 | +14.8% | accelerating | ~425 lines | ~560 lines | 500 in ~5mo |
| 2 | src/api/orders.ts | linear | +15.0 | +8.2% | accelerating | ~345 lines | ~390 lines | 500 in ~11mo |
| 3 | src/lib/db.ts | linear | +8.3 | +5.0% | linear | ~225 lines | ~250 lines | 300 in ~9mo |

These columns map directly to `timewarp_trends` output: `growth.pattern`, `growth.linesPerMonth`, `growth.percentPerMonth`, `churn.pattern`, `projection.linesIn3Months`, `projection.linesIn6Months`, `projection.crossesThreshold`.

### Detailed Analysis

**#1: src/lib/auth.ts** — Complexity Accelerating
- Sample trend: 180 lines / 8 functions → 240 lines / 11 functions → 310 lines / 15 functions
- Growth is accelerating — added more in the last 3 months than the previous 3
- Recommendation: Split before it crosses 400 lines. Auth verification, session
  management, and token handling could be separate modules.

**#2: src/api/orders.ts** — Churn Accelerating
- ...

### Stable Files (No Concern)
{Brief note on files that are stable or decelerating — positive signal}

### Recommendations
{Prioritized list: which files to address first and what to do}
```

**Save results** to `.timewarp/forecast-{date}.json` with structured trend data that
other skills can consume.

> **`.timewarp/` directory:** Create the directory if it doesn't exist. Results older than
> 30 days are stale — prefer re-running the analysis over consuming old data. Other
> Timewarp skills may read these files to cross-reference findings (e.g., `/forecast`
> checks for drift data on trending files).

## Guidelines

- Focus on ACCELERATION, not just size. A 500-line file that hasn't changed in a year is
  fine. A 200-line file growing 15% per month is a forecast concern.
- Don't cry wolf. Only surface files with genuinely concerning trajectories. If nothing
  is trending badly, say "no concerning trajectories found" — that's a good result.
- Projections are estimates, not predictions. Use language like "at current rate" and
  "approximately." Never give false precision.
- Connect to action. Every forecast entry should include a specific recommendation —
  what to do about it and when.
- If git history is short (< 3 months), note that projections are less reliable and
  focus on current growth rate rather than acceleration.

## Related Skills

- **`/drift`** — Check if forecasted files are also drifting from their purpose
- **lenskit `/hotspots`** — Current risk assessment (forecast's backward-looking complement)

## Additional Resources

- **`references/trend-analysis.md`** — Growth rate computation, acceleration detection,
  threshold calibration, false alarm avoidance
