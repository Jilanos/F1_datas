import { getAnalyticsIndex } from '../lib/data.js';
import { escapeHtml } from '../lib/dom.js';

export async function renderHomePage(container) {
  container.innerHTML = `
    <main class="shell">
      <section class="hero hero-home">
        <p class="eyebrow">Static session intelligence</p>
        <h1>Recent Formula 1 races and sprints, rebuilt as static analytics.</h1>
        <p class="lead">
          The site precomputes Grand Prix and Sprint datasets, then renders deeper analysis for tyres, pace, pit
          stops, weather, position changes and teammate comparisons without a live backend.
        </p>
      </section>
      <section class="panel panel-loading">
        <p>Loading the latest sessions...</p>
      </section>
    </main>
  `;

  try {
    const index = await getAnalyticsIndex();

    container.innerHTML = `
      <main class="shell">
        <section class="hero hero-home">
          <p class="eyebrow">Season ${index.season}</p>
          <h1>Grand Prix and Sprint analytics, delivered as static JSON.</h1>
          <p class="lead">
            Data source: <a href="${index.source.documentation}" target="_blank" rel="noreferrer">OpenF1</a>.
            Generated at ${new Date(index.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC.
          </p>
        </section>
        <section class="overview-grid">
          ${(index.sessions ?? [])
            .map(
              (session) => `
                <article class="race-card">
                  <div class="race-card__visual" style="background-image: linear-gradient(135deg, rgba(8,12,23,0.2), rgba(8,12,23,0.82)), url('${escapeHtml(
                    session.circuitImage ?? '',
                  )}')">
                    <div class="race-card__badges">
                      <span class="race-card__round">Round ${session.round ?? '-'}</span>
                      <span class="event-pill event-pill--${session.eventType}">${escapeHtml(session.eventTypeLabel)}</span>
                    </div>
                    <h2>${escapeHtml(session.meetingName)}</h2>
                    <p>${escapeHtml(session.location)} | ${escapeHtml(session.countryName)}</p>
                  </div>
                  <div class="race-card__body">
                    <div class="race-card__meta">
                      <span>${escapeHtml(session.dateStartLabel)}</span>
                      <span>${session.totalLaps} laps</span>
                    </div>
                    <p class="race-card__winner">
                      Winner: ${session.winner ? escapeHtml(`${session.winner.fullName} (${session.winner.code})`) : 'N/A'}
                    </p>
                    <p class="race-card__weather">${escapeHtml(session.weatherLabel)}</p>
                    <p class="race-card__weather">
                      Compounds used: ${session.usedCompounds?.length ? escapeHtml(session.usedCompounds.join(', ')) : 'Unavailable'}
                    </p>
                    <div class="race-card__footer">
                      <span>${session.totalPitStops} pit stops tracked</span>
                      <a class="button-link" href="/${session.eventType === 'sprint' ? 'sprints' : 'grands-prix'}/${session.slug}/">
                        Open ${escapeHtml(session.eventTypeLabel)} analysis
                      </a>
                    </div>
                  </div>
                </article>
              `,
            )
            .join('')}
        </section>
      </main>
    `;
  } catch (error) {
    container.innerHTML = `
      <main class="shell">
        <section class="hero hero-home">
          <p class="eyebrow">Data unavailable</p>
          <h1>The analytics index could not be loaded.</h1>
          <p class="lead">${escapeHtml(error.message)}</p>
        </section>
      </main>
    `;
  }
}
