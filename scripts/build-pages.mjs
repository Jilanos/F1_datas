import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const grandPrixPagesDir = path.resolve(rootDir, 'grands-prix');
const sprintPagesDir = path.resolve(rootDir, 'sprints');
const indexPath = path.resolve(rootDir, 'public', 'data', 'index.json');

function pageTemplate(session) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${session.meetingName} ${session.eventTypeLabel} | F1 Pulse</title>
    <meta
      name="description"
      content="${session.eventTypeLabel} analysis for the ${session.meetingName}, with positions, tyre strategy, pit stops, pace, weather and performance insights."
    />
    <script type="module" src="/src/session.js"></script>
  </head>
  <body data-session-slug="${session.slug}" data-session-type="${session.eventType}">
    <div id="app"></div>
  </body>
</html>
`;
}

async function writeSessionPage(baseDir, session) {
  const sessionPath = path.resolve(baseDir, session.slug);
  await mkdir(sessionPath, { recursive: true });
  await writeFile(path.resolve(sessionPath, 'index.html'), pageTemplate(session), 'utf8');
}

async function main() {
  const raw = await readFile(indexPath, 'utf8');
  const indexData = JSON.parse(raw);

  await rm(grandPrixPagesDir, { recursive: true, force: true });
  await rm(sprintPagesDir, { recursive: true, force: true });

  for (const session of indexData.sessions ?? []) {
    await writeSessionPage(session.eventType === 'sprint' ? sprintPagesDir : grandPrixPagesDir, session);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
