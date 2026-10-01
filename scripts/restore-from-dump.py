#!/usr/bin/env python3
"""
Replay a `spacetime sql` table dump back through the module's reducers.

Publishing a breaking schema change clears the database, and the night grid is
real history, so this exists to put the nights and the joke library back after
the module is republished. It reads the pipe-delimited dumps that
`spacetime sql` prints, which is the only export v2.4.1 offers.

    python3 scripts/restore-from-dump.py backups/<dir>            # show the plan
    python3 scripts/restore-from-dump.py backups/<dir> --apply    # run it

Pass --server <name> and --module <name> to rehearse it against a scratch
database first. The whole point of this script is to be trusted on the one day
it matters, so it is worth proving somewhere harmless.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODULE = (ROOT / ".stdb-name").read_text().strip()
SERVER = "maincloud"


def flag(name: str, fallback: str) -> str:
    """Read `--name value` out of argv, falling back to the live target."""
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return fallback


def rows(dump: Path, arity: int, header: str):
    """Yield each data row of a dump as a list of unquoted cells."""
    if not dump.exists():
        return
    for line in dump.read_text().splitlines():
        if "|" not in line or set(line.strip()) <= set("-+ "):
            continue
        cells = [c.strip() for c in line.split("|")]
        if len(cells) != arity or cells[0] == header:
            continue  # header, banner, or separator
        yield [c[1:-1] if c.startswith('"') and c.endswith('"') else c for c in cells]


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def call(reducer: str, args: list[str], apply: bool) -> bool:
    # Each argument goes across as its own JSON value, not as one JSON array;
    # the CLI rejects the array form outright.
    encoded = [f'"{esc(a)}"' for a in args]
    if not apply:
        print(f"  {reducer} {' '.join(encoded)}")
        return True
    done = subprocess.run(
        ["spacetime", "call", "--server", SERVER, MODULE, reducer, *encoded],
        capture_output=True,
        text=True,
    )
    if done.returncode != 0:
        print(f"  FAILED {reducer} {' '.join(encoded)}\n    {done.stderr.strip()}")
        return False
    return True


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    global MODULE, SERVER
    SERVER = flag("--server", SERVER)
    MODULE = flag("--module", MODULE)

    src = Path(sys.argv[1])
    if not src.is_absolute():
        src = ROOT / src
    apply = "--apply" in sys.argv

    nights = list(rows(src / "night.txt", 5, "day"))
    jokes = list(rows(src / "joke.txt", 4, "id"))

    print(f"{'restoring' if apply else 'plan'} -> {SERVER}/{MODULE}: {len(nights)} nights, {len(jokes)} jokes")
    if not nights and not jokes:
        print("nothing parsed; check the dump directory")
        return 1

    failed = 0
    for day, kind, note, by, _at in nights:
        if not call("mark_night", [day, kind, note, by], apply):
            failed += 1
    for _id, text, by, _at in jokes:
        if not call("add_joke", [text, by], apply):
            failed += 1

    if not apply:
        print("\ndry run. re-run with --apply to actually restore.")
    elif failed:
        print(f"\n{failed} call(s) failed")
        return 1
    else:
        print(f"\nrestored {len(nights)} nights and {len(jokes)} jokes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
