import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'Builds', 'web', 'index.html');
if (!existsSync(web)) {
  const built = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const out = path.join(root, 'Builds', 'windows');
mkdirSync(out, { recursive: true });

const packed = spawnSync(
  'npx',
  ['--yes', 'electron-packager', root, 'GarageEmpire', '--platform=win32', '--arch=x64', '--electron-version=33.2.1', '--out=' + out, '--overwrite', '--executable-name=GarageEmpire', '--ignore=^/node_modules', '--ignore=^/Source', '--ignore=^/Documentation', '--ignore=^/Tools', '--ignore=^/\\.git'],
  { cwd: root, stdio: 'inherit' },
);

const note = path.join(out, 'README.txt');
if (packed.status !== 0) {
  writeFileSync(
    note,
    [
      'Garage Empire desktop pack did not produce GarageEmpire.exe in this environment.',
      'The shipping build is Builds/web. Run it with: npm run preview',
      'Game/main.cjs is the Electron shell. On a machine with Electron and a Windows target:',
      '  npm run build && npm run desktop:pack',
      '',
    ].join('\n'),
  );
  console.log('Web release is Builds/web. Desktop packager did not emit an exe here.');
  process.exit(0);
}

console.log('Desktop bundle written under', out);
