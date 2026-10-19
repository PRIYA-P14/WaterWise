import { FORECAST_FRESHNESS_WINDOW_MS, validateForecastFreshness } from '../src/services/forecastFreshness.js';
import { DECISION_LABELS, evaluateIrrigationDecision } from '../src/irrigationDecisionEngine.js';

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`);
  }
}

const now = Date.parse('2026-10-17T12:00:00.000Z');
const input = {
  location: 'Matara, Galle',
  crop: 'Tomato',
  cropAge: '30',
  lastIrrigation: '2026-10-17T07:00',
  rainfall: '',
  soilCondition: 'Dry',
};
const weather = (fetchedAt) => ({
  fetchedAt,
  current: { time: '2026-10-17T12:00' },
  hourly: [{ time: '2026-10-17T12:00', precipitationProbability: 20, precipitation: 0 }],
  daily: [{ date: '2026-10-17', precipitationProbabilityMax: 20, precipitationSum: 0 }],
});

console.log('\n[1] Fresh forecast');
{
  const result = validateForecastFreshness(weather(new Date(now - 30 * 60 * 1000).toISOString()), now);
  assert(result.fresh, '30-minute-old forecast is fresh');
  assert(evaluateIrrigationDecision(input, weather(new Date().toISOString())).label === DECISION_LABELS.REVIEW, 'fresh forecast preserves existing rule');
}

console.log('\n[2] Older than 60 minutes');
{
  const result = validateForecastFreshness(weather(new Date(now - FORECAST_FRESHNESS_WINDOW_MS - 1).toISOString()), now);
  assert(!result.fresh && result.reason.includes('more than 60 minutes'), 'older forecast is stale');
  const staleDecision = evaluateIrrigationDecision(input, weather(new Date(now - FORECAST_FRESHNESS_WINDOW_MS - 1).toISOString()));
  assert(staleDecision.label === DECISION_LABELS.MORE_INFO, 'stale forecast blocks decision');
  assert(staleDecision.nextSteps.some((step) => step.includes('Refresh the weather forecast')), 'stale forecast explains refresh next step');
}

console.log('\n[3] Exactly 60 minutes old');
assert(validateForecastFreshness(weather(new Date(now - FORECAST_FRESHNESS_WINDOW_MS).toISOString()), now).fresh, 'exactly 60 minutes is fresh');

console.log('\n[4] Missing and invalid fetchedAt');
assert(!validateForecastFreshness(weather(undefined), now).fresh, 'missing fetchedAt is not fresh');
assert(!validateForecastFreshness(weather('not-a-timestamp'), now).fresh, 'invalid fetchedAt is not fresh');

console.log('\n[5] Future fetchedAt');
assert(!validateForecastFreshness(weather(new Date(now + 1).toISOString()), now).fresh, 'future fetchedAt is not accepted');

console.log('\n[6] Missing precipitation fields');
{
  const missingWeather = {
    fetchedAt: new Date(now).toISOString(),
    current: { time: '2026-10-17T12:00' },
    hourly: [{ time: '2026-10-17T12:00' }],
    daily: [{ date: '2026-10-17' }],
  };
  const result = evaluateIrrigationDecision(input, missingWeather);
  assert(result.label === DECISION_LABELS.MORE_INFO, 'missing precipitation fields need more information');
  assert(result.signals.next24Amount === null && result.signals.next7Amount === null, 'missing amounts remain unavailable');
  assert(result.nextSteps.some((step) => step.includes('Refresh the weather forecast')), 'missing precipitation fields explain refresh next step');
}

console.log('\n[7] Weather refresh failure');
{
  const result = evaluateIrrigationDecision(input, weather(new Date(now - FORECAST_FRESHNESS_WINDOW_MS - 1).toISOString()));
  assert(result.label === DECISION_LABELS.MORE_INFO && result.disclaimer.includes('Refresh'), 'refresh failure state remains non-decisive');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
