export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function driverColor(teamColour) {
  return `#${teamColour ?? 'A0A0A0'}`;
}

export function renderStatusTone(status) {
  if (status === 'Finished') {
    return 'status-finished';
  }

  if (status === 'DNF' || status === 'DSQ') {
    return 'status-danger';
  }

  return 'status-muted';
}

export function renderAvailabilityTone(availability) {
  switch (availability) {
    case 'direct':
      return 'availability-direct';
    case 'inferred':
      return 'availability-inferred';
    case 'estimated':
      return 'availability-estimated';
    default:
      return 'availability-unavailable';
  }
}
