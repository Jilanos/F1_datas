import { formatDelta, formatDuration, formatGap, formatPoints, formatRaceDate, formatTemperature, getSessionDetails } from '../lib/data.js';
import {
  mountBestSectorsChart,
  mountConsistencyChart,
  mountGapChart,
  mountLapTimeEvolutionChart,
  mountNeutralizationImpactChart,
  mountPitDurationChart,
  mountPitLossChart,
  mountPositionChart,
  mountSpeedChart,
  mountStartGainChart,
  mountStintPaceChart,
  mountTyreBoxPlotChart,
  mountTyreDegradationChart,
  mountWeatherChart,
  resizeControllers,
} from '../lib/charts.js';
import { driverColor, escapeHtml, renderAvailabilityTone, renderStatusTone } from '../lib/dom.js';

const chartGroups = [
  {
    id: 'all',
    label: 'All charts',
    subtitle: 'Full analysis',
    accent: '#f6b26b',
  },
  {
    id: 'race-story',
    label: 'Race story',
    subtitle: 'Order, gaps and momentum',
    title: 'Race story',
    description: 'Follow how the order evolves, where gaps open up, and when the session changes pace.',
    accent: '#ff7a59',
  },
  {
    id: 'pace-tyres',
    label: 'Pace and tyres',
    subtitle: 'Speed, stints and degradation',
    title: 'Pace and tyre behaviour',
    description: 'Group together the speed references, stint structure and tyre life curves to read performance more naturally.',
    accent: '#6fd3ff',
  },
  {
    id: 'execution',
    label: 'Execution',
    subtitle: 'Stops, sectors and consistency',
    title: 'Execution and efficiency',
    description: 'Surface the operational charts that explain where time was won or lost over the weekend.',
    accent: '#f7d65b',
  },
];

