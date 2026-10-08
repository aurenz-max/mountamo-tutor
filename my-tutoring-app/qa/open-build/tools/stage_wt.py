"""Stage exactly an agent worktree's changes on top of HEAD: per file, index = 3-way merge(base = worktree HEAD,
ours = main HEAD, theirs = worktree file). Peer edits in the main working tree never reach the index.

Run it with GIT_INDEX_FILE set to a fresh temporary index (`git read-tree HEAD` first), commit from that index, then
`git reset -- <committed paths>` on the real index: a peer session's staged changes in the shared index stay its own.
Prints CONFLICT for a file whose changes overlap HEAD's; resolve and stage those by hand."""
import subprocess, sys, tempfile, os
MAIN = r'C:/Users/xbox3/claude web tutor'
wt = sys.argv[1]
def run(*a, cwd=MAIN, inp=None):
    env = dict(os.environ)
    if cwd != MAIN: env.pop('GIT_INDEX_FILE', None)  # the worktree keeps its own index
    return subprocess.run(a, cwd=cwd, capture_output=True, input=inp, env=env)
run('git', 'add', '-A', '-N', '.', cwd=wt)
names = run('git', 'diff', 'HEAD', '--name-status', cwd=wt).stdout.decode().splitlines()
td = tempfile.mkdtemp()
def show(rev, path, cwd):
    r = run('git', 'show', f'{rev}:{path}', cwd=cwd); return r.stdout if r.returncode == 0 else None
for line in names:
    st, path = line.split('\t', 1)
    if 'node_modules' in path: continue
    if st == 'D': print('DELETE not staged', path); continue
    theirs = open(os.path.join(wt, path), 'rb').read().replace(b'\r', b'')
    base = show('HEAD', path, wt); ours = show('HEAD', path, MAIN)
    if base is None and ours is None: data = theirs
    else:
        files = []
        for n, d in (('o', (ours or b'')), ('b', (base or b'')), ('t', theirs)):
            fp = os.path.join(td, n); open(fp, 'wb').write(d.replace(b'\r', b'')); files.append(fp)
        r = run('git', 'merge-file', '-p', *files)
        if r.returncode != 0: print('CONFLICT not staged', path); continue
        data = r.stdout
    h = run('git', 'hash-object', '-w', '--stdin', inp=data).stdout.decode().strip()
    mode = '100755' if path.endswith('.sh') else '100644'
    r = run('git', 'update-index', '--add', '--cacheinfo', f'{mode},{h},{path}')
    print('staged' if r.returncode == 0 else 'FAILED', path)
