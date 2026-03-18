import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { driverColor } from './dom.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

const neutralizationOverlayPlugin = {
  id: 'neutralizationOverlay',
  beforeDatasetsDraw(chart, _args, pluginOptions) {
    const periods = pluginOptions?.periods ?? [];
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    if (!periods.length || !xScale || !yScale) {
      return;
    }

    const { ctx } = chart;
    ctx.save();

    for (const period of periods) {
      const start = xScale.getPixelForValue(period.startLap - 1);
      const end = xScale.getPixelForValue(period.endLap - 1);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }

      ctx.fillStyle = period.type === 'SC' ? 'rgba(255, 194, 77, 0.14)' : 'rgba(111, 211, 255, 0.12)';
      ctx.fillRect(start - 8, yScale.top, end - start + 16, yScale.bottom - yScale.top);
    }

    ctx.restore();
  },
};

const boxWhiskerPlugin = {
  id: 'boxWhisker',
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    const stats = dataset?.customStats ?? [];
    const meta = chart.getDatasetMeta(0);
    const yScale = chart.scales.y;

    if (!stats.length || !meta?.data?.length || !yScale) {
      return;
    }

    const { ctx } = chart;
    ctx.save();

    stats.forEach((stat, index) => {
      const element = meta.data[index];

      if (!element || !Number.isFinite(stat.min) || !Number.isFinite(stat.max)) {
        return;
      }

      const centerX = element.x;
      const width = 32;
      const yMin = yScale.getPixelForValue(stat.min);
      const yQ1 = yScale.getPixelForValue(stat.q1);
      const yMedian = yScale.getPixelForValue(stat.median);
      const yQ3 = yScale.getPixelForValue(stat.q3);
      const yMax = yScale.getPixelForValue(stat.max);
      const yMean = yScale.getPixelForValue(stat.mean);
      const yStdLow = yScale.getPixelForValue(stat.mean - stat.standardDeviation);
      const yStdHigh = yScale.getPixelForValue(stat.mean + stat.standardDeviation);

      ctx.strokeStyle = '#efe9df';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(centerX, yMin);
      ctx.lineTo(centerX, yMax);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - width / 3, yMin);
      ctx.lineTo(centerX + width / 3, yMin);
      ctx.moveTo(centerX - width / 3, yMax);
      ctx.lineTo(centerX + width / 3, yMax);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 108, 71, 0.28)';
      ctx.fillRect(centerX - width / 2, yQ3, width, yQ1 - yQ3);

      ctx.strokeStyle = 'rgba(255, 208, 194, 0.95)';
      ctx.strokeRect(centerX - width / 2, yQ3, width, yQ1 - yQ3);

      ctx.strokeStyle = '#f7f2ea';
      ctx.beginPath();
      ctx.moveTo(centerX - width / 2, yMedian);
      ctx.lineTo(centerX + width / 2, yMedian);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(111, 211, 255, 0.9)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - width / 2, yStdLow);
      ctx.lineTo(centerX + width / 2, yStdLow);
      ctx.moveTo(centerX - width / 2, yStdHigh);
      ctx.lineTo(centerX + width / 2, yStdHigh);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#7df0cf';
      ctx.beginPath();
      ctx.arc(centerX, yMean, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  },
};

Chart.register(neutralizationOverlayPlugin, boxWhiskerPlugin);

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const defaultLegend = {
  labels: {
    color: '#efe9df',
    boxWidth: 10,
    boxHeight: 10,
    usePointStyle: true,
    pointStyle: 'circle',
    font: {
      family: 'Space Grotesk, sans-serif',
      size: 11,
    },
  },
};

const defaultTooltip = {
  backgroundColor: 'rgba(8, 12, 23, 0.94)',
  titleColor: '#f8f4ec',
  bodyColor: '#ddd4c2',
  borderColor: 'rgba(239, 233, 223, 0.12)',
  borderWidth: 1,
  padding: 12,
  displayColors: true,
};

function compoundColor(compound) {
  switch (compound) {
    case 'SOFT':
      return '#f04452';
    case 'MEDIUM':
      return '#f7d65b';
    case 'HARD':
      return '#f1f4f9';
    case 'INTERMEDIATE':
      return '#37c36b';
    case 'WET':
      return '#2f9cff';
    default:
      return '#9ca3af';
  }
}

function buildTicks(unit) {
  return {
    color: '#c6c0b5',
    callback(value) {
      return `${value}${unit}`;
    },
  };
}

