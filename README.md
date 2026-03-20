# F1 Datas

Static Formula 1 analytics site built with Vite and Chart.js.

## What This Project Does

The project generates static JSON and static session pages for Grand Prix and Sprint weekends.

You can use it in two ways:

- `UI only`: fast front-end iteration without rebuilding all data
- `Full refresh`: regenerate data and pages when a new GP or Sprint arrives

## Requirements

- Node.js 20+
- npm

## Install

PowerShell:

```powershell
npm.cmd install
```

Git Bash / WSL:

```bash
npm install
```

## Quick Start

### PowerShell

Fast UI loop:

```powershell
npm.cmd run dev:ui
```

Full refresh with data rebuild:

```powershell
npm.cmd run dev
```

Offline rebuild from cached OpenF1 responses:

```powershell
npm.cmd run build:data:cached
```

Dataset validation:

```powershell
npm.cmd run validate:data
```

### Git Bash / WSL

Fast UI loop:

```bash
./run-site.sh ui
```

Full refresh with data rebuild:

```bash
./run-site.sh full
```

If the script is not executable yet:

```bash
chmod +x ./run-site.sh
./run-site.sh ui
```

## Available Commands

### Daily UI work

```bash
npm run dev:ui
```

What it does:

- regenerates static pages only
- starts the Vite dev server
- does not rebuild all data

Use this for layout, CSS, chart rendering, labels, menus, and interaction changes.

### Full local refresh

```bash
npm run dev
```

What it does:

- rebuilds data
- rebuilds pages
- starts the Vite dev server

Use this when new race data is needed.

### Refresh data without launching the server

```bash
npm run build:data
npm run build:pages
```

Or in bash:

```bash
./run-site.sh data
```

### Build the front-end bundle

```bash
npm run build:ui
```

### Rebuild data from the local OpenF1 cache only

```bash
npm run build:data:cached
```

Use this after a successful online `build:data` run has already populated `.cache/openf1/`.

### Validate generated datasets

```bash
npm run validate:data
```

This checks that generated static JSON still contains the core analytics structures for one representative Grand Prix and one representative Sprint session.

### Preview the production build

```bash
npm run preview
```

## Recommended Workflow

### 1. When you are changing UI only

Use:

```bash
npm run dev:ui
```

This is the fastest loop and avoids unnecessary data refresh.

### 2. When a new GP or Sprint arrives

Use:

```bash
npm run build:data
npm run validate:data
npm run build:pages
npm run dev:ui
```

This updates the static data once, then lets you keep iterating quickly on the UI.

### 3. When you want a full production-style check

Use:

```bash
npm run build:ui
npm run preview
```

## Bash Launcher

`run-site.sh` supports these modes:

```bash
./run-site.sh ui
./run-site.sh full
./run-site.sh build
./run-site.sh data
```

Meaning:

- `ui`: fast UI dev mode without full data refresh
- `full`: rebuild data + pages, then start dev server
- `build`: build the UI bundle
- `data`: rebuild data and pages only

## Project Structure

- `src/`: front-end source
- `src/pages/`: page renderers
- `src/lib/`: chart and formatting logic
- `scripts/`: data and page generation scripts
- `public/data/`: generated static JSON served by Vite
- `dist/`: production build output

## Notes

- In PowerShell, prefer `npm.cmd` instead of `npm` if script execution is blocked by `npm.ps1`.
- `npm run build` is the complete pipeline and can take longer because it regenerates data and validates the generated datasets.
- `npm run dev:ui` is the best option for most front-end tweaks.
- `npm run build:data` refreshes from OpenF1 and updates the local cache under `.cache/openf1/`.
- `npm run build:data:cached` rebuilds using cached OpenF1 responses only and fails on missing cache entries.
- If charts look stale after a new weekend, refresh the data first with `npm run build:data`.
