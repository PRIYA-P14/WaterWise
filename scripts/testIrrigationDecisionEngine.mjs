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

const baseInput = {
  location: 'Matara, Galle',
  crop: 'Tomato',
  cropAge: '30',
  lastIrrigation: '2026-10-16T07:00',
  rainfall: '',
  soilCondition: 'Dry',
};

const weather = {
  fetchedAt: new Date().toISOString(),
  current: { time: '2026-10-17T09:00' },
  hourly: [
    { time: '2026-10-17T09:00', precipitationProbability: 65, precipitation: 1.2 },
    { time: '2026-10-17T10:00', precipitationProbability: 20, precipitation: 0 },
  ],
  daily: [
    { precipitationProbabilityMax: 70, precipitationSum: 4.5 },
    { precipitationProbabilityMax: 30, precipitationSum: 0 },
  ],
};

console.log('\n[1] Dry soil with forecast rain remains a review, not a skip instruction');
{
  const result = evaluateIrrigationDecision(baseInput, weather);
  assert(result.label === DECISION_LABELS.REVIEW, 'dry soil → irrigation may need review');
  assert(result.conditions.some((condition) => condition.text.includes('65%')), 'probability is explained');
  assert(result.conditions.some((condition) => condition.text.includes('1.2 mm')), 'amount is explained separately');
  assert(result.conditions.some((condition) => condition.text.includes('do not by themselves justify skipping')), 'rain uncertainty is explained');
  assert(result.nextSteps.some((step) => step.includes('Inspect the field condition')), 'review gives field inspection next step');
  assert(result.nextSteps.some((step) => step.includes('crop stage')), 'review gives crop stage next step');
}

console.log('\n[2] Moist and wet soil wait for reassessment');
for (const soilCondition of ['Moist', 'Wet']) {
  const result = evaluateIrrigationDecision({ ...baseInput, soilCondition }, weather);
  assert(result.label === DECISION_LABELS.WAIT, `${soilCondition} soil → wait and reassess`);
  assert(result.nextSteps.some((step) => step.includes('forecast again')), `${soilCondition} soil → forecast recheck guidance`);
  assert(result.nextSteps.some((step) => step.includes('Do not skip irrigation automatically')), `${soilCondition} soil → no automatic skip guidance`);
}

console.log('\n[3] Missing weather and uncertain soil need more information');
{
  assert(
    evaluateIrrigationDecision(baseInput, null).label === DECISION_LABELS.MORE_INFO,
    'missing forecast → more information needed',
  );
  assert(
    evaluateIrrigationDecision(baseInput, null).nextSteps.some((step) => step.includes('Refresh the weather forecast')),
    'missing forecast → refresh next step',
  );
  assert(
    evaluateIrrigationDecision({ ...baseInput, soilCondition: 'Not Sure' }, weather).label === DECISION_LABELS.MORE_INFO,
    'Not Sure soil → more information needed',
  );
  assert(
    evaluateIrrigationDecision({ ...baseInput, soilCondition: 'Not Sure' }, weather).nextSteps.some((step) => step.includes('Check the field')),
    'Not Sure soil → check field next step',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
