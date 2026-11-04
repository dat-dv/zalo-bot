// Publishes the build's version as /version.json so pages left open can notice a newer deploy.
import { readFileSync, writeFileSync } from 'node:fs';

const packageJson = new URL('../package.json', import.meta.url);
const target = new URL('../public/version.json', import.meta.url);

const { version } = JSON.parse(readFileSync(packageJson, 'utf8'));
writeFileSync(target, `${JSON.stringify({ version })}\n`);
