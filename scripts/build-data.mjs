import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OPEN_F1_BASE_URL = 'https://api.openf1.org/v1';
const rootDir = process.cwd();
const outputDir = path.resolve(rootDir, 'public', 'data');
const grandPrixDir = path.resolve(outputDir, 'grands-prix');
const sprintDir = path.resolve(outputDir, 'sprints');
const now = new Date();
const maxSessionsPerType = Number.parseInt(process.env.MAX_SESSIONS_PER_TYPE ?? process.env.MAX_RACES ?? '5', 10);
const requestIntervalMs = Number.parseInt(process.env.OPENF1_MIN_INTERVAL_MS ?? '360', 10);
const telemetryBinCount = 100;

let lastRequestStartedAt = 0;

function formatDate(isoString) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(isoString));
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toMillis(isoString) {
  return new Date(isoString).getTime();
}

function addSeconds(isoString, seconds) {
  return new Date(toMillis(isoString) + seconds * 1000).toISOString();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseGap(value, fallback = null) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.includes('LAP')) {
      return null;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function quantile(sortedValues, ratio) {
  if (!sortedValues.length) {
    return null;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function median(values) {
  return quantile([...values].sort((left, right) => left - right), 0.5);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function groupBy(items, keySelector) {
  const groups = new Map();

  for (const item of items) {
    const key = keySelector(item);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return groups;
}

function buildSummaryStats(values) {
  const sortedValues = [...values].sort((left, right) => left - right);

  if (!sortedValues.length) {
    return {
      count: 0,
      min: null,
      q1: null,
      median: null,
      q3: null,
      max: null,
      mean: null,
      standardDeviation: null,
    };
  }

  return {
    count: sortedValues.length,
    min: sortedValues[0],
    q1: quantile(sortedValues, 0.25),
    median: quantile(sortedValues, 0.5),
    q3: quantile(sortedValues, 0.75),
    max: sortedValues[sortedValues.length - 1],
    mean: average(sortedValues),
    standardDeviation: standardDeviation(sortedValues),
  };
}

function linearRegression(points) {
  if (points.length < 2) {
    return null;
  }

  const xMean = average(points.map((point) => point.x));
  const yMean = average(points.map((point) => point.y));
  const numerator = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) * (point.x - xMean), 0);

  if (!denominator) {
    return null;
  }

  return numerator / denominator;
}

function durationToSeconds(startIso, endIso) {
  const diff = (toMillis(endIso) - toMillis(startIso)) / 1000;
  return Number.isFinite(diff) ? diff : null;
}

function formatWeatherTag(summary) {
  if (!summary) {
    return 'Weather unavailable';
  }

  const air = Number.isFinite(summary.airTemperatureAvg) ? `${summary.airTemperatureAvg.toFixed(1)}C air` : null;
  const track = Number.isFinite(summary.trackTemperatureAvg)
    ? `${summary.trackTemperatureAvg.toFixed(1)}C track`
    : null;
  const wet = summary.rainy ? 'Rain detected' : 'Dry session';

  return [air, track, wet].filter(Boolean).join(' | ');
}

async function fetchOpenF1(endpoint, params = {}) {
  const url = new URL(`${OPEN_F1_BASE_URL}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nowMs = Date.now();
    const waitMs = Math.max(0, lastRequestStartedAt + requestIntervalMs - nowMs);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    lastRequestStartedAt = Date.now();
    const response = await fetch(url);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number.parseFloat(response.headers.get('retry-after') ?? '');
      const backoffMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : (attempt + 1) * 1750;
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`OpenF1 request failed for ${url.toString()} with status ${response.status}`);
  }

  throw new Error(`OpenF1 request failed for ${url.toString()} after retries.`);
}

function sampleSeriesAtLapEnds(series, lapEnds, valueSelector) {
  if (!series.length || !lapEnds.length) {
    return [];
  }

  let seriesIndex = 0;
  let currentValue = null;

  return lapEnds.map(({ lap, lapEndIso }) => {
    const lapEndMillis = toMillis(lapEndIso);

    while (seriesIndex < series.length && toMillis(series[seriesIndex].date) <= lapEndMillis) {
      currentValue = valueSelector(series[seriesIndex], currentValue);
      seriesIndex += 1;
    }

    return {
      lap,
      value: currentValue,
    };
  });
}

function buildDriverResult(result) {
  if (!result) {
    return {
      position: null,
      lapsCompleted: 0,
      status: 'Unknown',
      points: 0,
      gapToLeader: null,
      durationSeconds: null,
    };
  }

  let status = 'Finished';

  if (result.dsq) {
    status = 'DSQ';
  } else if (result.dns) {
    status = 'DNS';
  } else if (result.dnf) {
    status = 'DNF';
  }

  return {
    position: result.position,
    lapsCompleted: result.number_of_laps ?? 0,
    status,
    points: result.points ?? 0,
    gapToLeader: parseGap(result.gap_to_leader),
    durationSeconds: result.duration ?? null,
  };
}

function getWeatherSummary(weatherRows) {
  if (!weatherRows.length) {
    return null;
  }

  const air = weatherRows.map((row) => row.air_temperature).filter(Number.isFinite);
  const track = weatherRows.map((row) => row.track_temperature).filter(Number.isFinite);
  const wind = weatherRows.map((row) => row.wind_speed).filter(Number.isFinite);
  const rainfall = weatherRows.map((row) => row.rainfall).filter(Number.isFinite);

  return {
    airTemperatureAvg: average(air),
    airTemperatureMin: air.length ? Math.min(...air) : null,
    airTemperatureMax: air.length ? Math.max(...air) : null,
    trackTemperatureAvg: average(track),
    trackTemperatureMin: track.length ? Math.min(...track) : null,
    trackTemperatureMax: track.length ? Math.max(...track) : null,
    windSpeedAvg: average(wind),
    windSpeedMax: wind.length ? Math.max(...wind) : null,
    rainfallTotal: rainfall.length ? rainfall.reduce((sum, value) => sum + value, 0) : null,
    rainy: rainfall.some((value) => value > 0),
  };
}

function buildSessionType(sessionName) {
  return sessionName === 'Sprint'
    ? {
        key: 'sprint',
        label: 'Sprint',
        directoryName: 'sprints',
      }
    : {
        key: 'grand-prix',
        label: 'Grand Prix',
        directoryName: 'grands-prix',
      };
}

function buildNeutralizationData(raceControlRows, totalLaps) {
  const sortedRows = [...raceControlRows].sort((left, right) => toMillis(left.date) - toMillis(right.date));
  const periods = [];
  const lapStatus = new Map(Array.from({ length: totalLaps }, (_, index) => [index + 1, 'GREEN']));
  let activePeriod = null;

  for (const row of sortedRows) {
    const message = String(row.message ?? '').toUpperCase();
    let type = null;
    let event = null;

    if (/^VIRTUAL SAFETY CAR/.test(message)) {
      type = 'VSC';
      if (message.includes('DEPLOYED')) {
        event = 'start';
      } else if (message.includes('ENDING') || message.includes('ENDED')) {
        event = 'end';
      }
    } else if (row.category === 'SafetyCar' && /^SAFETY CAR/.test(message)) {
      type = 'SC';
      if (message.includes('DEPLOYED')) {
        event = 'start';
      } else if (message.includes('IN THIS LAP')) {
        event = 'end';
      }
    }

    if (!type || !event) {
      continue;
    }

    const lapNumber = clamp(Number(row.lap_number) || 1, 1, Math.max(totalLaps, 1));

    if (event === 'start') {
      if (activePeriod) {
        periods.push({
          ...activePeriod,
          endLap: clamp(activePeriod.startLap, activePeriod.startLap, totalLaps),
          endDate: row.date,
        });
      }

      activePeriod = {
        type,
        startLap: lapNumber,
        startDate: row.date,
        startMessage: row.message,
      };
    } else if (activePeriod && activePeriod.type === type) {
      periods.push({
        ...activePeriod,
        endLap: lapNumber,
        endDate: row.date,
        endMessage: row.message,
      });
      activePeriod = null;
    }
  }

  if (activePeriod) {
    periods.push({
      ...activePeriod,
      endLap: totalLaps,
      endDate: null,
      endMessage: 'Session ended before neutralization was explicitly closed.',
    });
  }

  for (const period of periods) {
    for (let lap = period.startLap; lap <= period.endLap; lap += 1) {
      lapStatus.set(lap, period.type);
    }
  }

  return {
    periods,
    lapStatus,
  };
}

function buildRankSnapshot(pointsMap) {
  const entries = [...pointsMap.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]);
  const positions = new Map(entries.map(([driverNumber], index) => [driverNumber, index + 1]));
  const ambiguous = new Set();
  const byPoints = groupBy(entries, ([, points]) => points);

  for (const tiedEntries of byPoints.values()) {
    if (tiedEntries.length > 1) {
      for (const [driverNumber] of tiedEntries) {
        ambiguous.add(driverNumber);
      }
    }
  }

  return {
    positions,
    ambiguous,
  };
}

async function buildChampionshipSnapshots(scoringSessions) {
  const sessionResultsByKey = new Map();

  for (const session of scoringSessions) {
    sessionResultsByKey.set(
      session.session_key,
      await fetchOpenF1('session_result', { session_key: session.session_key }),
    );
  }

  const runningTotals = new Map();
  const snapshots = new Map();

  for (const session of scoringSessions) {
    const results = sessionResultsByKey.get(session.session_key) ?? [];
    const beforeTotals = new Map(runningTotals);

    for (const result of results) {
      const previousPoints = runningTotals.get(result.driver_number) ?? 0;
      runningTotals.set(result.driver_number, previousPoints + (result.points ?? 0));
    }

    const afterTotals = new Map(runningTotals);
    const beforeRanks = buildRankSnapshot(beforeTotals);
    const afterRanks = buildRankSnapshot(afterTotals);
    const snapshot = new Map();
    const driverNumbers = new Set([
      ...beforeTotals.keys(),
      ...afterTotals.keys(),
      ...results.map((result) => result.driver_number),
    ]);
    const resultsByDriver = new Map(results.map((result) => [result.driver_number, result]));

    for (const driverNumber of driverNumbers) {
      const positionBefore = beforeRanks.positions.get(driverNumber) ?? null;
      const positionAfter = afterRanks.positions.get(driverNumber) ?? null;
      const isAmbiguous =
        beforeRanks.ambiguous.has(driverNumber) || afterRanks.ambiguous.has(driverNumber);

      snapshot.set(driverNumber, {
        eventPoints: resultsByDriver.get(driverNumber)?.points ?? 0,
        pointsBefore: beforeTotals.get(driverNumber) ?? 0,
        pointsAfter: afterTotals.get(driverNumber) ?? 0,
        positionBefore,
        positionAfter,
        positionDelta:
          isAmbiguous || positionBefore === null || positionAfter === null
            ? null
            : positionBefore - positionAfter,
      });
    }

    snapshots.set(session.session_key, snapshot);
  }

  return snapshots;
}

function buildWeatherTimeline(weatherRows) {
  return [...weatherRows]
    .sort((left, right) => toMillis(left.date) - toMillis(right.date))
    .map((row) => ({
      date: row.date,
      airTemperature: row.air_temperature ?? null,
      trackTemperature: row.track_temperature ?? null,
      windSpeed: row.wind_speed ?? null,
      rainfall: row.rainfall ?? null,
      humidity: row.humidity ?? null,
    }));
}

function buildTransparency(summary) {
  return [
    {
      key: 'track-temperature',
      label: 'Track temperature',
      availability: summary.weather ? 'direct' : 'unavailable',
      note: summary.weather
        ? 'Directly sourced from the OpenF1 weather feed. Header values use the session average and the weather chart uses the minute-by-minute timeline.'
        : 'Weather rows were not available for this session.',
    },
    {
      key: 'event-duration',
      label: 'Event duration',
      availability: Number.isFinite(summary.eventDurationSeconds) ? 'direct' : 'unavailable',
      note: 'Computed directly from the session start and end timestamps supplied by OpenF1.',
    },
    {
      key: 'used-compounds',
      label: 'Compounds effectively used',
      availability: summary.usedCompounds.length ? 'direct' : 'unavailable',
      note: 'Derived from the compounds present in recorded stints, so only compounds actually used in the session are shown.',
    },
    {
      key: 'pit-stop-duration',
      label: 'Pit stop duration',
      availability: summary.totalPitStops ? 'direct' : 'unavailable',
      note:
        'Uses OpenF1 pit-lane duration (`lane_duration`) directly. Stationary `stop_duration` is exposed in tooltips when OpenF1 provides it.',
    },
    {
      key: 'pit-stop-time-loss',
      label: 'Pit stop time loss',
      availability: summary.totalPitStops ? 'estimated' : 'unavailable',
      note:
        'Estimated as pit lap plus out lap time minus twice the local green-flag baseline lap time for the same driver.',
    },
    {
      key: 'corner-speed-references',
      label: 'Representative corner speeds',
      availability: summary.hasCornerSpeedReferences ? 'inferred' : 'unavailable',
      note:
        'Inferred from the fastest representative green lap of each driver, normalized to 100 lap-distance bins, then sampled at three session reference minima.',
    },
    {
      key: 'championship-totals',
      label: 'Championship totals after event',
      availability: 'inferred',
      note:
        'Computed from chronologically ordered sprint and race points in the season. Position delta is omitted when points-only ranking would be ambiguous because of ties.',
    },
    {
      key: 'start-gain-loss',
      label: 'Start gain / loss',
      availability: 'inferred',
      note:
        'Starting order is inferred from the earliest recorded session positions, then compared with the position at the end of lap 1.',
    },
  ];
}

function selectReferenceLap(driverLaps, lapStatusByLap, pitStopsByLap) {
  return driverLaps
    .filter((lap) => {
      if (!Number.isFinite(lap.lap_duration)) {
        return false;
      }

      if (lap.is_pit_out_lap) {
        return false;
      }

      if (pitStopsByLap.has(lap.lap_number) || pitStopsByLap.has(lap.lap_number - 1)) {
        return false;
      }

      return (lapStatusByLap.get(lap.lap_number) ?? 'GREEN') === 'GREEN' && lap.lap_number > 1;
    })
    .sort((left, right) => left.lap_duration - right.lap_duration)[0];
}

function buildNormalizedSpeedProfile(carDataRows, startIso, endIso) {
  const startMillis = toMillis(startIso);
  const endMillis = toMillis(endIso);
  const duration = endMillis - startMillis;

  if (!Number.isFinite(duration) || duration <= 0) {
    return Array.from({ length: telemetryBinCount }, () => null);
  }

  const buckets = Array.from({ length: telemetryBinCount }, () => []);

  for (const row of carDataRows) {
    if (!Number.isFinite(row.speed)) {
      continue;
    }

    const progress = clamp((toMillis(row.date) - startMillis) / duration, 0, 0.999999);
    const bucketIndex = Math.min(telemetryBinCount - 1, Math.floor(progress * telemetryBinCount));
    buckets[bucketIndex].push(row.speed);
  }

  return buckets.map((bucket) => (bucket.length ? average(bucket) : null));
}

function averageProfiles(profiles) {
  return Array.from({ length: telemetryBinCount }, (_, index) => {
    const values = profiles.map((profile) => profile[index]).filter(Number.isFinite);
    return values.length ? average(values) : null;
  });
}

function selectCornerReferenceBins(profile) {
  const minima = [];

  for (let index = 3; index < profile.length - 3; index += 1) {
    const value = profile[index];
    const previous = profile[index - 1];
    const next = profile[index + 1];

    if (!Number.isFinite(value) || !Number.isFinite(previous) || !Number.isFinite(next)) {
      continue;
    }

    if (value <= previous && value <= next) {
      minima.push({ bin: index, speed: value });
    }
  }

  const uniqueMinima = [];

  for (const candidate of minima.sort((left, right) => left.speed - right.speed)) {
    if (uniqueMinima.every((selected) => Math.abs(selected.bin - candidate.bin) >= 10)) {
      uniqueMinima.push(candidate);
    }
  }

  const fallbackCandidates = profile
    .map((speed, bin) => ({ speed, bin }))
    .filter((entry) => Number.isFinite(entry.speed))
    .sort((left, right) => left.speed - right.speed);

  while (uniqueMinima.length < 3 && fallbackCandidates.length) {
    const candidate = fallbackCandidates.shift();

    if (uniqueMinima.every((selected) => Math.abs(selected.bin - candidate.bin) >= 10)) {
      uniqueMinima.push(candidate);
    }
  }

  if (uniqueMinima.length < 3) {
    return [];
  }

  const sortedBySpeed = [...uniqueMinima].sort((left, right) => left.speed - right.speed);
  const low = sortedBySpeed[0];
  const medium = sortedBySpeed[Math.floor((sortedBySpeed.length - 1) / 2)];
  const high = sortedBySpeed[sortedBySpeed.length - 1];

  return [
    {
      key: 'low',
      label: 'Low-speed corner',
      bin: low.bin,
      referenceSpeed: low.speed,
    },
    {
      key: 'medium',
      label: 'Medium-speed corner',
      bin: medium.bin,
      referenceSpeed: medium.speed,
    },
    {
      key: 'high',
      label: 'High-speed corner',
      bin: high.bin,
      referenceSpeed: high.speed,
    },
  ];
}

function extractCornerSpeeds(profile, referencePoints) {
  const result = {};

  for (const point of referencePoints) {
    const values = [profile[point.bin - 1], profile[point.bin], profile[point.bin + 1]].filter(Number.isFinite);
    result[point.key] = values.length ? average(values) : null;
  }

  return result;
}

function buildCompoundUsage(stints) {
  const compoundTotals = new Map();

  for (const stint of stints) {
    const previous = compoundTotals.get(stint.compound) ?? 0;
    compoundTotals.set(stint.compound, previous + stint.length);
  }

  return [...compoundTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([compound, laps]) => ({
      compound,
      laps,
    }));
}

function findStintForLap(stints, lapNumber) {
  return stints.find((stint) => lapNumber >= stint.lapStart && lapNumber <= stint.lapEnd) ?? null;
}

function estimatePitTimeLoss(pitStop, lapMap, lapStatusByLap, pitStopsByLap) {
  const candidateLaps = [];

  for (let lapNumber = pitStop.lapNumber - 3; lapNumber <= pitStop.lapNumber + 4; lapNumber += 1) {
    if (lapNumber === pitStop.lapNumber || lapNumber === pitStop.lapNumber + 1) {
      continue;
    }

    if (pitStopsByLap.has(lapNumber) || pitStopsByLap.has(lapNumber - 1)) {
      continue;
    }

    const lap = lapMap.get(lapNumber);

    if (!lap || !Number.isFinite(lap.lapTime)) {
      continue;
    }

    if (lap.isPitOutLap) {
      continue;
    }

    if ((lapStatusByLap.get(lapNumber) ?? 'GREEN') !== 'GREEN') {
      continue;
    }

    candidateLaps.push(lap.lapTime);
  }

  const baseline = median(candidateLaps);
  const pitLap = lapMap.get(pitStop.lapNumber);
  const outLap = lapMap.get(pitStop.lapNumber + 1);

  if (!Number.isFinite(baseline) || !pitLap || !outLap) {
    return {
      estimatedTimeLoss: null,
      baselineLapCount: candidateLaps.length,
    };
  }

  if (!Number.isFinite(pitLap.lapTime) || !Number.isFinite(outLap.lapTime)) {
    return {
      estimatedTimeLoss: null,
      baselineLapCount: candidateLaps.length,
    };
  }

  return {
    estimatedTimeLoss: pitLap.lapTime + outLap.lapTime - baseline * 2,
    baselineLapCount: candidateLaps.length,
  };
}

function buildDriverLapDetails(driverLaps, stints, lapStatusByLap, pitStops) {
  const pitStopsByLap = new Map(pitStops.map((pitStop) => [pitStop.lap_number, pitStop]));

  return driverLaps.map((lap) => {
    const matchingStint = findStintForLap(stints, lap.lap_number);
    const tyreAge =
      matchingStint && Number.isFinite(matchingStint.tyreAgeAtStart)
        ? matchingStint.tyreAgeAtStart + (lap.lap_number - matchingStint.lapStart)
        : matchingStint
          ? lap.lap_number - matchingStint.lapStart
          : null;
    const isPitLap = pitStopsByLap.has(lap.lap_number);
    const isPitOutLap = Boolean(lap.is_pit_out_lap) || pitStopsByLap.has(lap.lap_number - 1);
    const lapStatus = lapStatusByLap.get(lap.lap_number) ?? 'GREEN';
    const isRepresentative =
      Number.isFinite(lap.lap_duration) &&
      lap.lap_number > 1 &&
      !isPitLap &&
      !isPitOutLap &&
      lapStatus === 'GREEN';

    return {
      lapNumber: lap.lap_number,
      dateStart: lap.date_start,
      lapTime: lap.lap_duration ?? null,
      sector1: lap.duration_sector_1 ?? null,
      sector2: lap.duration_sector_2 ?? null,
      sector3: lap.duration_sector_3 ?? null,
      i1Speed: lap.i1_speed ?? null,
      i2Speed: lap.i2_speed ?? null,
      stSpeed: lap.st_speed ?? null,
      compound: matchingStint?.compound ?? null,
      stintNumber: matchingStint?.stintNumber ?? null,
      tyreAge,
      isPitLap,
      isPitOutLap,
      lapStatus,
      isRepresentative,
    };
  });
}

function buildTeammateLinks(driverCards) {
  const teams = groupBy(driverCards, (driver) => driver.teamName);

  for (const drivers of teams.values()) {
    if (drivers.length !== 2) {
      continue;
    }

    drivers[0].teammateDriverNumber = drivers[1].driverNumber;
    drivers[1].teammateDriverNumber = drivers[0].driverNumber;
  }
}

async function buildSpeedMetrics(sessionKey, driverCards) {
  const profiles = new Map();

  for (const driver of driverCards) {
    if (!driver.referenceLap) {
      continue;
    }

    const lapEndIso = addSeconds(driver.referenceLap.dateStart, driver.referenceLap.lapTime);
    let carDataRows = [];

    try {
      carDataRows = await fetchOpenF1('car_data', {
        session_key: sessionKey,
        driver_number: driver.driverNumber,
      });
    } catch (error) {
      console.warn(`Skipping corner speed profile for ${driver.code}: ${error.message}`);
      continue;
    }

    const profile = buildNormalizedSpeedProfile(
      carDataRows.filter((row) => {
        const rowMillis = toMillis(row.date);
        return rowMillis >= toMillis(driver.referenceLap.dateStart) && rowMillis < toMillis(lapEndIso);
      }),
      driver.referenceLap.dateStart,
      lapEndIso,
    );

    if (profile.some(Number.isFinite)) {
      profiles.set(driver.driverNumber, profile);
    }
  }

  const sessionProfile = averageProfiles([...profiles.values()]);
  const referencePoints = selectCornerReferenceBins(sessionProfile);

  for (const driver of driverCards) {
    const profile = profiles.get(driver.driverNumber);
    driver.cornerSpeeds = referencePoints.length && profile ? extractCornerSpeeds(profile, referencePoints) : {};
  }

  return referencePoints.length
    ? {
        method:
          'Reference corner speeds are inferred from each driver fastest representative green lap, normalized to 100 bins. Three local speed minima are used as low, medium and high-speed corner references.',
        points: referencePoints,
      }
    : {
        method: null,
        points: [],
      };
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(grandPrixDir, { recursive: true });
  await mkdir(sprintDir, { recursive: true });

  const raceSessions = await fetchOpenF1('sessions', { session_name: 'Race' });
  const sprintSessions = await fetchOpenF1('sessions', { session_name: 'Sprint' });
  const completedRaceSessions = raceSessions.filter((session) => new Date(session.date_end) <= now);
  const completedSprintSessions = sprintSessions.filter((session) => new Date(session.date_end) <= now);
  const allCompletedSessions = [...completedRaceSessions, ...completedSprintSessions];

  if (!allCompletedSessions.length) {
    throw new Error('No completed race or sprint sessions found in OpenF1.');
  }

  const season = Math.max(...allCompletedSessions.map((session) => session.year));
  const currentSeasonRaceSessions = completedRaceSessions.filter((session) => session.year === season);
  const currentSeasonSprintSessions = completedSprintSessions.filter((session) => session.year === season);
  const currentSeasonScoringSessions = [...currentSeasonRaceSessions, ...currentSeasonSprintSessions].sort(
    (left, right) => toMillis(left.date_start) - toMillis(right.date_start),
  );
  const selectedSessions = [
    ...currentSeasonRaceSessions
      .sort((left, right) => toMillis(right.date_start) - toMillis(left.date_start))
      .slice(0, maxSessionsPerType),
    ...currentSeasonSprintSessions
      .sort((left, right) => toMillis(right.date_start) - toMillis(left.date_start))
      .slice(0, maxSessionsPerType),
  ].sort((left, right) => toMillis(right.date_start) - toMillis(left.date_start));
  const meetingOrder = new Map(
    [...currentSeasonRaceSessions]
      .sort((left, right) => toMillis(left.date_start) - toMillis(right.date_start))
      .map((session, index) => [session.meeting_key, index + 1]),
  );
  const championshipSnapshots = await buildChampionshipSnapshots(currentSeasonScoringSessions);
  const sessionIndexEntries = [];

  for (const session of selectedSessions) {
    const sessionType = buildSessionType(session.session_name);
    const meetingRows = await fetchOpenF1('meetings', { meeting_key: session.meeting_key });
    const drivers = await fetchOpenF1('drivers', { session_key: session.session_key });
    const sessionResults = await fetchOpenF1('session_result', { session_key: session.session_key });
    const laps = await fetchOpenF1('laps', { session_key: session.session_key });
    const positionRows = await fetchOpenF1('position', { session_key: session.session_key });
    const intervalRows = await fetchOpenF1('intervals', { session_key: session.session_key });
    const stintRows = await fetchOpenF1('stints', { session_key: session.session_key });
    const pitRows = await fetchOpenF1('pit', { session_key: session.session_key });
    const raceControlRows = await fetchOpenF1('race_control', { session_key: session.session_key });
    const weatherRows = await fetchOpenF1('weather', { meeting_key: session.meeting_key });

    const meeting = meetingRows[0] ?? {};
    const baseSlug = slugify(meeting.meeting_name ?? session.country_name);
    const slug = sessionType.key === 'sprint' ? `${baseSlug}-sprint` : baseSlug;
    const round = meetingOrder.get(session.meeting_key) ?? null;
    const driversByNumber = new Map(drivers.map((driver) => [driver.driver_number, driver]));
    const resultsByNumber = new Map(sessionResults.map((result) => [result.driver_number, result]));
    const lapsByDriver = groupBy(laps, (lap) => lap.driver_number);
    const positionsByDriver = groupBy(positionRows, (position) => position.driver_number);
    const intervalsByDriver = groupBy(intervalRows, (interval) => interval.driver_number);
    const stintsByDriver = groupBy(stintRows, (stint) => stint.driver_number);
    const pitStopsByDriver = groupBy(pitRows, (pitStop) => pitStop.driver_number);
    const sessionWeather = weatherRows.filter((row) => row.session_key === session.session_key);
    const weatherSummary = getWeatherSummary(sessionWeather);
    const sortedResults = [...sessionResults].sort((left, right) => {
      const leftPosition = left.position ?? 999;
      const rightPosition = right.position ?? 999;
      return leftPosition - rightPosition;
    });
    const totalLaps = Math.max(
      ...sortedResults.map((result) => result.number_of_laps ?? 0),
      ...laps.map((lap) => lap.lap_number ?? 0),
      0,
    );
    const { periods: neutralizationPeriods, lapStatus } = buildNeutralizationData(raceControlRows, totalLaps);
    const lapAxis = Array.from({ length: totalLaps }, (_, index) => index + 1);
    const starters = sessionResults.filter((result) => !result.dns).length;
    const classified = sessionResults.filter((result) => !result.dns && !result.dnf).length;
    const eventDurationSeconds = durationToSeconds(session.date_start, session.date_end);
    const driverNumbers = new Set([
      ...drivers.map((driver) => driver.driver_number),
      ...sessionResults.map((result) => result.driver_number),
    ]);

    const driverCards = [...driverNumbers]
      .map((driverNumber) => {
        const driver = driversByNumber.get(driverNumber);
        const result = resultsByNumber.get(driverNumber);
        const driverLaps = [...(lapsByDriver.get(driverNumber) ?? [])].sort(
          (left, right) => left.lap_number - right.lap_number,
        );
        const lapEnds = driverLaps
          .filter((lap) => Number.isFinite(lap.lap_duration))
          .map((lap) => ({
            lap: lap.lap_number,
            lapEndIso: addSeconds(lap.date_start, lap.lap_duration),
          }));
        const driverPositions = [...(positionsByDriver.get(driverNumber) ?? [])].sort(
          (left, right) => toMillis(left.date) - toMillis(right.date),
        );
        const driverIntervals = [...(intervalsByDriver.get(driverNumber) ?? [])].sort(
          (left, right) => toMillis(left.date) - toMillis(right.date),
        );
        const stints = [...(stintsByDriver.get(driverNumber) ?? [])]
          .sort((left, right) => left.stint_number - right.stint_number)
          .map((stint) => ({
            stintNumber: stint.stint_number,
            compound: stint.compound,
            lapStart: stint.lap_start,
            lapEnd: stint.lap_end,
            tyreAgeAtStart: stint.tyre_age_at_start,
            length: (stint.lap_end ?? stint.lap_start) - stint.lap_start + 1,
          }));
        const rawPitStops = [...(pitStopsByDriver.get(driverNumber) ?? [])].sort(
          (left, right) => left.lap_number - right.lap_number,
        );
        const lapDetails = buildDriverLapDetails(driverLaps, stints, lapStatus, rawPitStops);
        const lapMap = new Map(lapDetails.map((lap) => [lap.lapNumber, lap]));
        const pitStopsByLap = new Map(rawPitStops.map((pitStop) => [pitStop.lap_number, pitStop]));
        const sampledPositions = sampleSeriesAtLapEnds(driverPositions, lapEnds, (entry) => entry.position);
        const sampledGaps = sampleSeriesAtLapEnds(driverIntervals, lapEnds, (entry, previousValue) => {
          const parsedGap = parseGap(entry.gap_to_leader, previousValue);
          return parsedGap ?? previousValue;
        });
        const topSpeed = driverLaps.reduce((maximum, lap) => Math.max(maximum, lap.st_speed ?? 0), 0) || null;
        const resultData = buildDriverResult(result);
        const representativeLaps = lapDetails.filter((lap) => lap.isRepresentative && Number.isFinite(lap.lapTime));
        const averageGreenLap = average(representativeLaps.map((lap) => lap.lapTime));
        const greenLapTimeStdDev = standardDeviation(representativeLaps.map((lap) => lap.lapTime));
        const bestLapSource = representativeLaps.length
          ? representativeLaps.reduce((best, lap) => (lap.lapTime < best.lapTime ? lap : best), representativeLaps[0])
          : null;
        const bestSectors = {
          sector1: Math.min(...lapDetails.map((lap) => lap.sector1).filter(Number.isFinite), Infinity),
          sector2: Math.min(...lapDetails.map((lap) => lap.sector2).filter(Number.isFinite), Infinity),
          sector3: Math.min(...lapDetails.map((lap) => lap.sector3).filter(Number.isFinite), Infinity),
        };
        const referenceLap = selectReferenceLap(driverLaps, lapStatus, pitStopsByLap);
        const firstPositionSample = driverPositions[0]?.position ?? null;
        const lap1Position = sampledPositions.find((entry) => entry.lap === 1)?.value ?? null;
        const championship = championshipSnapshots.get(session.session_key)?.get(driverNumber) ?? {
          eventPoints: resultData.points,
          pointsBefore: null,
          pointsAfter: null,
          positionBefore: null,
          positionAfter: null,
          positionDelta: null,
        };
        const pitStops = rawPitStops.map((pitStop) => {
          const { estimatedTimeLoss, baselineLapCount } = estimatePitTimeLoss(
            {
              lapNumber: pitStop.lap_number,
            },
            lapMap,
            lapStatus,
            pitStopsByLap,
          );

          return {
            date: pitStop.date,
            lapNumber: pitStop.lap_number,
            laneDuration: pitStop.lane_duration ?? pitStop.pit_duration ?? null,
            stopDuration: pitStop.stop_duration ?? null,
            estimatedTimeLoss,
            baselineLapCount,
            lapStatus: lapStatus.get(pitStop.lap_number) ?? 'GREEN',
            underNeutralization: (lapStatus.get(pitStop.lap_number) ?? 'GREEN') !== 'GREEN',
          };
        });
        const stintPerformance = stints.map((stint) => {
          const stintLaps = lapDetails.filter((lap) => lap.stintNumber === stint.stintNumber && lap.isRepresentative);
          const degradationSlope = linearRegression(
            stintLaps
              .filter((lap) => Number.isFinite(lap.tyreAge) && Number.isFinite(lap.lapTime))
              .map((lap) => ({
                x: lap.tyreAge,
                y: lap.lapTime,
              })),
          );

          return {
            stintNumber: stint.stintNumber,
            compound: stint.compound,
            lapStart: stint.lapStart,
            lapEnd: stint.lapEnd,
            lapCount: stint.length,
            averageLapTime: average(stintLaps.map((lap) => lap.lapTime)),
            standardDeviation: standardDeviation(stintLaps.map((lap) => lap.lapTime)),
            degradationPerLap: degradationSlope,
          };
        });

        return {
          driverNumber,
          code: driver?.name_acronym ?? String(driverNumber),
          fullName: driver?.full_name ?? `Driver #${driverNumber}`,
          teamName: driver?.team_name ?? 'Unknown team',
          teamColour: driver?.team_colour ?? '9A9A9A',
          headshotUrl: driver?.headshot_url ?? null,
          broadcastName: driver?.broadcast_name ?? null,
          result: resultData,
          championship,
          start: {
            gridPosition: firstPositionSample,
            lap1Position,
            gainLoss:
              Number.isFinite(firstPositionSample) && Number.isFinite(lap1Position)
                ? firstPositionSample - lap1Position
                : null,
          },
          topSpeed,
          cornerSpeeds: {},
          bestLap: bestLapSource
            ? {
                lapNumber: bestLapSource.lapNumber,
                lapDuration: bestLapSource.lapTime,
              }
            : null,
          bestSectors: {
            sector1: Number.isFinite(bestSectors.sector1) ? bestSectors.sector1 : null,
            sector2: Number.isFinite(bestSectors.sector2) ? bestSectors.sector2 : null,
            sector3: Number.isFinite(bestSectors.sector3) ? bestSectors.sector3 : null,
          },
          consistency: {
            greenLapCount: representativeLaps.length,
            averageLapTime: averageGreenLap,
            lapTimeStdDev: representativeLaps.length ? greenLapTimeStdDev : null,
          },
          positionsByLap: sampledPositions.map((entry) => ({
            lap: entry.lap,
            position: entry.value ?? null,
          })),
          gapsByLap: sampledGaps.map((entry) => ({
            lap: entry.lap,
            gapToLeader: entry.value ?? (resultData.position === 1 ? 0 : null),
          })),
          stints,
          stintPerformance,
          pitStops,
          lapDetails,
          compoundUsage: buildCompoundUsage(stints),
          referenceLap: referenceLap
            ? {
                lapNumber: referenceLap.lap_number,
                lapTime: referenceLap.lap_duration,
                dateStart: referenceLap.date_start,
              }
            : null,
          teammateDriverNumber: null,
        };
      })
      .sort((left, right) => {
        const leftPosition = left.result.position ?? 999;
        const rightPosition = right.result.position ?? 999;
        return leftPosition - rightPosition || left.driverNumber - right.driverNumber;
      });

    buildTeammateLinks(driverCards);
    const speedReferences = await buildSpeedMetrics(session.session_key, driverCards);
    const usedCompounds = [...new Set(stintRows.map((stint) => stint.compound).filter(Boolean))];
    const compoundStintStats = usedCompounds.map((compound) => {
      const lengths = stintRows
        .filter((stint) => stint.compound === compound)
        .map((stint) => (stint.lap_end ?? stint.lap_start) - stint.lap_start + 1);

      return {
        compound,
        lapsCompleted: lengths.reduce((sum, value) => sum + value, 0),
        ...buildSummaryStats(lengths),
      };
    });
    const pitDurationStats = buildSummaryStats(
      pitRows.map((pitStop) => pitStop.lane_duration ?? pitStop.pit_duration).filter(Number.isFinite),
    );
    const pitLossStats = buildSummaryStats(
      driverCards
        .flatMap((driver) => driver.pitStops.map((pitStop) => pitStop.estimatedTimeLoss))
        .filter(Number.isFinite),
    );
    const podium = driverCards
      .filter((driver) => Number.isFinite(driver.result.position) && driver.result.position <= 3)
      .slice(0, 3)
      .map((driver) => ({
        position: driver.result.position,
        fullName: driver.fullName,
        code: driver.code,
        teamName: driver.teamName,
      }));
    const winner = podium[0] ?? null;
    const summary = {
      totalLaps,
      starters,
      classified,
      totalPitStops: pitRows.length,
      eventDurationSeconds,
      weather: weatherSummary,
      usedCompounds,
      compoundStintStats,
      pitDurationStats,
      pitLossStats,
      hasCornerSpeedReferences: speedReferences.points.length > 0,
    };
    const payload = {
      slug,
      source: {
        provider: 'OpenF1',
        documentation: 'https://openf1.org/docs/',
      },
      generatedAt: now.toISOString(),
      transparency: buildTransparency(summary),
      meta: {
        season,
        round,
        eventType: sessionType.key,
        eventTypeLabel: sessionType.label,
        sessionName: session.session_name,
        meetingName: meeting.meeting_name ?? session.country_name,
        officialName: meeting.meeting_official_name ?? meeting.meeting_name ?? session.country_name,
        location: meeting.location ?? session.location,
        countryName: meeting.country_name ?? session.country_name,
        countryCode: meeting.country_code ?? session.country_code,
        countryFlag: meeting.country_flag ?? null,
        circuitShortName: meeting.circuit_short_name ?? session.circuit_short_name,
        circuitType: meeting.circuit_type ?? null,
        circuitImage: meeting.circuit_image ?? null,
        dateStart: session.date_start,
        dateEnd: session.date_end,
        sessionKey: session.session_key,
        meetingKey: session.meeting_key,
      },
      summary,
      lapAxis,
      weatherTimeline: buildWeatherTimeline(sessionWeather),
      neutralizations: neutralizationPeriods,
      speedReferences,
      winner,
      podium,
      drivers: driverCards,
    };

    sessionIndexEntries.push({
      slug,
      directoryName: sessionType.directoryName,
      eventType: sessionType.key,
      eventTypeLabel: sessionType.label,
      season,
      round,
      meetingName: payload.meta.meetingName,
      officialName: payload.meta.officialName,
      location: payload.meta.location,
      countryName: payload.meta.countryName,
      countryFlag: payload.meta.countryFlag,
      circuitShortName: payload.meta.circuitShortName,
      circuitImage: payload.meta.circuitImage,
      dateStart: payload.meta.dateStart,
      dateStartLabel: formatDate(payload.meta.dateStart),
      totalLaps,
      starters,
      classified,
      totalPitStops: pitRows.length,
      weatherLabel: formatWeatherTag(weatherSummary),
      winner,
      usedCompounds,
    });

    await writeFile(
      path.resolve(
        sessionType.key === 'sprint' ? sprintDir : grandPrixDir,
        `${slug}.json`,
      ),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
  }

  await writeFile(
    path.resolve(outputDir, 'index.json'),
    `${JSON.stringify(
      {
        generatedAt: now.toISOString(),
        season,
        source: {
          provider: 'OpenF1',
          documentation: 'https://openf1.org/docs/',
        },
        sessions: sessionIndexEntries.sort((left, right) => toMillis(right.dateStart) - toMillis(left.dateStart)),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
