import test from 'node:test';
import assert from 'node:assert';
import { NestContainer } from '@nestjs/core/injector/container';
import { DependenciesScanner } from '@nestjs/core/scanner';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { AppModule } from './app.module';

void test('AppModule resolves module dependencies without circular undefined imports', async () => {
  const container = new NestContainer();
  const scanner = new DependenciesScanner(
    container,
    new MetadataScanner(),
    { get: () => false } as any,
  );

  await scanner.scan(AppModule);
  assert.ok(container.getModules().size > 0, 'Container should contain resolved modules');
});