function baseScales() {
  return {
    x: {
      ticks: {
        color: '#c6c0b5',
        maxTicksLimit: 10,
      },
      grid: {
        color: 'rgba(236, 225, 205, 0.07)',
      },
    },
    y: {
      ticks: {
        color: '#c6c0b5',
      },
      grid: {
        color: 'rgba(236, 225, 205, 0.07)',
      },
    },
  };
}

function buildLineDataset(driver, series, valueKey, labelSuffix = driver.teamName) {
  const color = driverColor(driver.teamColour);

  return {
    label: `${driver.code} | ${labelSuffix}`,
    data: series.map((point) => point[valueKey]),
    borderColor: color,
    backgroundColor: `${color}22`,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
    spanGaps: true,
    tension: 0.22,
  };
}

function sortByResult(drivers) {
  return [...drivers].sort((left, right) => {
    const leftPosition = left.result?.position ?? 999;
    const rightPosition = right.result?.position ?? 999;
    return leftPosition - rightPosition;
  });
}

function visibleDrivers(drivers, visibleNumbers) {
  return sortByResult(drivers).filter((driver) => visibleNumbers.has(driver.driverNumber));
}

function setChartData(chart, labels, datasets) {
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}

function computeRange(values, padding = 0.08) {
  const finiteValues = values.filter(Number.isFinite);

  if (!finiteValues.length) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const spread = Math.max(max - min, 1);

  return {
    min: min - spread * padding,
    max: max + spread * padding,
  };
}

export function mountPositionChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: session.lapAxis,
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: P${context.raw}`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          reverse: true,
          min: 1,
          max: Math.max(...session.drivers.map((driver) => driver.result.position ?? 20), 20),
          ticks: {
            color: '#c6c0b5',
            stepSize: 1,
            callback(value) {
              return `P${value}`;
            },
          },
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      setChartData(
        chart,
        session.lapAxis,
        drivers.map((driver) => buildLineDataset(driver, driver.positionsByLap, 'position')),
      );
    },
  };
}

export function mountGapChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: session.lapAxis,
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              if (context.raw === null) {
                return `${context.dataset.label}: no data`;
              }

              return `${context.dataset.label}: ${context.raw.toFixed(3)}s`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      setChartData(
        chart,
        session.lapAxis,
        drivers.map((driver) => buildLineDataset(driver, driver.gapsByLap, 'gapToLeader')),
      );
    },
  };
}

export function mountSpeedChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.raw?.toFixed?.(1) ?? context.raw} km/h`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks(' km/h'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const allSpeeds = drivers.flatMap((driver) => [
        driver.topSpeed,
        driver.cornerSpeeds?.low,
        driver.cornerSpeeds?.medium,
        driver.cornerSpeeds?.high,
      ]);
      const range = computeRange(allSpeeds, 0.12);

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, drivers.map((driver) => driver.code), [
        {
          label: 'Top speed',
          data: drivers.map((driver) => driver.topSpeed),
          backgroundColor: drivers.map((driver) => driverColor(driver.teamColour)),
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          label: 'Low-speed corner',
          data: drivers.map((driver) => driver.cornerSpeeds?.low ?? null),
          backgroundColor: '#38bdf8',
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          label: 'Medium-speed corner',
          data: drivers.map((driver) => driver.cornerSpeeds?.medium ?? null),
          backgroundColor: '#f59e0b',
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          label: 'High-speed corner',
          data: drivers.map((driver) => driver.cornerSpeeds?.high ?? null),
          backgroundColor: '#7dd3fc',
          borderRadius: 10,
          borderSkipped: false,
        },
      ]);
    },
  };
}

function buildCompoundStatsFromDrivers(drivers) {
  const statsByCompound = new Map();

  for (const driver of drivers) {
    for (const stint of driver.stints ?? []) {
      const bucket = statsByCompound.get(stint.compound) ?? [];
      bucket.push(stint.length);
      statsByCompound.set(stint.compound, bucket);
    }
  }

  return [...statsByCompound.entries()].map(([compound, lengths]) => {
    const sorted = [...lengths].sort((left, right) => left - right);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const variance =
      sorted.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / sorted.length;
    const interpolate = (ratio) => {
      if (sorted.length === 1) {
        return sorted[0];
      }

      const position = (sorted.length - 1) * ratio;
      const lower = Math.floor(position);
      const upper = Math.ceil(position);

      if (lower === upper) {
        return sorted[lower];
      }

      return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
    };

    return {
      compound,
      lapsCompleted: sorted.reduce((sum, value) => sum + value, 0),
      min: sorted[0],
      q1: interpolate(0.25),
      median: interpolate(0.5),
      q3: interpolate(0.75),
      max: sorted[sorted.length - 1],
      mean,
      standardDeviation: Math.sqrt(variance),
    };
  });
}