const chartDefinitions = [
  {
    key: 'positions',
    group: 'race-story',
    navLabel: 'Positions',
    eyebrow: 'Race story',
    title: 'Driver positions by lap',
    hint: 'Visible drivers are rebuilt into the chart state instead of being hidden with struck-through labels.',
    transparencyKey: 'start-gain-loss',
    accent: '#ff7a59',
    canvasId: 'positions-chart',
    mount: mountPositionChart,
  },
  {
    key: 'gap',
    group: 'race-story',
    navLabel: 'Gap to leader',
    eyebrow: 'Race story',
    title: 'Gap to the leader',
    hint: 'Gap traces inherit the same global driver filter and fullscreen interactions.',
    transparencyKey: 'start-gain-loss',
    accent: '#ff9b6a',
    canvasId: 'gap-chart',
    mount: mountGapChart,
  },
  {
    key: 'lap-time',
    group: 'race-story',
    navLabel: 'Lap evolution',
    eyebrow: 'Race story',
    title: 'Lap time evolution',
    hint: 'Neutralization periods are shaded to frame pace changes under green, VSC and Safety Car conditions.',
    transparencyKey: 'pit-stop-time-loss',
    accent: '#ff8a73',
    canvasId: 'lap-time-chart',
    mount: mountLapTimeEvolutionChart,
  },
  {
    key: 'start-gain',
    group: 'race-story',
    navLabel: 'Start delta',
    eyebrow: 'Race story',
    title: 'Gain / loss at the start',
    hint: 'Starting order is inferred from the earliest recorded position sample and compared with lap 1 order.',
    transparencyKey: 'start-gain-loss',
    accent: '#ffb366',
    canvasId: 'start-gain-chart',
    mount: mountStartGainChart,
  },
  {
    key: 'neutralization',
    group: 'race-story',
    navLabel: 'SC and VSC',
    eyebrow: 'Race story',
    title: 'Safety Car / VSC impact',
    hint: 'Average lap time by phase plus pit-stop count across the visible drivers.',
    transparencyKey: 'pit-stop-time-loss',
    accent: '#ffd369',
    canvasId: 'neutralization-chart',
    mount: mountNeutralizationImpactChart,
  },
  {
    key: 'speed',
    group: 'pace-tyres',
    navLabel: 'Speed map',
    eyebrow: 'Pace and tyres',
    title: 'Top speed and representative corner speeds',
    hint: 'Representative corner references were unavailable for this session.',
    transparencyKey: 'corner-speed-references',
    accent: '#6fd3ff',
    canvasId: 'speed-chart',
    mount: mountSpeedChart,
  },
  {
    key: 'tyre-strategy',
    group: 'pace-tyres',
    navLabel: 'Tyre plan',
    eyebrow: 'Pace and tyres',
    title: 'Tyre usage and stint strategy',
    hint: 'The compound letter and lap count are embedded in each visible stint block.',
    transparencyKey: 'used-compounds',
    accent: '#66d6a5',
    customId: 'tyre-board',
    kind: 'custom',
  },
  {
    key: 'tyre-box',
    group: 'pace-tyres',
    navLabel: 'Stint spread',
    eyebrow: 'Pace and tyres',
    title: 'Tyre stint distribution by compound',
    hint: 'Box-and-whisker view of stint lengths for compounds used by the current selection.',
    transparencyKey: 'used-compounds',
    accent: '#8ce0c4',
    canvasId: 'tyre-box-chart',
    mount: mountTyreBoxPlotChart,
  },
  {
    key: 'stint-pace',
    group: 'pace-tyres',
    navLabel: 'Stint pace',
    eyebrow: 'Pace and tyres',
    title: 'Average pace per stint',
    hint: 'Average representative lap time per stint, comparing drivers and compounds.',
    transparencyKey: 'pit-stop-time-loss',
    accent: '#75d7ff',
    canvasId: 'stint-pace-chart',
    mount: mountStintPaceChart,
  },
  {
    key: 'degradation',
    group: 'pace-tyres',
    navLabel: 'Degradation',
    eyebrow: 'Pace and tyres',
    title: 'Tyre degradation',
    hint: 'Compound curves aggregate representative green laps by tyre age for the visible drivers.',
    transparencyKey: 'corner-speed-references',
    accent: '#5dc8ff',
    canvasId: 'degradation-chart',
    mount: mountTyreDegradationChart,
  },
  {
    key: 'pit-duration',
    group: 'execution',
    navLabel: 'Pit duration',
    eyebrow: 'Execution',
    title: 'Pit stop duration',
    hint: 'Direct OpenF1 pit-lane duration. Stationary stop duration is available in tooltips when the source provides it.',
    transparencyKey: 'pit-stop-duration',
    accent: '#f7d65b',
    canvasId: 'pit-duration-chart',
    mount: mountPitDurationChart,
  },
  {
    key: 'pit-loss',
    group: 'execution',
    navLabel: 'Pit loss',
    eyebrow: 'Execution',
    title: 'Pit stop time loss',
    hint: 'Estimated from pit lap plus out lap versus nearby green-flag baseline laps.',
    transparencyKey: 'pit-stop-time-loss',
    accent: '#ffc16b',
    canvasId: 'pit-loss-chart',
    mount: mountPitLossChart,
  },
  {
    key: 'best-sectors',
    group: 'execution',
    navLabel: 'Best sectors',
    eyebrow: 'Execution',
    title: 'Best sectors',
    hint: 'Best sector times are taken from lap records and remain filter-aware.',
    transparencyKey: 'track-temperature',
    accent: '#ffae73',
    canvasId: 'best-sectors-chart',
    mount: mountBestSectorsChart,
  },
  {
    key: 'consistency',
    group: 'execution',
    navLabel: 'Consistency',
    eyebrow: 'Execution',
    title: 'Driver consistency',
    hint: 'Standard deviation is measured on representative green laps only.',
    transparencyKey: 'corner-speed-references',
    accent: '#f2df93',
    canvasId: 'consistency-chart',
    mount: mountConsistencyChart,
  },
  {
    key: 'weather',
    group: 'execution',
    navLabel: 'Weather',
    eyebrow: 'Execution',
    title: 'Weather over the session',
    hint: 'Track temperature, air temperature, wind and rainfall share the same timeline.',
    transparencyKey: 'track-temperature',
    accent: '#9ddcff',
    canvasId: 'weather-chart',
    mount: mountWeatherChart,
  },
];

function getTransparency(session, key) {
  return session.transparency?.find((entry) => entry.key === key) ?? null;
}

function buildAvailabilityBadge(session, key) {
  const item = getTransparency(session, key);

  if (!item) {
    return '';
  }

  return `<span class="availability-pill ${renderAvailabilityTone(item.availability)}">${escapeHtml(item.availability)}</span>`;
}

function chartsForGroup(groupId) {
  if (groupId === 'all') {
    return chartDefinitions;
  }

  return chartDefinitions.filter((chart) => chart.group === groupId);
}

