import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const appName = 'GarageEmpire';
const outputDir = path.join(root, 'Builds', 'windows');

function runNpm(script) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', script], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const ignoredPaths = [
  '.git',
  '.github',
  '.cache',
  'Builds/windows',
  'Documentation',
  'Source',
  'Tools',
  'coverage',
  'node_modules',
  'Game/node_modules',
];

function ignoreFile(absolutePath) {
  const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
  return ignoredPaths.some((ignoredPath) => relativePath === ignoredPath || relativePath.startsWith(`${ignoredPath}/`));
}

runNpm('build');
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const appPaths = await packager({
  dir: root,
  name: appName,
  appVersion: packageJson.version,
  electronVersion: packageJson.devDependencies.electron,
  platform: 'win32',
  arch: 'x64',
  out: outputDir,
  overwrite: true,
  executableName: appName,
  asar: true,
  prune: true,
  ignore: ignoreFile,
  win32metadata: {
    CompanyName: 'Garage Empire',
    FileDescription: 'Garage Empire — automobile restoration simulator',
    InternalName: appName,
    OriginalFilename: `${appName}.exe`,
    ProductName: 'Garage Empire',
  },
});

const appDir = appPaths[0];
const executable = path.join(appDir, `${appName}.exe`);
await access(executable);
await writeFile(
  path.join(appDir, 'README.txt'),
  [
    'GARAGE EMPIRE — Windows x64',
    '',
    'Run GarageEmpire.exe to play.',
    'Keep the entire folder together; the executable needs the files beside it.',
    'No internet connection is required after installation/extraction.',
    '',
  ].join('\r\n'),
);

console.log(`Windows app created: ${path.relative(root, executable)}`);
