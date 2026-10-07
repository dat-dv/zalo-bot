import * as path from 'path';

export function projectRoot(): string {
  const currentDirectory = process.cwd();
  const parentDirectory = path.dirname(currentDirectory);

  return path.basename(currentDirectory) === 'api' && path.basename(parentDirectory) === 'apps'
    ? path.resolve(currentDirectory, '../..')
    : currentDirectory;
}

export function apiRoot(): string {
  const root = projectRoot();
  return path.resolve(root, 'apps/api');
}

export function fromProjectRoot(...segments: string[]): string {
  return path.resolve(projectRoot(), ...segments);
}

export function fromApiRoot(...segments: string[]): string {
  return path.resolve(apiRoot(), ...segments);
}