function buildPanelHeader(session, eyebrow, title, hint, transparencyKey, expandable = true) {
  return `
    <div class="panel__header">
      <div>
        <div class="panel__eyebrow-row">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          ${buildAvailabilityBadge(session, transparencyKey)}
        </div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="panel__actions">
        ${hint ? `<p class="panel__hint">${escapeHtml(hint)}</p>` : ''}
        ${
          expandable
            ? '<button class="panel-expand" type="button" data-expand-button aria-label="Open this chart in fullscreen">Fullscreen</button>'
            : ''
        }
      </div>
    </div>
  `;
}

function buildTyreStrategy(drivers, totalLaps) {
  if (!drivers.length) {
    return '<p class="empty-state">No visible drivers selected.</p>';
  }

  return drivers
    .map((driver) => {
      const segments = (driver.stints ?? [])
        .map((stint) => {
          const width = totalLaps ? (stint.length / totalLaps) * 100 : 0;
          const compound = stint.compound ?? 'UNKNOWN';
          return `
            <span
              class="stint stint-${compound.toLowerCase()}"
              style="width:${width}%"
              title="${driver.code}: ${compound} from lap ${stint.lapStart} to ${stint.lapEnd}"
            >
              <span>${escapeHtml(compound.slice(0, 1))}</span>
              <small>${stint.length} laps</small>
            </span>
          `;
        })
        .join('');

      return `
        <div class="tyre-row" data-driver-row="${driver.driverNumber}">
          <div class="tyre-row__label">
            <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
            <span>${escapeHtml(driver.fullName)}</span>
          </div>
          <div class="tyre-track">${segments || '<span class="stint stint-empty">No stint data</span>'}</div>
          <div class="tyre-row__meta">${driver.stints?.length ? `${driver.stints.length} stints` : 'No data'}</div>
        </div>
      `;
    })
    .join('');
}

function buildClassificationRows(drivers) {
  return drivers
    .map((driver) => {
      const delta = driver.championship?.positionDelta;
      const deltaMarkup =
        delta === null
          ? '<span class="delta-pill delta-pill--muted">n/a</span>'
          : delta > 0
            ? `<span class="delta-pill delta-pill--up">↑ +${delta}</span>`
            : delta < 0
              ? `<span class="delta-pill delta-pill--down">↓ ${delta}</span>`
              : '<span class="delta-pill delta-pill--flat">→ 0</span>';

      return `
        <tr data-driver-row="${driver.driverNumber}">
          <td>${driver.result.position ?? '-'}</td>
          <td>
            <div class="driver-table-cell">
              <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
              <div>
                <strong>${escapeHtml(driver.fullName)}</strong>
                <span>${escapeHtml(driver.teamName)}</span>
              </div>
            </div>
          </td>
          <td><span class="status-pill ${renderStatusTone(driver.result.status)}">${escapeHtml(driver.result.status)}</span></td>
          <td>${formatPoints(driver.championship?.eventPoints ?? driver.result.points)}</td>
          <td>${formatPoints(driver.championship?.pointsAfter)}</td>
          <td>${deltaMarkup}</td>
          <td>${driver.topSpeed ? `${driver.topSpeed} km/h` : 'N/A'}</td>
          <td>${formatGap(driver.result.gapToLeader)}</td>
        </tr>
      `;
    })
    .join('');
}

function buildTeammateCards(drivers) {
  const teams = new Map();

  for (const driver of drivers) {
    const bucket = teams.get(driver.teamName) ?? [];
    bucket.push(driver);
    teams.set(driver.teamName, bucket);
  }

  const cards = [...teams.entries()]
    .filter(([, teamDrivers]) => teamDrivers.length === 2)
    .map(([teamName, teamDrivers]) => {
      const [left, right] = teamDrivers.sort((a, b) => (a.result.position ?? 999) - (b.result.position ?? 999));
      const paceDelta =
        Number.isFinite(left.consistency?.averageLapTime) && Number.isFinite(right.consistency?.averageLapTime)
          ? right.consistency.averageLapTime - left.consistency.averageLapTime
          : null;

      return `
        <article class="comparison-card">
          <div class="comparison-card__head">
            <h3>${escapeHtml(teamName)}</h3>
            <span>${left.code} vs ${right.code}</span>
          </div>
          <div class="comparison-card__body">
            <p><strong>Pace:</strong> ${paceDelta === null ? 'Unavailable' : `${left.code} ${paceDelta > 0 ? 'faster' : 'slower'} by ${Math.abs(paceDelta).toFixed(3)}s on average green laps`}</p>
            <p><strong>Top speed:</strong> ${left.code} ${left.topSpeed ?? 'N/A'} km/h, ${right.code} ${right.topSpeed ?? 'N/A'} km/h</p>
            <p><strong>Finish:</strong> P${left.result.position ?? '-'} vs P${right.result.position ?? '-'}</p>
            <p><strong>Lap 1 gain:</strong> ${left.code} ${formatDelta(left.start?.gainLoss ?? 0, ' pos')} | ${right.code} ${formatDelta(right.start?.gainLoss ?? 0, ' pos')}</p>
            <p><strong>Tyre strategy:</strong> ${left.code} ${escapeHtml((left.compoundUsage ?? []).map((entry) => `${entry.compound} ${entry.laps}L`).join(', ') || 'n/a')} | ${right.code} ${escapeHtml((right.compoundUsage ?? []).map((entry) => `${entry.compound} ${entry.laps}L`).join(', ') || 'n/a')}</p>
          </div>
        </article>
      `;
    });

  return cards.length
    ? cards.join('')
    : '<p class="empty-state">No two-driver teammate pairing was available in the current visible selection.</p>';
}

