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

const chartTokens = {
  text: '#f7f2ea',
  muted: '#c8c0b4',
  grid: 'rgba(236, 225, 205, 0.07)',
  coral: '#ff7a59',
  coralSoft: 'rgba(255, 122, 89, 0.16)',
  amber: '#f7d65b',
  sky: '#6fd3ff',
  aqua: '#9ddcff',
  mint: '#66d6a5',
  slate: '#94a3b8',
  ivory: '#f8fafc',
  rose: '#ff667a',
};

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

      ctx.fillStyle = period.type === 'SC' ? 'rgba(247, 214, 91, 0.16)' : 'rgba(111, 211, 255, 0.14)';
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

      ctx.strokeStyle = chartTokens.text;
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

      ctx.fillStyle = withAlpha(stat.color ?? chartTokens.coral, 0.28);
      ctx.fillRect(centerX - width / 2, yQ3, width, yQ1 - yQ3);

      ctx.strokeStyle = stat.color ?? 'rgba(255, 208, 194, 0.95)';
      ctx.strokeRect(centerX - width / 2, yQ3, width, yQ1 - yQ3);

      ctx.strokeStyle = chartTokens.text;
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

      ctx.fillStyle = chartTokens.mint;
      ctx.beginPath();
      ctx.arc(centerX, yMean, 4, 0, Math.PI * 2);
      ctx.fill();

      (stat.samples ?? []).forEach((sample, sampleIndex) => {
        const offset = ((sampleIndex % 7) - 3) * 3;
        const ySample = yScale.getPixelForValue(sample.value);

        ctx.globalAlpha = sample.isOutlier ? 0.95 : 0.52;
        ctx.fillStyle = sample.color;
        ctx.beginPath();
        ctx.arc(centerX + offset, ySample, sample.isOutlier ? 3.2 : 2.4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  },
};

const lineEndLabelsPlugin = {
  id: 'lineEndLabels',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) {
      return;
    }

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      const points = meta?.data ?? [];
      let lastPoint = null;

      for (let index = points.length - 1; index >= 0; index -= 1) {
        const value = dataset.data[index];

        if (value === null || value === undefined || !Number.isFinite(value)) {
          continue;
        }

        lastPoint = points[index];
        break;
      }

      if (!lastPoint) {
        return;
      }

      ctx.fillStyle = dataset.borderColor || chartTokens.text;
      ctx.fillText(String(dataset.endLabel ?? dataset.label ?? ''), Math.min(lastPoint.x + 8, chartArea.right - 18), lastPoint.y);
    });

    ctx.restore();
  },
};

