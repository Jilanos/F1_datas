import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = process.cwd();

function collectHtmlEntries(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = [];

  for (const entry of readdirSync(dirPath)) {
    const absolutePath = resolve(dirPath, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      entries.push(...collectHtmlEntries(absolutePath));
      continue;
    }

    if (entry.endsWith('.html')) {
      entries.push(absolutePath);
    }
  }

  return entries;
}

const htmlInputs = {
  home: resolve(rootDir, 'index.html'),
};

for (const filePath of collectHtmlEntries(resolve(rootDir, 'grands-prix'))) {
  const entryName = relative(rootDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '');

  htmlInputs[entryName] = filePath;
}

for (const filePath of collectHtmlEntries(resolve(rootDir, 'sprints'))) {
  const entryName = relative(rootDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '');

  htmlInputs[entryName] = filePath;
}

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: htmlInputs,
    },
  },
});
