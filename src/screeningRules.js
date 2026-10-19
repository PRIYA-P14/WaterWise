/**
 * screeningRules.js
 *
 * Single source of truth for the experimental WaterWise screening thresholds
 * and category-assignment logic.
 *
 * Thresholds are derived from the 355-record model-ready dataset:
 *   ET0_THRESHOLD      — boundary between Monitor and elevated categories
 *                        (Monitor max 4.9749, elevated min 5.0036 mm/day)
 *   SM_P25_THRESHOLD   — surface-moisture 25th percentile of the dataset
 *                        (Potential max 0.163375, Review-moisture min 0.164500)
 *
 * These are experimental values. They are not validated agronomic thresholds.
 */

export const ET0_THRESHOLD = 5.0;   // mm/day  (> this → elevated)
export const SM_P25_THRESHOLD = 0.163375; // unitless (≤ this → relatively low)

/**
 * Apply the screening rules to a set of input values.
 *
 * @param {number} et0     Daily reference evapotranspiration (mm/day)
 * @param {number} rain    Daily rainfall (mm)
 * @param {number} sm      Surface soil-moisture estimate (0–1)
 * @returns {{ category: string, conditions: Array<{met: boolean, text: string}> }}
 */
export function applyScreeningRules(et0, rain, sm) {
  const et0Elevated = et0 > ET0_THRESHOLD;
  const smLow       = sm <= SM_P25_THRESHOLD;
  const rainFell    = rain > 0;

  if (!et0Elevated) {
    return {
      category: 'Monitor - lower ET0',
      conditions: [
        {
          met: true,
          text: `ET₀ (${et0.toFixed(2)} mm/day) is at or below the experimental threshold of ${ET0_THRESHOLD} mm/day — no further review triggered.`,
        },
      ],
    };
  }

  if (rainFell) {
    return {
      category: 'Review rainfall before irrigation',
      conditions: [
        {
          met: true,
          text: `ET₀ (${et0.toFixed(2)} mm/day) is above the experimental threshold of ${ET0_THRESHOLD} mm/day.`,
        },
        {
          met: true,
          text: `Rainfall was entered (${rain.toFixed(2)} mm > 0) — review effective rainfall before considering irrigation.`,
        },
      ],
    };
  }

  if (smLow) {
    return {
      category: 'Potential irrigation review',
      conditions: [
        {
          met: true,
          text: `ET₀ (${et0.toFixed(2)} mm/day) is above the experimental threshold of ${ET0_THRESHOLD} mm/day.`,
        },
        {
          met: true,
          text: `Surface soil-moisture estimate (${sm.toFixed(4)}) is at or below the dataset's 25th-percentile threshold of ${SM_P25_THRESHOLD}.`,
        },
        {
          met: true,
          text: `No rainfall entered (${rain.toFixed(2)} mm).`,
        },
      ],
    };
  }

  // et0Elevated && !rainFell && !smLow
  return {
    category: 'Review - moisture not relatively low',
    conditions: [
      {
        met: true,
        text: `ET₀ (${et0.toFixed(2)} mm/day) is above the experimental threshold of ${ET0_THRESHOLD} mm/day.`,
      },
      {
        met: false,
        text: `Surface soil-moisture estimate (${sm.toFixed(4)}) is above the dataset's 25th-percentile threshold of ${SM_P25_THRESHOLD} — the low-moisture condition was not met.`,
      },
      {
        met: true,
        text: `No rainfall entered (${rain.toFixed(2)} mm).`,
      },
    ],
  };
}