export function mountTyreBoxPlotChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Stint length distribution',
          data: [],
          customStats: [],
          backgroundColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            title(items) {
              return items[0]?.label ?? '';
            },
            label(context) {
              const stat = context.dataset.customStats[context.dataIndex];
              return [
                `${stat.lapsCompleted} laps across visible stints`,
                `Mean ${stat.mean.toFixed(2)} laps`,
                `Std dev ${stat.standardDeviation.toFixed(2)} laps`,
                `Median ${stat.median.toFixed(2)} laps`,
              ];
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: {
            color: '#c6c0b5',
            callback(value) {
              return `${value} laps`;
            },
          },
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const stats = buildCompoundStatsFromDrivers(visibleDrivers(session.drivers, visibleNumbers));
      const range = computeRange(stats.flatMap((stat) => [stat.min, stat.max]), 0.12);
      chart.options.scales.y.min = Math.max(0, range.min);
      chart.options.scales.y.max = range.max;
      chart.data.labels = stats.map((stat) => stat.compound);
      chart.data.datasets[0].data = stats.map((stat) => stat.mean);
      chart.data.datasets[0].customStats = stats;
      chart.update();
    },
  };
}

function mountStopsChart(canvas, session, metricKey, chartLabel, valueFormatter) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${valueFormatter(context.raw)}`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const stops = drivers.flatMap((driver) =>
        (driver.pitStops ?? [])
          .filter((pitStop) => Number.isFinite(pitStop[metricKey]))
          .map((pitStop) => ({
            label: `${driver.code} L${pitStop.lapNumber}`,
            value: pitStop[metricKey],
            color: driverColor(driver.teamColour),
          })),
      );
      const values = stops.map((stop) => stop.value);
      const averageValue = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      const variance =
        values.length > 1
          ? values.reduce((sum, value) => sum + (value - averageValue) * (value - averageValue), 0) / values.length
          : 0;
      const stdDev = Math.sqrt(variance);
      const range = computeRange(
        values.length && Number.isFinite(averageValue)
          ? [...values, averageValue - stdDev, averageValue + stdDev]
          : values,
        0.14,
      );

      chart.options.scales.y.min = Math.max(0, range.min);
      chart.options.scales.y.max = range.max;
      setChartData(chart, stops.map((stop) => stop.label), [
        {
          type: 'bar',
          label: chartLabel,
          data: stops.map((stop) => stop.value),
          backgroundColor: stops.map((stop) => stop.color),
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          type: 'line',
          label: 'Average',
          data: stops.map(() => averageValue),
          borderColor: '#f8fafc',
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: '+1 std dev',
          data: stops.map(() => (Number.isFinite(averageValue) ? averageValue + stdDev : null)),
          borderColor: '#7dd3fc',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: '-1 std dev',
          data: stops.map(() => (Number.isFinite(averageValue) ? averageValue - stdDev : null)),
          borderColor: '#7dd3fc',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
        },
      ]);
    },
  };
}

export function mountPitDurationChart(canvas, session) {
  return mountStopsChart(canvas, session, 'laneDuration', 'Pit lane duration', (value) => `${value.toFixed(3)}s`);
}

export function mountPitLossChart(canvas, session) {
  return mountStopsChart(
    canvas,
    session,
    'estimatedTimeLoss',
    'Estimated pit time loss',
    (value) => `${value.toFixed(3)}s`,
  );
}

export function mountLapTimeEvolutionChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: session.lapAxis,
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.raw?.toFixed?.(3) ?? 'N/A'}s`;
            },
          },
        },
        neutralizationOverlay: {
          periods: session.neutralizations ?? [],
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  chart.options.plugins.neutralizationOverlay = { periods: session.neutralizations ?? [] };

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const datasets = drivers.map((driver) =>
        buildLineDataset(
          driver,
          session.lapAxis.map((lapNumber) => {
            const lap = driver.lapDetails.find((item) => item.lapNumber === lapNumber);
            return {
              lapNumber,
              lapTime: lap?.lapTime ?? null,
            };
          }),
          'lapTime',
        ),
      );
      const range = computeRange(
        datasets.flatMap((dataset) => dataset.data).filter(Number.isFinite),
        0.08,
      );

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, session.lapAxis, datasets);
    },
  };
}

