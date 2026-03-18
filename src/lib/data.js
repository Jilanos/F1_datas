export async function getAnalyticsIndex() {
  const response = await fetch('/data/index.json');

  if (!response.ok) {
    throw new Error('Unable to load analytics index');
  }

  return response.json();
}

export async function getSessionDetails(sessionType, slug) {
  const directory = sessionType === 'sprint' ? 'sprints' : 'grands-prix';
  const response = await fetch(`/data/${directory}/${slug}.json`);

  if (!response.ok) {
    throw new Error(`Unable to load ${sessionType} data for ${slug}`);
  }

  return response.json();
}

export function formatRaceDate(isoString) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(isoString));
}

export function formatGap(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${value.toFixed(3)}s`;
}

export function formatTemperature(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${value.toFixed(1)}C`;
}

export function formatSeconds(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(digits)}s`;
}

export function formatPoints(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return 'N/A';
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  return [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, `${remainingSeconds}s`]
    .filter(Boolean)
    .join(' ');
}

export function formatCompound(compound) {
  if (!compound) {
    return 'N/A';
  }

  return compound
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase())
    .replace('Intermediate', 'Intermediate')
    .replace('Wet', 'Wet');
}

export function formatDelta(value, unit = '') {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}