Chart.register(neutralizationOverlayPlugin, boxWhiskerPlugin, lineEndLabelsPlugin);

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
  const variance = values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function withAlpha(hexColor, alpha) {
  const normalized = String(hexColor).replace('#', '');

  if (normalized.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function filterLapObjectsByOutlierThreshold(laps) {
  const candidateLaps = laps.filter((lap) => Number.isFinite(lap.lapTime));

  if (candidateLaps.length < 3) {
    return candidateLaps;
  }

  const lapTimes = candidateLaps.map((lap) => lap.lapTime);
  const medianValue = median(lapTimes);
  const absoluteDeviations = lapTimes.map((lapTime) => Math.abs(lapTime - medianValue));
  const mad = median(absoluteDeviations) || 0;
  const threshold = Math.max(mad * 3.5, 1.25);

  return candidateLaps.filter((lap) => Math.abs(lap.lapTime - medianValue) <= threshold);
}

function representativeGreenLaps(driver) {
  return (driver.lapDetails ?? []).filter(
    (lap) =>
      lap.isRepresentative &&
      lap.lapStatus === 'GREEN' &&
      !lap.isPitLap &&
      !lap.isPitOutLap &&
      Number.isFinite(lap.lapTime),
  );
}

function filteredGreenLapTimes(driver) {
  return filterLapObjectsByOutlierThreshold(representativeGreenLaps(driver)).map((lap) => lap.lapTime);
}

function buildCleanLapSelection(driver) {
  return new Set(filterLapObjectsByOutlierThreshold(representativeGreenLaps(driver)).map((lap) => lap.lapNumber));
}

function filterNumericOutlierObjects(items, valueSelector) {
  const numericItems = items.filter((item) => Number.isFinite(valueSelector(item)));

  if (numericItems.length < 3) {
    return numericItems;
  }

  const values = numericItems.map(valueSelector);
  const medianValue = median(values);
  const absoluteDeviations = values.map((value) => Math.abs(value - medianValue));
  const mad = median(absoluteDeviations) || 0;
  const threshold = Math.max(mad * 3.5, 1.5);

  return numericItems.filter((item) => Math.abs(valueSelector(item) - medianValue) <= threshold);
}

const defaultLegend = {
  labels: {
    color: chartTokens.text,
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
  titleColor: chartTokens.text,
  bodyColor: '#ddd4c2',
  borderColor: 'rgba(239, 233, 223, 0.12)',
  borderWidth: 1,
  padding: 12,
  displayColors: true,
};

function compoundColor(compound) {
  switch (compound) {
    case 'HARD':
      return '#e6edf7';
    case 'MEDIUM':
      return chartTokens.amber;
    case 'SOFT':
      return '#ff667a';
    case 'INTERMEDIATE':
      return '#53ca90';
    case 'WET':
      return '#4eb8ff';
    case 'UNKNOWN':
      return '#94a3b8';
    default:
      return '#9ca3af';
  }
}

function compoundOrder(compound) {
  switch (compound) {
    case 'HARD':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'SOFT':
      return 3;
    case 'INTERMEDIATE':
      return 4;
    case 'WET':
      return 5;
    case 'UNKNOWN':
      return 6;
    default:
      return 7;
  }
}

function buildLapTicks(totalLaps) {
  return {
    color: chartTokens.muted,
    autoSkip: false,
    maxRotation: 0,
    minRotation: 0,
    callback(value) {
      const lap = Number(value);

      if (!Number.isFinite(lap)) {
        return value;
      }

      if (totalLaps <= 12) {
        return lap;
      }

      if (totalLaps <= 24) {
        return lap <= 9 || lap % 2 === 0 ? lap : '';
      }

      return lap <= 9 || lap % 5 === 0 ? lap : '';
    },
  };
}

function verticalCategoryTicks() {
  return {
    color: chartTokens.muted,
    autoSkip: false,
    minRotation: 90,
    maxRotation: 90,
  };
}

function formatTickValue(value, unit, kind = 'time') {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return `${value}${unit}`;
  }

  if (kind === 'speed') {
    return `${numericValue.toFixed(Math.abs(numericValue) >= 100 ? 0 : 1)}${unit}`;
  }

  if (kind === 'count') {
    return `${numericValue.toFixed(Number.isInteger(numericValue) || Math.abs(numericValue) >= 10 ? 0 : 1)}${unit}`;
  }

  if (kind === 'temperature') {
    return `${numericValue.toFixed(1)}${unit}`;
  }

  return `${numericValue.toFixed(Math.abs(numericValue) >= 10 ? 2 : 3)}${unit}`;
}

function buildTicks(unit, kind = 'time') {
  return {
    color: chartTokens.muted,
    callback(value) {
      return formatTickValue(value, unit, kind);
    },
  };
}

function baseScales() {
  return {
    x: {
      ticks: {
        color: chartTokens.muted,
        maxTicksLimit: 10,
      },
      grid: {
        color: chartTokens.grid,
      },
    },
    y: {
      ticks: {
        color: chartTokens.muted,
      },
      grid: {
        color: chartTokens.grid,
      },
    },
  };
}

function buildLineDataset(driver, series, valueKey, labelSuffix = '') {
  const color = driverColor(driver.teamColour);
  const label = labelSuffix ? `${driver.code} | ${labelSuffix}` : driver.code;

  return {
    label,
    data: series.map((point) => point[valueKey]),
    borderColor: color,
    backgroundColor: `${color}1c`,
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
      layout: {
        padding: {
          right: 54,
        },
      },
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: defaultLegend,
        lineEndLabels: {
          enabled: true,
        },
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
        x: {
          ticks: buildLapTicks(session.lapAxis.length),
          grid: {
            display: false,
          },
        },
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
        drivers.map((driver) => ({
          ...buildLineDataset(driver, driver.positionsByLap, 'position'),
          endLabel: driver.fullName?.split?.(' ')?.slice?.(-1)?.[0] ?? driver.code,
        })),
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
        x: {
          ticks: buildLapTicks(session.lapAxis.length),
          grid: {
            display: false,
          },
        },
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
  let activeMetric = 'top';
  let currentVisibleNumbers = new Set(session.drivers.map((driver) => driver.driverNumber));
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [],
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
            label(context) {
              return `${context.dataset.label}: ${context.raw?.toFixed?.(1) ?? context.raw} km/h`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        x: {
          ticks: verticalCategoryTicks(),
          grid: {
            display: false,
          },
        },
        y: {
          ticks: buildTicks(' km/h', 'speed'),
          grid: {
            color: chartTokens.grid,
          },
        },
      },
    },
  });

  return {
    chart,
    setMetric(metric) {
      activeMetric = metric;
      this.sync(currentVisibleNumbers);
    },
    sync(visibleNumbers) {
      currentVisibleNumbers = new Set(visibleNumbers);
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const metricConfig =
        activeMetric === 'top'
          ? { label: 'Top speed', key: (driver) => driver.topSpeed }
          : activeMetric === 'low'
            ? { label: 'Low-speed corner', key: (driver) => driver.cornerSpeeds?.low ?? null }
            : activeMetric === 'medium'
              ? { label: 'Medium-speed corner', key: (driver) => driver.cornerSpeeds?.medium ?? null }
              : { label: 'High-speed corner', key: (driver) => driver.cornerSpeeds?.high ?? null };
      const values = drivers.map((driver) => metricConfig.key(driver));
      const range = computeRange(values, activeMetric === 'top' ? 0.08 : 0.12);

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, drivers.map((driver) => driver.code), [
        {
          label: metricConfig.label,
          data: values,
          backgroundColor: drivers.map((driver) => driverColor(driver.teamColour)),
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
      bucket.push({
        value: stint.length,
        color: compoundColor(stint.compound ?? 'UNKNOWN'),
      });
      statsByCompound.set(stint.compound, bucket);
    }
  }

  return [...statsByCompound.entries()]
    .map(([compound, samples]) => {
      const lengths = samples.map((sample) => sample.value);
      const sorted = [...lengths].sort((left, right) => left - right);
      const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const variance =
      sorted.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / sorted.length;
    const standardDeviation = Math.sqrt(variance);
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
        compound: compound ?? 'UNKNOWN',
        color: compoundColor(compound ?? 'UNKNOWN'),
        lapsCompleted: sorted.reduce((sum, value) => sum + value, 0),
        min: sorted[0],
        q1: interpolate(0.25),
        median: interpolate(0.5),
        q3: interpolate(0.75),
        max: sorted[sorted.length - 1],
        mean,
        standardDeviation,
        samples: samples.map((sample) => ({
          ...sample,
          isOutlier: Math.abs(sample.value - mean) > standardDeviation,
        })),
      };
    })
    .sort((left, right) => compoundOrder(left.compound) - compoundOrder(right.compound));
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
              return formatTickValue(value, ' laps', 'count');
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
        x: {
          ticks: verticalCategoryTicks(),
          grid: {
            display: false,
          },
        },
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
      const rawStops = drivers.flatMap((driver) =>
        (driver.pitStops ?? [])
          .filter((pitStop) => Number.isFinite(pitStop[metricKey]))
          .map((pitStop) => ({
            label: `${driver.code} L${pitStop.lapNumber}`,
            value: pitStop[metricKey],
            color: driverColor(driver.teamColour),
          })),
      );
      const stops = filterNumericOutlierObjects(rawStops, (stop) => stop.value);
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
          borderColor: chartTokens.ivory,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: '+1 std dev',
          data: stops.map(() => (Number.isFinite(averageValue) ? averageValue + stdDev : null)),
          borderColor: chartTokens.aqua,
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: '-1 std dev',
          data: stops.map(() => (Number.isFinite(averageValue) ? averageValue - stdDev : null)),
          borderColor: chartTokens.aqua,
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
  let filterMode = 'all';
  let currentVisibleNumbers = new Set(session.drivers.map((driver) => driver.driverNumber));
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
        x: {
          ticks: buildLapTicks(session.lapAxis.length),
          grid: {
            display: false,
          },
        },
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
    setFilterMode(mode) {
      filterMode = mode;
      this.sync(currentVisibleNumbers);
    },
    sync(visibleNumbers) {
      currentVisibleNumbers = new Set(visibleNumbers);
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const cleanSelections =
        filterMode === 'clean'
          ? new Map(drivers.map((driver) => [driver.driverNumber, buildCleanLapSelection(driver)]))
          : new Map();
      const datasets = drivers.map((driver) => {
        return {
          ...buildLineDataset(
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
          tension: 0,
        };
      });
      const rangeSource =
        filterMode === 'clean'
          ? drivers.flatMap((driver) =>
              (driver.lapDetails ?? [])
                .filter((lap) => cleanSelections.get(driver.driverNumber)?.has(lap.lapNumber))
                .map((lap) => lap.lapTime),
            )
          : datasets.flatMap((dataset) => dataset.data).filter(Number.isFinite);
      const range = computeRange(rangeSource, 0.08);

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
          [...new Set((driver.lapDetails ?? []).map((lap) => lap.stintNumber).filter(Number.isFinite))]
            .map((stintNumber) => {
              const filteredLaps = filterLapObjectsByOutlierThreshold(
                (driver.lapDetails ?? []).filter(
                  (lap) => lap.stintNumber === stintNumber && lap.isRepresentative && Number.isFinite(lap.lapTime),
                ),
              );

              if (!filteredLaps.length) {
                return null;
              }

              return {
                label: `${driver.code} S${stintNumber} ${filteredLaps[0].compound?.slice?.(0, 1) ?? '?'}`,
                value: average(filteredLaps.map((lap) => lap.lapTime)),
                color: compoundColor(filteredLaps[0].compound ?? 'UNKNOWN'),
              };
            })
            .filter(Boolean),
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
        x: {
          ticks: verticalCategoryTicks(),
          grid: {
            display: false,
          },
        },
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
            const stintNumbers = [...new Set((driver.lapDetails ?? []).map((lap) => lap.stintNumber).filter(Number.isFinite))];

            for (const stintNumber of stintNumbers) {
              const filteredLaps = filterLapObjectsByOutlierThreshold(
                (driver.lapDetails ?? []).filter(
                  (lap) =>
                    lap.stintNumber === stintNumber &&
                    lap.isRepresentative &&
                    lap.compound === compound &&
                    Number.isFinite(lap.tyreAge) &&
                    Number.isFinite(lap.lapTime),
                ),
              );

              for (const lap of filteredLaps) {
                const bucket = byAge.get(lap.tyreAge) ?? [];
                bucket.push(lap.lapTime);
                byAge.set(lap.tyreAge, bucket);
              }
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
            stepSize: 1,
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
          color: driverColor(driver.teamColour),
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
      const rows = visibleDrivers(session.drivers, visibleNumbers)
        .map((driver) => {
          const lapTimes = filteredGreenLapTimes(driver);
          return {
            code: driver.code,
            color: driverColor(driver.teamColour),
            value: lapTimes.length > 1 ? standardDeviation(lapTimes) : null,
          };
        })
        .filter((row) => Number.isFinite(row.value))
        .sort((left, right) => left.value - right.value);
      const range = computeRange(rows.map((row) => row.value), 0.15);

      chart.options.scales.x.min = Math.max(0, range.min);
      chart.options.scales.x.max = range.max;
      setChartData(chart, rows.map((row) => row.code), [
        {
          label: 'Green-flag lap-time std dev',
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => row.color),
          borderRadius: 10,
          borderSkipped: false,
        },
      ]);
    },
  };
}

export function mountBestSectorsChart(canvas, session) {
  let activeSector = 'sector1';
  let currentVisibleNumbers = new Set(session.drivers.map((driver) => driver.driverNumber));
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
        x: {
          ticks: verticalCategoryTicks(),
          grid: {
            display: false,
          },
        },
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
    setSector(sectorKey) {
      activeSector = sectorKey;
      this.sync(currentVisibleNumbers);
    },
    sync(visibleNumbers) {
      currentVisibleNumbers = new Set(visibleNumbers);
      const drivers = visibleDrivers(session.drivers, visibleNumbers);
      const sectorLabel =
        activeSector === 'sector1' ? 'Sector 1' : activeSector === 'sector2' ? 'Sector 2' : 'Sector 3';
      const range = computeRange(drivers.map((driver) => driver.bestSectors?.[activeSector]), 0.08);

      chart.options.scales.y.min = range.min;
      chart.options.scales.y.max = range.max;
      setChartData(chart, drivers.map((driver) => driver.code), [
        {
          label: sectorLabel,
          data: drivers.map((driver) => driver.bestSectors?.[activeSector] ?? null),
          backgroundColor: drivers.map((driver) => driverColor(driver.teamColour)),
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
          borderColor: chartTokens.coral,
          backgroundColor: 'rgba(255, 122, 89, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'temp',
        },
        {
          label: 'Air temperature',
          data: timeline.map((entry) => entry.airTemperature),
          borderColor: chartTokens.ivory,
          backgroundColor: 'rgba(248, 250, 252, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'temp',
        },
        {
          label: 'Wind speed',
          data: timeline.map((entry) => entry.windSpeed),
          borderColor: chartTokens.sky,
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'wind',
        },
        {
          label: 'Rainfall',
          data: timeline.map((entry) => entry.rainfall),
          borderColor: chartTokens.aqua,
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
          ticks: buildTicks('C', 'temperature'),
          grid: {
            color: 'rgba(236, 225, 205, 0.07)',
          },
        },
        wind: {
          position: 'right',
          ticks: buildTicks(' m/s', 'speed'),
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
          backgroundColor: [chartTokens.slate, chartTokens.sky, chartTokens.amber],
          borderRadius: 10,
          borderSkipped: false,
        },
        {
          type: 'line',
          label: 'Pit stops',
          data: stopCounts,
          borderColor: chartTokens.ivory,
          backgroundColor: chartTokens.ivory,
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
