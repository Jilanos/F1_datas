import {
  formatCompound,
  formatDelta,
  formatDuration,
  formatGap,
  formatPoints,
  formatRaceDate,
  formatSeconds,
  formatTemperature,
  getSessionDetails,
} from '../lib/data.js';
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
            <label class="driver-toggle">
              <input type="checkbox" data-driver-toggle="${driver.driverNumber}" />
              <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
              <span>${escapeHtml(driver.fullName)}</span>
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
                  <label class="driver-toggle">
                    <input type="checkbox" data-driver-toggle="${driver.driverNumber}" checked />
                    <span class="driver-chip" style="--driver-color:${driverColor(driver.teamColour)}">${driver.code}</span>
                    <span>${escapeHtml(driver.fullName)}</span>
                  </label>
                `,
              )
              .join('')}
          </div>
        </section>

        <section class="chart-grid">
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 1', 'Driver positions by lap', 'Visible drivers are rebuilt into the chart state instead of being hidden with struck-through labels.', 'start-gain-loss')}
            <div class="chart-frame"><canvas id="positions-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 2', 'Gap to the leader', 'Gap traces inherit the same global driver filter and fullscreen interactions.', 'start-gain-loss')}
            <div class="chart-frame"><canvas id="gap-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 3', 'Top speed and representative corner speeds', session.speedReferences?.method ?? 'Representative corner references were unavailable for this session.', 'corner-speed-references')}
            <div class="chart-frame"><canvas id="speed-chart"></canvas></div>
          </article>
          <article class="panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 4', 'Tyre usage and stint strategy', 'The compound letter and lap count are embedded in each visible stint block.', 'used-compounds')}
            <div class="tyre-board" id="tyre-board">${buildTyreStrategy(driverList, session.summary.totalLaps)}</div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 5', 'Tyre stint distribution by compound', 'Box-and-whisker view of stint lengths for compounds used by the current selection.', 'used-compounds')}
            <div class="chart-frame"><canvas id="tyre-box-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 6', 'Pit stop duration', 'Direct OpenF1 pit-lane duration. Stationary stop duration is available in tooltips when the source provides it.', 'pit-stop-duration')}
            <div class="chart-frame"><canvas id="pit-duration-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 7', 'Pit stop time loss', 'Estimated from pit lap plus out lap versus nearby green-flag baseline laps.', 'pit-stop-time-loss')}
            <div class="chart-frame"><canvas id="pit-loss-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 8', 'Lap time evolution', 'Neutralization periods are shaded to frame pace changes under green, VSC and Safety Car conditions.', 'pit-stop-time-loss')}
            <div class="chart-frame"><canvas id="lap-time-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 9', 'Average pace per stint', 'Average representative lap time per stint, comparing drivers and compounds.', 'pit-stop-time-loss')}
            <div class="chart-frame"><canvas id="stint-pace-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 10', 'Tyre degradation', 'Compound curves aggregate representative green laps by tyre age for the visible drivers.', 'corner-speed-references')}
            <div class="chart-frame"><canvas id="degradation-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 11', 'Gain / loss at the start', 'Starting order is inferred from the earliest recorded position sample and compared with lap 1 order.', 'start-gain-loss')}
            <div class="chart-frame"><canvas id="start-gain-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 12', 'Driver consistency', 'Standard deviation is measured on representative green laps only.', 'corner-speed-references')}
            <div class="chart-frame"><canvas id="consistency-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 13', 'Best sectors', 'Best sector times are taken from lap records and remain filter-aware.', 'track-temperature')}
            <div class="chart-frame"><canvas id="best-sectors-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 14', 'Weather over the session', 'Track temperature, air temperature, wind and rainfall share the same timeline.', 'track-temperature')}
            <div class="chart-frame"><canvas id="weather-chart"></canvas></div>
          </article>
          <article class="panel chart-panel expandable-panel">
            ${buildPanelHeader(session, 'Chart 15', 'Safety Car / VSC impact', 'Average lap time by phase plus pit-stop count across the visible drivers.', 'pit-stop-time-loss')}
            <div class="chart-frame"><canvas id="neutralization-chart"></canvas></div>
          </article>
        </section>

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

    const controllers = [
      mountPositionChart(container.querySelector('#positions-chart'), session),
      mountGapChart(container.querySelector('#gap-chart'), session),
      mountSpeedChart(container.querySelector('#speed-chart'), session),
      mountTyreBoxPlotChart(container.querySelector('#tyre-box-chart'), session),
      mountPitDurationChart(container.querySelector('#pit-duration-chart'), session),
      mountPitLossChart(container.querySelector('#pit-loss-chart'), session),
      mountLapTimeEvolutionChart(container.querySelector('#lap-time-chart'), session),
      mountStintPaceChart(container.querySelector('#stint-pace-chart'), session),
      mountTyreDegradationChart(container.querySelector('#degradation-chart'), session),
      mountStartGainChart(container.querySelector('#start-gain-chart'), session),
      mountConsistencyChart(container.querySelector('#consistency-chart'), session),
      mountBestSectorsChart(container.querySelector('#best-sectors-chart'), session),
      mountWeatherChart(container.querySelector('#weather-chart'), session),
      mountNeutralizationImpactChart(container.querySelector('#neutralization-chart'), session),
    ];

    const tyreBoard = container.querySelector('#tyre-board');
    const teammateComparison = container.querySelector('#teammate-comparison');
    const mainToggleRoot = container.querySelector('#driver-filter');
    const mainFilterPanel = mainToggleRoot.parentElement;
    const modal = container.querySelector('#chart-modal');
    const modalBody = container.querySelector('#chart-modal-body');
    const modalFilters = container.querySelector('#chart-modal-filters');
    let modalPlaceholder = null;
    let activePanel = null;

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