export function mountStintPaceChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.raw?.toFixed?.(3) ?? context.raw}s`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        x: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        y: {
          ticks: {
            color: '#c6c0b5',
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const rows = visibleDrivers(session.drivers, visibleNumbers)
        .flatMap((driver) =>
          (driver.stintPerformance ?? [])
            .filter((stint) => Number.isFinite(stint.averageLapTime))
            .map((stint) => ({
              label: `${driver.code} S${stint.stintNumber} ${stint.compound?.slice?.(0, 1) ?? '?'}`,
              value: stint.averageLapTime,
              color: compoundColor(stint.compound),
            })),
        )
        .sort((left, right) => left.value - right.value);
      const range = computeRange(rows.map((row) => row.value), 0.08);

      chart.options.scales.x.min = range.min;
      chart.options.scales.x.max = range.max;
      setChartData(chart, rows.map((row) => row.label), [
        {
          label: 'Average pace per stint',
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => row.color),
          borderRadius: 10,
          borderSkipped: false,
        },
      ]);
    },
  };
}

export function mountTyreDegradationChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.raw?.toFixed?.(3) ?? context.raw}s`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];
      const datasets = compounds
        .map((compound) => {
          const byAge = new Map();

          for (const driver of drivers) {
            for (const lap of driver.lapDetails ?? []) {
              if (!lap.isRepresentative || lap.compound !== compound || !Number.isFinite(lap.tyreAge) || !Number.isFinite(lap.lapTime)) {
                continue;
              }

              const bucket = byAge.get(lap.tyreAge) ?? [];
              bucket.push(lap.lapTime);
              byAge.set(lap.tyreAge, bucket);
            }
          }

          if (!byAge.size) {
            return null;
          }

          const ages = [...byAge.keys()].sort((left, right) => left - right);

          return {
            label: compound,
            ages,
            data: ages.map((age) => average(byAge.get(age))),
            borderColor: compoundColor(compound),
            backgroundColor: `${compoundColor(compound)}22`,
            pointRadius: 2,
            pointHoverRadius: 4,
            borderWidth: 2,
            spanGaps: true,
            tension: 0.2,
          };
        })
        .filter(Boolean);
      const maxAge = Math.max(1, ...datasets.flatMap((dataset) => dataset.ages ?? []));
      const labels = Array.from({ length: maxAge + 1 }, (_value, index) => index);
      const alignedDatasets = datasets.map((dataset) => {
        const ageMap = new Map(dataset.ages.map((age, index) => [age, dataset.data[index]]));

        return {
          ...dataset,
          data: labels.map((age) => ageMap.get(age) ?? null),
        };
      });
      const range = computeRange(datasets.flatMap((dataset) => dataset.data), 0.08);

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, labels, alignedDatasets);
    },
  };
}

export function mountStartGainChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...defaultTooltip,
        },
      },
      scales: {
        ...baseScales(),
        x: {
          ticks: {
            color: '#c6c0b5',
            callback(value) {
              return value > 0 ? `+${value}` : `${value}`;
            },
          },
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        y: {
          ticks: {
            color: '#c6c0b5',
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const rows = visibleDrivers(session.drivers, visibleNumbers)
        .filter((driver) => Number.isFinite(driver.start?.gainLoss))
        .map((driver) => ({
          label: driver.code,
          value: driver.start.gainLoss,
          color: driver.start.gainLoss >= 0 ? '#4fbf7f' : '#ef4444',
        }))
        .sort((left, right) => right.value - left.value);
      const absoluteMax = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

      chart.options.scales.x.min = -absoluteMax - 1;
      chart.options.scales.x.max = absoluteMax + 1;
      setChartData(chart, rows.map((row) => row.label), [
        {
          label: 'Places gained/lost after lap 1',
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => row.color),
          borderRadius: 10,
          borderSkipped: false,
        },
      ]);
    },
  };
}

