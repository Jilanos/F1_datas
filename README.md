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

```bash
npm install
```

## Quick Start

### PowerShell

Fast UI loop:

```powershell
npm run dev:ui
```

Full refresh with data rebuild:

```powershell
npm run dev
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

- `npm run build` is the complete pipeline and can take longer because it regenerates data.
- `npm run dev:ui` is the best option for most front-end tweaks.
- If charts look stale after a new weekend, refresh the data first with `npm run build:data`.
