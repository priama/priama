#!/usr/bin/env python3
"""Launch Priama from THIS checkout — never the installed .app / .exe.

Always `git fetch` + `git pull --ff-only` first so you run the latest remote
commit for your current branch (not a stale local tree).

Also:
  - Clears ELECTRON_RUN_AS_NODE (Cursor can set this and break Electron)
  - Sets PRIAMA_DEV=1 (separate userData: …/priama-dev, name "Priama Dev")
  - Runs local node_modules electron-vite

Usage:
  python3 rundev.py
  python3 rundev.py --skip-fetch   # use whatever is already checked out
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from shutil import which

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=check,
    )


def git_output(cmd: list[str]) -> str:
    return run(['git', *cmd]).stdout.strip()


def sync_latest() -> None:
    """Fetch origin and fast-forward the current branch to match remote."""
    if not (ROOT / '.git').exists() and not (ROOT / '.git').is_file():
        print('Not a git checkout — skipping fetch.', flush=True)
        return

    branch = git_output(['rev-parse', '--abbrev-ref', 'HEAD'])
    if branch == 'HEAD':
        raise SystemExit(
            'Detached HEAD — check out a branch first, then re-run rundev.py.'
        )

    print(f'Fetching origin (branch {branch})…', flush=True)
    fetch = run(['git', 'fetch', 'origin'], check=False)
    if fetch.returncode != 0:
        raise SystemExit(
            'git fetch failed — fix network/auth, or pass --skip-fetch.\n'
            + (fetch.stderr or fetch.stdout)
        )

    # Prefer the branch's configured upstream; fall back to origin/<branch>.
    upstream = run(
        ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        check=False,
    )
    if upstream.returncode == 0:
        target = upstream.stdout.strip()
    else:
        remote_ref = run(
            ['git', 'rev-parse', '--verify', f'origin/{branch}'],
            check=False,
        )
        if remote_ref.returncode != 0:
            print(
                f'No origin/{branch} yet — launching local {branch} as-is.',
                flush=True,
            )
            return
        target = f'origin/{branch}'

    before = git_output(['rev-parse', '--short', 'HEAD'])
    print(f'Fast-forwarding to {target}…', flush=True)
    pull = run(['git', 'pull', '--ff-only', 'origin', branch], check=False)
    if pull.returncode != 0:
        # Retry explicit merge --ff-only against resolved target if pull failed
        # (e.g. upstream name differs). Still refuse non-ff / dirty conflicts.
        merge = run(['git', 'merge', '--ff-only', target], check=False)
        if merge.returncode != 0:
            raise SystemExit(
                'Could not fast-forward to remote.\n'
                'Commit/stash local changes or resolve divergence, then retry.\n'
                + (pull.stderr or merge.stderr or pull.stdout or merge.stdout)
            )

    after = git_output(['rev-parse', '--short', 'HEAD'])
    if before != after:
        print(f'Updated {before} → {after}', flush=True)
    else:
        print(f'Already up to date @ {after}', flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--skip-fetch',
        action='store_true',
        help='Do not git fetch/pull; run the current checkout as-is',
    )
    args = parser.parse_args()

    os.chdir(ROOT)

    if not args.skip_fetch:
        sync_latest()

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

    try:
        branch = git_output(['rev-parse', '--abbrev-ref', 'HEAD'])
        sha = git_output(['rev-parse', '--short', 'HEAD'])
        head = f'{branch} @ {sha}'
    except (OSError, subprocess.CalledProcessError):
        head = '(unknown)'

    print(f'Priama DEV from: {ROOT}', flush=True)
    print(f'Git: {head}', flush=True)
    print('userData: <appData>/priama-dev  (isolated from installed Priama)', flush=True)

    cmd = [npm, 'exec', '--no', '--', 'electron-vite', 'dev']
    return subprocess.call(cmd, cwd=ROOT, env=env)


if __name__ == '__main__':
    raise SystemExit(main())