export function mountConsistencyChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.raw?.toFixed?.(3) ?? context.raw}s std dev`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        x: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        y: {
          ticks: {
            color: '#c6c0b5',
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers)
        .filter((driver) => Number.isFinite(driver.consistency?.lapTimeStdDev))
        .sort((left, right) => left.consistency.lapTimeStdDev - right.consistency.lapTimeStdDev);
      const range = computeRange(drivers.map((driver) => driver.consistency.lapTimeStdDev), 0.15);

      chart.options.scales.x.min = Math.max(0, range.min);
      chart.options.scales.x.max = range.max;
      setChartData(chart, drivers.map((driver) => driver.code), [
        {
          label: 'Green-flag lap-time std dev',
          data: drivers.map((driver) => driver.consistency.lapTimeStdDev),
          backgroundColor: drivers.map((driver) => driverColor(driver.teamColour)),
          borderRadius: 10,
          borderSkipped: false,
        },
      ]);
    },
  };
}

export function mountBestSectorsChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.raw?.toFixed?.(3) ?? context.raw}s`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const range = computeRange(
        drivers.flatMap((driver) => [
          driver.bestSectors?.sector1,
          driver.bestSectors?.sector2,
          driver.bestSectors?.sector3,
        ]),
        0.08,
      );

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, drivers.map((driver) => driver.code), [
        {
          label: 'Sector 1',
          data: drivers.map((driver) => driver.bestSectors?.sector1 ?? null),
          backgroundColor: '#ff7a59',
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: 'Sector 2',
          data: drivers.map((driver) => driver.bestSectors?.sector2 ?? null),
          backgroundColor: '#fbbf24',
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: 'Sector 3',
          data: drivers.map((driver) => driver.bestSectors?.sector3 ?? null),
          backgroundColor: '#38bdf8',
          borderRadius: 8,
          borderSkipped: false,
        },
      ]);
    },
  };
}

export function mountWeatherChart(canvas, session) {
  const timeline = session.weatherTimeline ?? [];
  const labels = timeline.map((entry) => new Date(entry.date).toLocaleTimeString('en-GB', { timeZone: 'UTC' }));
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Track temperature',
          data: timeline.map((entry) => entry.trackTemperature),
          borderColor: '#ff7a59',
          backgroundColor: 'rgba(255, 122, 89, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'temp',
        },
        {
          label: 'Air temperature',
          data: timeline.map((entry) => entry.airTemperature),
          borderColor: '#f8fafc',
          backgroundColor: 'rgba(248, 250, 252, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'temp',
        },
        {
          label: 'Wind speed',
          data: timeline.map((entry) => entry.windSpeed),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'wind',
        },
        {
          label: 'Rainfall',
          data: timeline.map((entry) => entry.rainfall),
          borderColor: '#7dd3fc',
          backgroundColor: 'rgba(125, 211, 252, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'rain',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        tooltip: defaultTooltip,
      },
      scales: {
        x: {
          ticks: {
            color: '#c6c0b5',
            maxTicksLimit: 8,
          },
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        temp: {
          position: 'left',
          ticks: buildTicks('C'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        wind: {
          position: 'right',
          ticks: buildTicks(' m/s'),
          grid: {
            drawOnChartArea: false,
          },
        },
        rain: {
          display: false,
        },
      },
    },
  });

  return {
    chart,
    sync() {},
  };
}

export function mountNeutralizationImpactChart(canvas, session) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: defaultLegend,
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label(context) {
              if (context.dataset.label === 'Pit stops') {
                return `${context.raw} stops`;
              }

              return `${context.dataset.label}: ${context.raw?.toFixed?.(3) ?? context.raw}s`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        y: {
          ticks: buildTicks('s'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        yCount: {
          position: 'right',
          ticks: {
            color: '#c6c0b5',
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });

  return {
    chart,
    sync(visibleNumbers) {
      const phases = ['GREEN', 'VSC', 'SC'];
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const averages = phases.map((phase) => {
        const laps = drivers.flatMap((driver) =>
          (driver.lapDetails ?? [])
            .filter((lap) => lap.lapStatus === phase && lap.isRepresentative && Number.isFinite(lap.lapTime))
            .map((lap) => lap.lapTime),
        );

        return laps.length ? average(laps) : null;
      });
      const stopCounts = phases.map((phase) =>
        drivers.flatMap((driver) => driver.pitStops ?? []).filter((pitStop) => pitStop.lapStatus === phase).length,
      );
      const range = computeRange(averages.filter(Number.isFinite), 0.1);

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, phases, [
        {
          label: 'Average lap time',
          data: averages,
          backgroundColor: ['#94a3b8', '#38bdf8', '#fbbf24'],
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          type: 'line',
          label: 'Pit stops',
          data: stopCounts,
          borderColor: '#f8fafc',
          backgroundColor: '#f8fafc',
          borderWidth: 2,
          pointRadius: 3,
          yAxisID: 'yCount',
        },
      ]);
    },
  };
}

export function resizeControllers(controllers) {
  for (const controller of controllers) {
    controller.chart?.resize?.();
  }
}
