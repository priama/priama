#!/usr/bin/env python3
"""Launch Priama from THIS checkout — never the installed .app / .exe.

Does not fetch or pull from GitHub. Uses whatever files are already on disk.

Also:
  - Clears ELECTRON_RUN_AS_NODE (Cursor can set this and break Electron)
  - Sets PRIAMA_DEV=1 (separate userData: …/priama-dev, name "Priama Dev")
  - Runs local node_modules electron-vite (not a packaged install)

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


def git_head() -> str:
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
        return f'{branch} @ {sha}'
    except (OSError, subprocess.CalledProcessError):
        return '(unknown)'


def main() -> int:
    os.chdir(ROOT)

    npm = which('npm')
    if not npm:
        print('npm not found on PATH. Install Node.js first.', file=sys.stderr)
        return 1

    env = os.environ.copy()
    env.pop('ELECTRON_RUN_AS_NODE', None)
    env['PRIAMA_DEV'] = '1'
    local_bin = ROOT / 'node_modules' / '.bin'
    env['PATH'] = f'{local_bin}{os.pathsep}{env.get("PATH", "")}'

    if not (ROOT / 'node_modules' / 'electron').is_dir():
        print('node_modules missing — running npm install…', flush=True)
        rc = subprocess.call([npm, 'install'], cwd=ROOT, env=env)
        if rc != 0:
            return rc

    print(f'Priama DEV from: {ROOT}', flush=True)
    print(f'Git: {git_head()}', flush=True)
    print('userData: <appData>/priama-dev  (isolated from installed Priama)', flush=True)

    # Local electron-vite from this tree — never a packaged Priama.app / .exe.
    cmd = [npm, 'exec', '--no', '--', 'electron-vite', 'dev']
    return subprocess.call(cmd, cwd=ROOT, env=env)


if __name__ == '__main__':
    raise SystemExit(main())
