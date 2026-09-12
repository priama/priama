#!/usr/bin/env python3
"""Launch Priama from THIS checkout — never the installed .app / .exe.

Why `npm run dev` can feel like the installed app:
  - Same appId / userData → Electron's single-instance lock focuses the
    installed Priama instead of this build.
  - Cursor may set ELECTRON_RUN_AS_NODE, which breaks Electron startup.

This script:
  - Always runs from the directory that contains this file
  - Clears ELECTRON_RUN_AS_NODE
  - Sets PRIAMA_DEV=1 (separate userData: …/priama-dev, name "Priama Dev")
  - Invokes local node_modules electron-vite (after npm install if needed)

Usage:
  python3 rundev.py
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from shutil import which

ROOT = Path(__file__).resolve().parent


def main() -> int:
    os.chdir(ROOT)

    npm = which('npm')
    if not npm:
        print('npm not found on PATH. Install Node.js first.', file=sys.stderr)
        return 1

    env = os.environ.copy()
    # Cursor / some shells set this and Electron then won't open as an app.
    env.pop('ELECTRON_RUN_AS_NODE', None)
    env['PRIAMA_DEV'] = '1'
    # Prefer binaries from this repo over anything global.
    local_bin = ROOT / 'node_modules' / '.bin'
    env['PATH'] = f'{local_bin}{os.pathsep}{env.get("PATH", "")}'

    if not (ROOT / 'node_modules' / 'electron').is_dir():
        print('node_modules missing — running npm install…', flush=True)
        rc = subprocess.call([npm, 'install'], cwd=ROOT, env=env)
        if rc != 0:
            return rc

    head = '(unknown)'
    try:
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            cwd=ROOT,
            text=True,
        ).strip()
        sha = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            cwd=ROOT,
            text=True,
        ).strip()
        head = f'{branch} @ {sha}'
    except (OSError, subprocess.CalledProcessError):
        pass

    print(f'Priama DEV from: {ROOT}', flush=True)
    print(f'Git: {head}', flush=True)
    print('userData: <appData>/priama-dev  (isolated from installed Priama)', flush=True)

    # --no → use this repo's electron-vite; don't fetch another copy.
    cmd = [npm, 'exec', '--no', '--', 'electron-vite', 'dev']
    return subprocess.call(cmd, cwd=ROOT, env=env)


if __name__ == '__main__':
    raise SystemExit(main())
