/**
 * Experimental, explainable irrigation decision support rules.
 *
 * These rules are a prototype screening aid. They do not estimate soil
 * moisture, crop water requirements, irrigation quantities, or water savings.
 */

import { selectNext24HourlyForecast } from './services/hourlyForecast.js';
import { validateForecastFreshness } from './services/forecastFreshness.js';

export const DECISION_LABELS = {
  REVIEW: 'Irrigation may need review',
  WAIT: 'Wait and reassess',
  MORE_INFO: 'More information needed',
};

const VALID_SOIL_CONDITIONS = new Set(['Dry', 'Moist', 'Wet', 'Not Sure']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatNumber(value, decimals = 1) {
  return Number(value).toFixed(decimals);
}

function forecastSignals(weather) {
  const freshness = validateForecastFreshness(weather);
  const hourly = selectNext24HourlyForecast(weather?.hourly, weather?.current?.time);
  const daily = Array.isArray(weather?.daily) ? weather.daily.slice(0, 7) : [];
  const hourlyProbability = hourly
    .map((row) => row.precipitationProbability)
    .filter(isFiniteNumber);
  const hourlyAmount = hourly
    .map((row) => row.precipitation)
    .filter(isFiniteNumber);
  const dailyProbability = daily
    .map((row) => row.precipitationProbabilityMax)
    .filter(isFiniteNumber);
  const dailyAmount = daily
    .map((row) => row.precipitationSum)
    .filter(isFiniteNumber);

  return {
    hourly,
    daily,
    hourlyProbability,
    hourlyAmount,
    dailyProbability,
    dailyAmount,
    freshness,
    hasForecastData:
      hourlyProbability.length > 0 ||
      hourlyAmount.length > 0 ||
      dailyProbability.length > 0 ||
      dailyAmount.length > 0,
    maxHourlyProbability: hourlyProbability.length ? Math.max(...hourlyProbability) : null,
    maxDailyProbability: dailyProbability.length ? Math.max(...dailyProbability) : null,
    next24Amount: hourlyAmount.length
      ? hourlyAmount.reduce((sum, amount) => sum + amount, 0)
      : null,
    next7Amount: dailyAmount.length
      ? dailyAmount.reduce((sum, amount) => sum + amount, 0)
      : null,
    hasRainSignal:
      hourlyProbability.some((value) => value > 0) ||
      hourlyAmount.some((value) => value > 0) ||
      dailyProbability.some((value) => value > 0) ||
      dailyAmount.some((value) => value > 0),
  };
}

function forecastConditions(signals) {
  const conditions = [];
  if (signals.maxHourlyProbability !== null) {
    conditions.push({
      met: true,
      text: `Next 24-hour forecast probability reaches ${formatNumber(signals.maxHourlyProbability, 0)}% (chance of precipitation, not an amount).`,
    });
  }
  if (signals.next24Amount !== null) {
    conditions.push({
      met: true,
      text: `Next 24-hour expected precipitation totals ${formatNumber(signals.next24Amount)} mm (forecast amount, not a probability).`,
    });
  }
  if (signals.maxDailyProbability !== null) {
    conditions.push({
      met: true,
      text: `Across the next 7 days, daily forecast probability reaches ${formatNumber(signals.maxDailyProbability, 0)}%.`,
    });
  }
  if (signals.next7Amount !== null) {
    conditions.push({
      met: true,
      text: `Across the next 7 days, daily expected precipitation totals ${formatNumber(signals.next7Amount)} mm.`,
    });
  }
  if (signals.hasRainSignal) {
    conditions.push({
      met: true,
      text: 'Rain is forecast as a model signal; this does not guarantee that useful rain will occur at the field.',
    });
  } else {
    conditions.push({
      met: false,
      text: 'No positive precipitation probability or amount was present in the available forecast values.',
    });
  }
  return conditions;
}

function missingInformation(input, signals) {
  const missing = [];
  if (!input?.location?.trim()) missing.push('location');
  if (!input?.crop?.trim()) missing.push('crop');
  if (input?.cropAge === '' || input?.cropAge === undefined || input?.cropAge === null) {
    missing.push('crop age');
  } else if (!Number.isFinite(Number(input.cropAge)) || Number(input.cropAge) < 0) {
    missing.push('a valid crop age');
  }
  if (!input?.lastIrrigation) {
    missing.push('last irrigation date/time');
  } else if (Number.isNaN(new Date(input.lastIrrigation).getTime())) {
    missing.push('a valid last irrigation date/time');
  }
  if (!VALID_SOIL_CONDITIONS.has(input?.soilCondition)) {
    missing.push('observed soil condition');
  } else if (input.soilCondition === 'Not Sure') {
    missing.push('a clearer observed soil condition');
  }
  if (!signals.hasForecastData) missing.push('usable precipitation forecast data');
  if (!signals.freshness.fresh) missing.push('a fresh weather forecast');
  return missing;
}

function nextStepsForMissing(input, missing) {
  const steps = [];
  const stepByMissing = {
    location: 'Enter the farm location.',
    crop: 'Enter the crop name.',
    'crop age': 'Enter the crop age in days.',
    'a valid crop age': 'Correct the crop age to a number of days that is 0 or more.',
    'last irrigation date/time': 'Enter when the last irrigation happened.',
    'a valid last irrigation date/time': 'Correct the last irrigation date and time.',
    'observed soil condition': 'Select the observed soil condition.',
    'a clearer observed soil condition': 'Check the field and select Dry, Moist, or Wet if you can.',
    'usable precipitation forecast data': 'Refresh the weather forecast and wait for usable precipitation fields.',
    'a fresh weather forecast': 'Refresh the weather forecast before reassessing.',
  };
  missing.forEach((item) => {
    if (stepByMissing[item]) steps.push(stepByMissing[item]);
  });
  if (input?.rainfall?.trim()) {
    steps.push('Keep the farmer-observed rainfall separate from the forecast when checking the field.');
  }
  return steps;
}

export function evaluateIrrigationDecision(input, weather) {
  const signals = forecastSignals(weather);
  const missing = missingInformation(input, signals);
  const location = input?.location?.trim() || 'the entered location';
  const crop = input?.crop?.trim() || 'the entered crop';
  const conditions = [
    { met: Boolean(input?.location?.trim()), text: `Location: ${location}.` },
    { met: Boolean(input?.crop?.trim()), text: `Crop: ${crop}. Crop identity is recorded as context, not used with an invented water-use threshold.` },
    {
      met: input?.cropAge !== '' && Number.isFinite(Number(input?.cropAge)) && Number(input.cropAge) >= 0,
      text: `Crop age: ${input?.cropAge === undefined || input?.cropAge === '' ? 'not provided' : `${input.cropAge} days`}.`,
    },
    {
      met: signals.freshness.fresh,
      text: signals.freshness.fresh
        ? 'Forecast fetch timestamp is within the initial 60-minute software freshness policy.'
        : signals.freshness.reason,
    },
    {
      met: Boolean(input?.lastIrrigation) && !Number.isNaN(new Date(input.lastIrrigation).getTime()),
      text: input?.lastIrrigation
        ? `Last irrigation recorded at ${formatDateTime(input.lastIrrigation)}; elapsed time is shown as context, not treated as a universal cutoff.`
        : 'Last irrigation date/time was not provided.',
    },
    {
      met: VALID_SOIL_CONDITIONS.has(input?.soilCondition) && input.soilCondition !== 'Not Sure',
      text: `Observed soil condition: ${input?.soilCondition || 'not provided'}.`,
    },
    {
      met: true,
      text: input?.rainfall?.trim()
        ? `Recent rainfall observation: ${input.rainfall.trim()}. This is farmer-reported context, separate from the forecast.`
        : 'Recent rainfall observation was not provided (optional).',
    },
    ...forecastConditions(signals),
  ];

  if (missing.length > 0) {
    return {
      label: DECISION_LABELS.MORE_INFO,
      conditions,
      missing,
      signals,
      nextSteps: nextStepsForMissing(input, missing),
      disclaimer: 'This experimental prototype cannot screen the situation reliably until the missing information is available. Refresh the weather forecast before reassessing.',
    };
  }

  const soil = input.soilCondition;
  const label = soil === 'Dry' ? DECISION_LABELS.REVIEW : DECISION_LABELS.WAIT;
  const soilText = soil === 'Dry'
    ? 'The observed soil condition is Dry, so irrigation may need review.'
    : `The observed soil condition is ${soil}, so wait and reassess field conditions rather than treating the forecast as a skip-irrigation instruction.`;

  return {
    label,
    conditions: [
      ...conditions,
      { met: true, text: soilText },
      ...(signals.hasRainSignal
        ? [{ met: true, text: 'Because rain is forecast, reassess near the decision time; forecast probability and amount are uncertain and do not by themselves justify skipping irrigation.' }]
        : [{ met: false, text: 'No rain signal was found in the available forecast, but this prototype still does not prescribe an irrigation quantity or schedule.' }]),
    ],
    nextSteps: label === DECISION_LABELS.REVIEW
      ? [
          `Inspect the field condition again before deciding; the current observation is ${soil}.`,
          `Consider the ${input.crop.trim()} crop stage (${input.cropAge} days) and when it was last irrigated.`,
          input.rainfall?.trim()
            ? 'Compare the farmer-observed rainfall with the forecast; they are different sources.'
            : 'If rain has occurred at the farm, record it separately from the forecast.',
          'Use the forecast as context, not as proof that irrigation is required.',
        ]
      : [
          'Recheck the field condition before deciding.',
          signals.hasRainSignal
            ? 'Check the forecast again closer to the decision time; forecast rain is not guaranteed.'
            : 'Check the forecast again if conditions change or before the next decision.',
          'Do not skip irrigation automatically because rain is forecast; use the field observation and recent irrigation history.',
        ],
    missing: [],
    signals,
    disclaimer: 'Experimental rule-based prototype only; not a validated agronomic recommendation system.',
  };
}
