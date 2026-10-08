"""Merge an agent worktree's uncommitted changes into the main tree: new files copied, changed files 3-way merged
against the worktree's HEAD (line endings normalized to LF). Prints conflicts; never overwrites a conflicted file."""
import subprocess, sys, shutil
from pathlib import Path
MAIN = Path(r'c:/Users/xbox3/claude web tutor')
wt = Path(sys.argv[1])
skip = set(sys.argv[2:])
run = lambda *a, cwd: subprocess.run(a, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
run('git', 'add', '-A', '-N', '.', cwd=wt)
names = run('git', 'diff', 'HEAD', '--name-status', cwd=wt).stdout.splitlines()
tmp = Path(__file__).parent / '.mw'; tmp.mkdir(exist_ok=True)
for line in names:
    status, path = line.split('\t', 1)
    if any(path.endswith(s) for s in skip) or 'node_modules' in path:
        print('skip', path); continue
    src, dst = wt / path, MAIN / path
    if status == 'D':
        print('DELETE (not applied)', path); continue
    # Base = the worktree's own HEAD: main may have moved on (an earlier merge committed), and main's HEAD as base
    # would read main's newer lines as removed by the worktree and revert them.
    head = run('git', 'show', f'HEAD:{path}', cwd=wt)
    if head.returncode != 0:  # new file
        if dst.exists():
            same = src.read_bytes().replace(b'\r', b'') == dst.read_bytes().replace(b'\r', b'')
            print('new, exists in main', 'identical' if same else 'DIFFERS — not copied', path)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(src, dst); print('copied', path)
        continue
    for name, data in (('b', head.stdout.encode('utf-8')), ('c', dst.read_bytes()), ('t', src.read_bytes())):
        (tmp / name).write_bytes(data.replace(b'\r', b''))
    r = subprocess.run(['git', 'merge-file', '-p', str(tmp / 'c'), str(tmp / 'b'), str(tmp / 't')], capture_output=True)
    if r.returncode == 0:
        dst.write_bytes(r.stdout); print('merged', path)
    else:
        (tmp / (Path(path).name + '.conflict')).write_bytes(r.stdout); print(f'CONFLICT x{r.returncode}', path)