function buildTransparencyRows(session) {
  return (session.transparency ?? [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td><span class="availability-pill ${renderAvailabilityTone(item.availability)}">${escapeHtml(item.availability)}</span></td>
          <td>${escapeHtml(item.note)}</td>
        </tr>
      `,
    )
    .join('');
}

function buildModalFilterControls(drivers) {
  return `
    <div class="driver-filter__toolbar">
      <button class="ghost-button" type="button" data-select-all>Select all</button>
      <button class="ghost-button" type="button" data-unselect-all>Unselect all</button>
    </div>
    <div class="driver-filter driver-filter--compact" id="modal-driver-filter">
      ${drivers
        .map(
          (driver) => `
            <label class="driver-toggle driver-toggle--code" title="${escapeHtml(driver.fullName)}">
              <input type="checkbox" data-driver-toggle="${driver.driverNumber}" />
              <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
            </label>
          `,
        )
        .join('')}
    </div>
  `;
}

function syncToggleGroup(toggleRoot, visibleDrivers) {
  if (!toggleRoot) {
    return;
  }

  for (const input of toggleRoot.querySelectorAll('[data-driver-toggle]')) {
    input.checked = visibleDrivers.has(Number(input.dataset.driverToggle));
  }
}

function buildChartJumpButtons(activeGroup, activeChartKey) {
  return chartsForGroup(activeGroup)
    .map((chart) => {
      const group = chartGroups.find((entry) => entry.id === chart.group);
      const meta = activeGroup === 'all' && group ? `<span>${escapeHtml(group.label)}</span>` : '';
      const isActive = chart.key === activeChartKey ? ' is-active' : '';

      return `
        <button
          class="analytics-submenu__button${isActive}"
          type="button"
          data-chart-jump="${chart.key}"
          style="--nav-accent:${chart.accent}"
          aria-pressed="${chart.key === activeChartKey}"
        >
          <strong>${escapeHtml(chart.navLabel)}</strong>
          ${meta}
        </button>
      `;
    })
    .join('');
}

function buildAnalyticsNavigator(activeGroup, activeChartKey, isCollapsed) {
  const currentGroup = chartGroups.find((group) => group.id === activeGroup) ?? chartGroups[1];
  const currentChart = chartDefinitions.find((chart) => chart.key === activeChartKey) ?? chartDefinitions[0];
  const buttons = chartGroups
    .map((group) => {
      const isActive = group.id === activeGroup ? ' is-active' : '';
      const count = chartsForGroup(group.id).length;

      return `
        <button
          class="analytics-menu__button${isActive}"
          type="button"
          data-chart-group-button="${group.id}"
          style="--nav-accent:${group.accent}"
          aria-pressed="${group.id === activeGroup}"
        >
          <strong>${escapeHtml(group.label)}</strong>
          <span>${count} ${count === 1 ? 'chart' : 'charts'} | ${escapeHtml(group.subtitle)}</span>
        </button>
      `;
    })
    .join('');

  return `
    <section class="panel analytics-nav${isCollapsed ? ' analytics-nav--collapsed' : ''}" id="analytics-nav">
      <div class="analytics-nav__bar">
        <div class="analytics-nav__status">
          <span>Chart dock</span>
          <strong id="analytics-nav-current">${escapeHtml(currentGroup.label)}</strong>
          <small id="analytics-nav-current-chart">${escapeHtml(currentChart.navLabel)}</small>
        </div>
        <button
          class="ghost-button analytics-nav__toggle"
          id="analytics-nav-toggle"
          type="button"
          aria-expanded="${String(!isCollapsed)}"
        >
          ${isCollapsed ? 'Browse charts' : 'Close menu'}
        </button>
      </div>
      <div class="analytics-nav__drawer" id="analytics-nav-drawer"${isCollapsed ? ' hidden' : ''}>
        <div class="analytics-menu" id="analytics-menu">${buttons}</div>
        <div class="analytics-submenu" id="analytics-submenu">${buildChartJumpButtons(activeGroup, activeChartKey)}</div>
      </div>
    </section>
  `;
}

function buildChartPanel(session, definition, driverList, totalLaps) {
  const hint = definition.key === 'speed' ? session.speedReferences?.method ?? definition.hint : definition.hint;
  const toolbar =
    definition.key === 'best-sectors'
      ? `
        <div class="chart-toolbar" id="best-sectors-controls">
          <button class="ghost-button is-active" type="button" data-sector-button="sector1">Sector 1</button>
          <button class="ghost-button" type="button" data-sector-button="sector2">Sector 2</button>
          <button class="ghost-button" type="button" data-sector-button="sector3">Sector 3</button>
        </div>
      `
      : definition.key === 'speed'
        ? `
        <div class="chart-toolbar" id="speed-controls">
          <button class="ghost-button is-active" type="button" data-speed-button="top">Top speed</button>
          <button class="ghost-button" type="button" data-speed-button="low">Low corner</button>
          <button class="ghost-button" type="button" data-speed-button="medium">Medium corner</button>
          <button class="ghost-button" type="button" data-speed-button="high">High corner</button>
        </div>
      `
        : definition.key === 'lap-time'
          ? `
        <div class="chart-toolbar" id="lap-time-controls">
          <button class="ghost-button is-active" type="button" data-lap-filter-button="all">All laps</button>
          <button class="ghost-button" type="button" data-lap-filter-button="clean">Clean laps</button>
        </div>
      `
      : '';
  const body =
    definition.kind === 'custom'
      ? `<div class="tyre-board" id="${definition.customId}">${buildTyreStrategy(driverList, totalLaps)}</div>`
      : `<div class="chart-frame"><canvas id="${definition.canvasId}"></canvas></div>`;

  return `
    <article
      class="panel chart-panel expandable-panel"
      data-chart-key="${definition.key}"
      style="--panel-accent:${definition.accent}"
    >
      ${buildPanelHeader(session, definition.eyebrow, definition.title, hint, definition.transparencyKey)}
      ${toolbar}
      ${body}
    </article>
  `;
}

function buildChartSections(session, driverList) {
  return chartGroups
    .filter((group) => group.id !== 'all')
    .map((group) => {
      const charts = chartDefinitions.filter((chart) => chart.group === group.id);
      return `
        <section class="chart-section" data-chart-section="${group.id}">
          <div class="chart-section__header">
            <div>
              <p class="eyebrow">${escapeHtml(group.label)}</p>
              <h2>${escapeHtml(group.title)}</h2>
            </div>
            <p class="chart-section__hint">${escapeHtml(group.description)}</p>
          </div>
          <div class="chart-grid chart-grid--section">
            ${charts
              .map((chart) => buildChartPanel(session, chart, driverList, session.summary.totalLaps))
              .join('')}
          </div>
        </section>
      `;
    })
    .join('');
}

export async function renderSessionPage(container, sessionType, slug) {
  container.innerHTML = `
    <main class="shell">
      <section class="panel panel-loading">
        <p>Loading session analytics...</p>
      </section>
    </main>
  `;

  try {
    const session = await getSessionDetails(sessionType, slug);
    const driverList = [...session.drivers].sort((left, right) => (left.result.position ?? 999) - (right.result.position ?? 999));
    const visibleDrivers = new Set(driverList.map((driver) => driver.driverNumber));
    let activeGroup = 'race-story';
    let activeChartKey = chartsForGroup(activeGroup)[0]?.key ?? null;
    let isNavigatorCollapsed = true;

    container.innerHTML = `
      <main class="shell shell-race">
        <a class="back-link" href="/">Back to latest sessions</a>
        <section class="hero hero-race">
          <div class="hero-race__copy">
            <div class="hero-race__headline">
              <p class="eyebrow">Round ${session.meta.round ?? '-'} | ${escapeHtml(session.meta.eventTypeLabel)} | Season ${session.meta.season}</p>
              <span class="event-pill event-pill--${escapeHtml(session.meta.eventType)}">${escapeHtml(session.meta.eventTypeLabel)}</span>
            </div>
            <h1>${escapeHtml(session.meta.meetingName)}</h1>
            <p class="lead">
              ${escapeHtml(session.meta.location)} | ${escapeHtml(session.meta.countryName)} | ${escapeHtml(
                session.meta.circuitShortName,
              )} | ${escapeHtml(formatRaceDate(session.meta.dateStart))}
            </p>
            <div class="hero-stats">
              <div class="stat-card">
                <span>Winner</span>
                <strong>${session.winner ? escapeHtml(session.winner.fullName) : 'N/A'}</strong>
              </div>
              <div class="stat-card">
                <span>Track temp</span>
                <strong>${formatTemperature(session.summary.weather?.trackTemperatureAvg)}</strong>
              </div>
              <div class="stat-card">
                <span>Event duration</span>
                <strong>${formatDuration(session.summary.eventDurationSeconds)}</strong>
              </div>
              <div class="stat-card">
                <span>Compounds used</span>
                <strong>${session.summary.usedCompounds?.length ? escapeHtml(session.summary.usedCompounds.join(', ')) : 'N/A'}</strong>
              </div>
            </div>
          </div>
          <div class="hero-race__visual" style="background-image: linear-gradient(135deg, rgba(8,12,23,0.28), rgba(8,12,23,0.85)), url('${escapeHtml(
            session.meta.circuitImage ?? '',
          )}')">
            <div class="hero-race__tag">${escapeHtml(session.meta.officialName)}</div>
            <p>${escapeHtml(session.speedReferences?.method ?? 'Static JSON delivery')}</p>
          </div>
        </section>

        ${buildAnalyticsNavigator(activeGroup, activeChartKey, isNavigatorCollapsed)}

        <section class="panel">
          <div class="panel__header">
            <div>
              <p class="eyebrow">Driver visibility</p>
              <h2>Filter the session view</h2>
            </div>
            <div class="panel__actions">
              <p class="panel__hint">Every linked chart and driver-dependent panel follows this selection.</p>
            </div>
          </div>
          <div class="driver-filter__toolbar">
            <button class="ghost-button" type="button" data-select-all>Select all</button>
            <button class="ghost-button" type="button" data-unselect-all>Unselect all</button>
          </div>
          <div class="driver-filter" id="driver-filter">
            ${driverList
              .map(
                (driver) => `
                  <label class="driver-toggle driver-toggle--code" title="${escapeHtml(driver.fullName)}">
                    <input type="checkbox" data-driver-toggle="${driver.driverNumber}" checked />
                    <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
                  </label>
                `,
              )
              .join('')}
          </div>
        </section>

        ${buildChartSections(session, driverList)}

        <section class="panel">
          <div class="panel__header">
            <div>
              <p class="eyebrow">Teammates</p>
              <h2>Teammate comparison</h2>
            </div>
            <p class="panel__hint">Pace, top speed, finishing order, lap 1 gains and tyre strategy are compared pairwise when both teammates are visible.</p>
          </div>
          <div class="comparison-grid" id="teammate-comparison">${buildTeammateCards(driverList)}</div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <div>
              <p class="eyebrow">Classification</p>
              <h2>Final result snapshot</h2>
            </div>
            <p class="panel__hint">
              Points gained in this event, cumulative championship points after the event, and championship position delta where points-only ranking is unambiguous.
            </p>
          </div>
          <div class="table-wrap">
            <table class="classification-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Event pts</th>
                  <th>Total pts</th>
                  <th>Champ delta</th>
                  <th>Top speed</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                ${buildClassificationRows(driverList)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <div>
              <p class="eyebrow">Methodology</p>
              <h2>Metric transparency</h2>
            </div>
            <p class="panel__hint">Every major metric is marked as directly sourced, inferred, estimated or unavailable.</p>
          </div>
          <div class="table-wrap">
            <table class="classification-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>${buildTransparencyRows(session)}</tbody>
            </table>
          </div>
        </section>

        <div class="chart-modal" id="chart-modal" hidden>
          <div class="chart-modal__backdrop" data-close-modal></div>
          <div class="chart-modal__dialog">
            <div class="chart-modal__top">
              <div>
                <p class="eyebrow">Fullscreen chart</p>
                <h2 id="chart-modal-title">${escapeHtml(session.meta.meetingName)}</h2>
              </div>
              <button class="panel-expand panel-expand--close" type="button" data-close-modal>Close</button>
            </div>
            <div class="chart-modal__filters" id="chart-modal-filters">${buildModalFilterControls(driverList)}</div>
            <div class="chart-modal__body" id="chart-modal-body"></div>
          </div>
        </div>
      </main>
    `;

    const controllersByKey = new Map(
      chartDefinitions
        .filter((chart) => chart.mount)
        .map((chart) => [chart.key, chart.mount(container.querySelector(`#${chart.canvasId}`), session)]),
    );
    const controllers = [...controllersByKey.values()];

    const tyreBoard = container.querySelector('#tyre-board');
    const teammateComparison = container.querySelector('#teammate-comparison');
    const mainToggleRoot = container.querySelector('#driver-filter');
    const mainFilterPanel = mainToggleRoot.parentElement;
    const analyticsNav = container.querySelector('#analytics-nav');
    const analyticsDrawer = container.querySelector('#analytics-nav-drawer');
    const analyticsMenu = container.querySelector('#analytics-menu');
    const analyticsSubmenu = container.querySelector('#analytics-submenu');
    const analyticsCurrent = container.querySelector('#analytics-nav-current');
    const analyticsCurrentChart = container.querySelector('#analytics-nav-current-chart');
    const analyticsToggle = container.querySelector('#analytics-nav-toggle');
    const speedControls = container.querySelector('#speed-controls');
    const lapTimeControls = container.querySelector('#lap-time-controls');
    const bestSectorsControls = container.querySelector('#best-sectors-controls');
    const chartSections = [...container.querySelectorAll('[data-chart-section]')];
    const modal = container.querySelector('#chart-modal');
    const modalBody = container.querySelector('#chart-modal-body');
    const modalFilters = container.querySelector('#chart-modal-filters');
    let modalPlaceholder = null;
    let activePanel = null;

    function spotlightPanel(panel) {
      if (!panel) {
        return;
      }

      panel.classList.remove('chart-panel--spotlight');
      panel.offsetWidth;
      panel.classList.add('chart-panel--spotlight');
      window.setTimeout(() => panel.classList.remove('chart-panel--spotlight'), 1400);
    }

    function syncAnalyticsNavigation() {
      const currentGroup = chartGroups.find((group) => group.id === activeGroup) ?? chartGroups[1];
      const currentChart = chartDefinitions.find((chart) => chart.key === activeChartKey) ?? chartDefinitions[0];

      for (const button of analyticsMenu.querySelectorAll('[data-chart-group-button]')) {
        const isActive = button.dataset.chartGroupButton === activeGroup;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      }

      analyticsSubmenu.innerHTML = buildChartJumpButtons(activeGroup, activeChartKey);
      analyticsNav.classList.toggle('analytics-nav--collapsed', isNavigatorCollapsed);
      analyticsDrawer.hidden = isNavigatorCollapsed;
      analyticsToggle.textContent = isNavigatorCollapsed ? 'Browse charts' : 'Close menu';
      analyticsToggle.setAttribute('aria-expanded', String(!isNavigatorCollapsed));
      analyticsCurrent.textContent = currentGroup.label;
      analyticsCurrentChart.textContent = currentChart.navLabel;

      for (const section of chartSections) {
        section.hidden = activeGroup !== 'all' && section.dataset.chartSection !== activeGroup;
      }
    }

    function setActiveGroup(groupId, shouldScroll = true) {
      activeGroup = groupId;
      const visibleCharts = chartsForGroup(activeGroup);

      if (!visibleCharts.some((chart) => chart.key === activeChartKey)) {
        activeChartKey = visibleCharts[0]?.key ?? null;
      }

      syncAnalyticsNavigation();

      if (!shouldScroll) {
        return;
      }

      const target =
        activeGroup === 'all'
          ? container.querySelector('[data-chart-section]')
          : container.querySelector(`[data-chart-section="${activeGroup}"]`);

      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function focusChart(chartKey) {
      activeChartKey = chartKey;
      isNavigatorCollapsed = true;
      syncAnalyticsNavigation();
      const panel = container.querySelector(`[data-chart-key="${chartKey}"]`);

      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        spotlightPanel(panel);
      }
    }

    function applyVisibility() {
      const currentDrivers = driverList.filter((driver) => visibleDrivers.has(driver.driverNumber));

      syncToggleGroup(mainToggleRoot, visibleDrivers);
      syncToggleGroup(modalFilters, visibleDrivers);

      tyreBoard.innerHTML = buildTyreStrategy(currentDrivers, session.summary.totalLaps);
      teammateComparison.innerHTML = buildTeammateCards(currentDrivers);

      for (const row of container.querySelectorAll('[data-driver-row]')) {
        row.classList.toggle('is-hidden', !visibleDrivers.has(Number(row.dataset.driverRow)));
      }

      for (const controller of controllers) {
        controller.sync(visibleDrivers);
      }

      resizeControllers(controllers);
    }

    function setAllDrivers(isVisible) {
      visibleDrivers.clear();

      if (isVisible) {
        for (const driver of driverList) {
          visibleDrivers.add(driver.driverNumber);
        }
      }

      applyVisibility();
    }

    function bindFilterContainer(root) {
      if (!root) {
        return;
      }

      root.addEventListener('change', (event) => {
        const input = event.target.closest('[data-driver-toggle]');

        if (!input) {
          return;
        }

        const driverNumber = Number(input.dataset.driverToggle);

        if (input.checked) {
          visibleDrivers.add(driverNumber);
        } else {
          visibleDrivers.delete(driverNumber);
        }

        applyVisibility();
      });

      root.addEventListener('click', (event) => {
        const target = event.target.closest('[data-select-all], [data-unselect-all]');

        if (!target) {
          return;
        }

        if (target.hasAttribute('data-select-all')) {
          setAllDrivers(true);
        } else {
          setAllDrivers(false);
        }
      });
    }

    function closeModal() {
      if (!activePanel || !modalPlaceholder) {
        modal.hidden = true;
        return;
      }

      modalPlaceholder.replaceWith(activePanel);
      modalPlaceholder = null;
      activePanel = null;
      modal.hidden = true;
      resizeControllers(controllers);
    }

    function openModal(panel) {
      if (activePanel) {
        closeModal();
      }

      activePanel = panel;
      modalPlaceholder = document.createComment('chart-modal-placeholder');
      panel.parentNode.insertBefore(modalPlaceholder, panel);
      modalBody.appendChild(panel);
      modal.hidden = false;
      container.querySelector('#chart-modal-title').textContent = panel.querySelector('h2')?.textContent ?? session.meta.meetingName;
      resizeControllers(controllers);
    }

    analyticsToggle.addEventListener('click', () => {
      isNavigatorCollapsed = !isNavigatorCollapsed;
      syncAnalyticsNavigation();
    });

    analyticsMenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chart-group-button]');

      if (!button) {
        return;
      }

      setActiveGroup(button.dataset.chartGroupButton);
    });

    analyticsSubmenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chart-jump]');

      if (!button) {
        return;
      }

      focusChart(button.dataset.chartJump);
    });

    bestSectorsControls?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sector-button]');

      if (!button) {
        return;
      }

      for (const control of bestSectorsControls.querySelectorAll('[data-sector-button]')) {
        control.classList.toggle('is-active', control === button);
      }

      controllersByKey.get('best-sectors')?.setSector(button.dataset.sectorButton);
    });

    speedControls?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-speed-button]');

      if (!button) {
        return;
      }

      for (const control of speedControls.querySelectorAll('[data-speed-button]')) {
        control.classList.toggle('is-active', control === button);
      }

      controllersByKey.get('speed')?.setMetric(button.dataset.speedButton);
    });

    lapTimeControls?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-lap-filter-button]');

      if (!button) {
        return;
      }

      for (const control of lapTimeControls.querySelectorAll('[data-lap-filter-button]')) {
        control.classList.toggle('is-active', control === button);
      }

      controllersByKey.get('lap-time')?.setFilterMode(button.dataset.lapFilterButton);
    });

    bindFilterContainer(mainFilterPanel);
    bindFilterContainer(modalFilters);

    for (const button of container.querySelectorAll('[data-expand-button]')) {
      button.addEventListener('click', (event) => {
        const panel = event.currentTarget.closest('.expandable-panel');

        if (panel) {
          openModal(panel);
        }
      });
    }

    for (const closer of container.querySelectorAll('[data-close-modal]')) {
      closer.addEventListener('click', closeModal);
    }

    setActiveGroup(activeGroup, false);
    applyVisibility();
  } catch (error) {
    container.innerHTML = `
      <main class="shell">
        <a class="back-link" href="/">Back to latest sessions</a>
        <section class="hero hero-home">
          <p class="eyebrow">Session unavailable</p>
          <h1>The session analysis could not be loaded.</h1>
          <p class="lead">${escapeHtml(error.message)}</p>
        </section>
      </main>
    `;
  }
}
