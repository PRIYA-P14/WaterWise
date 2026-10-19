import { selectNext24HourlyForecast } from '../src/services/hourlyForecast.js';

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

function rows(times) {
  return times.map((time, index) => ({ time, id: index }));
}

console.log('\n[1] Current time at start of day');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T00:00', '2026-10-17T01:00', '2026-10-17T02:00']),
    '2026-10-17T00:00',
  );
  assert(result[0].time === '2026-10-17T00:00', 'includes exact current-hour record');
}

console.log('\n[2] Current time in the middle of the day');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T08:00', '2026-10-17T09:00', '2026-10-17T10:00', '2026-10-17T11:00']),
    '2026-10-17T10:00',
  );
  assert(result.map((row) => row.time).join(',') === '2026-10-17T10:00,2026-10-17T11:00', 'excludes earlier same-day records');
}

console.log('\n[3] Current time between hourly timestamps');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T10:00', '2026-10-17T11:00', '2026-10-17T12:00']),
    '2026-10-17T10:30',
  );
  assert(result[0].time === '2026-10-17T11:00', 'starts at the next available hourly record');
}

console.log('\n[4] Missing current timestamp');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T08:00', '2026-10-17T09:00']),
    null,
  );
  assert(result[0].time === '2026-10-17T08:00', 'falls back to earliest valid forecast record');
}

console.log('\n[5] Fewer than 24 future records');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T00:00', '2026-10-17T01:00', '2026-10-17T02:00']),
    '2026-10-17T01:00',
  );
  assert(result.length === 2, 'returns all available future records without padding');
}

console.log('\n[6] Local timezone and date boundary');
{
  const result = selectNext24HourlyForecast(
    rows(['2026-10-17T23:00', '2026-10-18T00:00', '2026-10-18T01:00']),
    '2026-10-18T00:00',
  );
  assert(
    result.map((row) => row.time).join(',') === '2026-10-18T00:00,2026-10-18T01:00',
    'compares local forecast date boundary without browser timezone conversion',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
