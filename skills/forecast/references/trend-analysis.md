# Trend Analysis

Methodology for computing growth rates, detecting acceleration, calibrating thresholds,
and avoiding false alarms in codebase forecasting.

## Computing Growth Rates

### Time-Series Sampling

Sample the metric at regular intervals over the analysis period:

```
Point 1: 6 months ago → { lines: 180, functions: 8, imports: 5, commits: 3/month }
Point 2: 4 months ago → { lines: 220, functions: 10, imports: 6, commits: 4/month }
Point 3: 2 months ago → { lines: 280, functions: 13, imports: 8, commits: 6/month }
Point 4: now          → { lines: 340, functions: 16, imports: 10, commits: 8/month }
```

**How to sample historically:**
```bash
# Get the commit hash at approximately N months ago
git log --oneline --before="N months ago" -1

# Get file stats at that point
git show {commit}:{file} | wc -l
```

### Growth Rate Calculation

**Linear growth rate:** (current - original) / months
- Example: (340 - 180) / 6 = 26.7 lines per month

**Percentage growth rate:** ((current / original) - 1) * 100 / months
- Example: ((340 / 180) - 1) * 100 / 6 = 14.8% per month

Use percentage for comparison across files of different sizes. A 10-line file growing
by 5 lines is 50% growth; a 500-line file growing by 5 lines is 1% growth.

## Detecting Acceleration

Acceleration means the growth rate itself is increasing — the file is growing FASTER
now than it was before.

### Simple Method: Half-Period Comparison

Split the analysis period in half. Compare growth in each half:

```
First half (6-3 months ago):  180 → 220 = +40 lines
Second half (3 months-now):   220 → 340 = +120 lines
```

If second-half growth > 1.5x first-half growth → accelerating.
If second-half ≈ first-half → linear (stable growth).
If second-half < 0.7x first-half → decelerating.

### Classification

| Pattern | Second half vs first half | Interpretation |
|---------|-------------------------|----------------|
| **Accelerating** | >1.5x | Growing faster recently — concerning |
| **Linear** | 0.7x - 1.5x | Steady growth — monitor |
| **Decelerating** | <0.7x | Slowing down — less concerning |
| **Flat** | Both halves < 5% growth | Stable — not a concern |
| **Spike** | One half has 3x+ the other | One-time event, not a trend |

### Distinguishing Spikes from Trends

A spike is a one-time jump (major feature added, big refactor) vs a sustained trend.

**Spike indicators:**
- Growth concentrated in 1-2 commits
- Other months in the period show normal or zero growth
- The commit message explains a specific event ("migrate to new API", "add bulk export")

**Trend indicators:**
- Growth spread across many commits over multiple months
- No single commit accounts for >30% of the total growth
- Growth rate is consistent month-over-month

Spikes should NOT trigger forecast warnings — they're events, not trajectories.

## Threshold Calibration

### When is Growth Concerning?

| Metric | Low concern | Moderate | High concern |
|--------|-------------|----------|-------------|
| Line growth | <5%/month | 5-15%/month | >15%/month |
| Function growth | <1/month | 1-3/month | >3/month |
| Import growth | <1/month | 1-2/month | >2/month |
| Churn acceleration | <1.2x | 1.2-2x | >2x |

### Size Thresholds (Projection Targets)

| Lines | Assessment |
|-------|-----------|
| <150 | Comfortable — easy to understand |
| 150-300 | Growing — still manageable but watch it |
| 300-500 | Large — hard to reason about as a whole |
| >500 | Critical — should be split |

**Projection:** If a file is at 280 lines growing at 15%/month:
- 1 month: ~320 lines (crosses "large" threshold)
- 3 months: ~425 lines
- 5 months: ~560 lines (crosses "critical" threshold)

Use these projections to give concrete timelines: "will cross 500 lines in ~5 months
at current rate."

## Avoiding False Alarms

### Don't Flag These

1. **New files in active development** — a file created last month growing quickly is
   normal. Wait until it has 3+ months of history before forecasting.

2. **Test files growing with source** — test files should grow as the code they test grows.
   Growth in test files is usually healthy.

3. **Generated or config files** — package-lock.json, migration files, compiled output.
   Exclude from analysis.

4. **One-time events** — a major refactor, feature addition, or migration. Check if the
   growth was concentrated in a short period. If yes, it's a spike, not a trend.

5. **Files that are SUPPOSED to be large** — route registries, type definition files,
   translation files. These grow as the project grows and that's fine.

### Do Flag These

1. **Files growing despite no new features** — complexity accumulating from bug fixes
   and patches without corresponding feature additions.

2. **Files growing faster than the project average** — one module absorbing more than
   its share of changes.

3. **Files where complexity growth outpaces size growth** — nesting depth increasing
   faster than line count suggests the code is becoming more tangled, not just longer.

4. **Files with accelerating churn + growing size** — the worst combination. More changes
   AND more code means more surface area for bugs with higher change frequency.

## Presenting Forecasts

### Confidence Levels

- **6+ months of history, clear trend:** "At current rate, X will happen in Y months"
- **3-6 months of history:** "Trend suggests X, but limited history — monitor"
- **< 3 months:** "Too early for reliable projections — current trajectory noted"

### Always Include

- The raw data (line counts at sample points) — let the developer verify your interpretation
- Whether the trend is linear or accelerating
- Whether there were spikes that might distort the trend
- A specific recommendation (split, refactor, monitor, or no action)

## Rewrite Event Detection

A rewrite is a special case that can distort trend data. Detect and handle:

### What is a Rewrite?

A commit (or small set of commits) that replaces >50% of a file's content. Indicators:
- `git log --stat` shows deletions close to the previous file size
- The file's line count drops significantly then grows from the new baseline
- The commit message references "rewrite", "v2", "redesign", or "from scratch"

### Impact on Forecasting

Rewrites break trend continuity. The growth rate BEFORE the rewrite is irrelevant to the
growth rate AFTER. When a rewrite is detected:
1. Use the rewrite commit as the new baseline for trend computation
2. Only compute growth rates from the post-rewrite period
3. Note the rewrite in the forecast output — it explains why history is short
4. If the rewrite was recent (< 2 months ago), flag the forecast as low-confidence

### Detection Method

For each file's time-series samples, check for a drop of >30% between any two consecutive
samples. If found, treat the later sample as the effective start of the file's history
for forecasting purposes.
