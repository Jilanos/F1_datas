import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, 'public', 'data');
const indexPath = path.resolve(dataDir, 'index.json');

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateIndex(indexData) {
  assert(Array.isArray(indexData.sessions), 'index.json must contain a sessions array.');
  assert(indexData.sessions.length > 0, 'index.json must contain at least one session.');

  const hasGrandPrix = indexData.sessions.some((session) => session.eventType === 'grand-prix');
  const hasSprint = indexData.sessions.some((session) => session.eventType === 'sprint');

  assert(hasGrandPrix, 'index.json must include at least one Grand Prix session.');
  assert(hasSprint, 'index.json must include at least one Sprint session.');
}

function validateDriver(driver, session, filePath) {
  assert(driver && typeof driver === 'object', `${filePath}: driver entries must be objects.`);
  assert(typeof driver.code === 'string' && driver.code.length > 0, `${filePath}: each driver needs a code.`);
  assert(typeof driver.fullName === 'string' && driver.fullName.length > 0, `${filePath}: each driver needs a fullName.`);
  assert(Array.isArray(driver.positionsByLap), `${filePath}: driver ${driver.code} is missing positionsByLap.`);
  assert(Array.isArray(driver.gapsByLap), `${filePath}: driver ${driver.code} is missing gapsByLap.`);
  assert(Array.isArray(driver.lapDetails), `${filePath}: driver ${driver.code} is missing lapDetails.`);
  assert(Array.isArray(driver.stints), `${filePath}: driver ${driver.code} is missing stints.`);
  assert(Array.isArray(driver.stintPerformance), `${filePath}: driver ${driver.code} is missing stintPerformance.`);
  assert(Array.isArray(driver.pitStops), `${filePath}: driver ${driver.code} is missing pitStops.`);
  assert(driver.positionsByLap.length <= session.lapAxis.length, `${filePath}: driver ${driver.code} positionsByLap cannot exceed lapAxis length.`);
  assert(driver.gapsByLap.length <= session.lapAxis.length, `${filePath}: driver ${driver.code} gapsByLap cannot exceed lapAxis length.`);
}

function validateSessionData(session, filePath) {
  assert(session && typeof session === 'object', `${filePath}: session payload must be an object.`);
  assert(session.meta && typeof session.meta === 'object', `${filePath}: meta is required.`);
  assert(typeof session.meta.eventType === 'string', `${filePath}: meta.eventType is required.`);
  assert(typeof session.meta.meetingName === 'string', `${filePath}: meta.meetingName is required.`);
  assert(Array.isArray(session.lapAxis), `${filePath}: lapAxis must be an array.`);
  assert(Array.isArray(session.drivers) && session.drivers.length > 0, `${filePath}: drivers must be a non-empty array.`);
  assert(Array.isArray(session.transparency), `${filePath}: transparency must be an array.`);
  assert(Array.isArray(session.weatherTimeline), `${filePath}: weatherTimeline must be an array.`);
  assert(Array.isArray(session.neutralizations), `${filePath}: neutralizations must be an array.`);
  assert(session.summary && typeof session.summary === 'object', `${filePath}: summary is required.`);
  assert(isFiniteNumber(session.summary.totalLaps) && session.summary.totalLaps > 0, `${filePath}: summary.totalLaps must be positive.`);
  assert(
    session.lapAxis.length === session.summary.totalLaps,
    `${filePath}: lapAxis length must match summary.totalLaps.`,
  );
  assert(Array.isArray(session.summary.usedCompounds), `${filePath}: summary.usedCompounds must be an array.`);
  assert(Array.isArray(session.summary.compoundStintStats), `${filePath}: summary.compoundStintStats must be an array.`);
  assert(session.summary.pitDurationStats && typeof session.summary.pitDurationStats === 'object', `${filePath}: summary.pitDurationStats is required.`);
  assert(session.summary.pitLossStats && typeof session.summary.pitLossStats === 'object', `${filePath}: summary.pitLossStats is required.`);
  assert(session.speedReferences && typeof session.speedReferences === 'object', `${filePath}: speedReferences is required.`);

  for (const driver of session.drivers) {
    validateDriver(driver, session, filePath);
  }

  assert(
    session.drivers.some((driver) => driver.positionsByLap.length > 0),
    `${filePath}: at least one driver must expose positionsByLap data.`,
  );
  assert(
    session.drivers.some((driver) => driver.gapsByLap.length > 0),
    `${filePath}: at least one driver must expose gapsByLap data.`,
  );
  assert(
    session.drivers.some((driver) => driver.lapDetails.length > 0),
    `${filePath}: at least one driver must expose lapDetails data.`,
  );
}

async function validateRepresentativeSession(indexData, eventType) {
  const entry = indexData.sessions.find((session) => session.eventType === eventType);
  assert(entry, `Representative session for ${eventType} is missing.`);

  const directory = eventType === 'sprint' ? 'sprints' : 'grands-prix';
  const filePath = path.resolve(dataDir, directory, `${entry.slug}.json`);
  const sessionData = await readJson(filePath);

  assert(
    sessionData.meta?.eventType === eventType,
    `${filePath}: meta.eventType must match ${eventType}.`,
  );
  validateSessionData(sessionData, filePath);

  return entry.slug;
}

async function main() {
  const indexData = await readJson(indexPath);
  validateIndex(indexData);

  const validatedGrandPrix = await validateRepresentativeSession(indexData, 'grand-prix');
  const validatedSprint = await validateRepresentativeSession(indexData, 'sprint');

  console.info(`Validated datasets for Grand Prix "${validatedGrandPrix}" and Sprint "${validatedSprint}".`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
