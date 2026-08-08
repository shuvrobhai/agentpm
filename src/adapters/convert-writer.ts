import fs from 'node:fs/promises';
import path from 'node:path';
import type { PortableCoreIR, ConversionResult } from '../ir/types.js';
import type { AgentAdapter } from './base.js';

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const val = source[key];
    const existing = result[key];

    if (
      val !== undefined &&
      isPlainObject(val) &&
      isPlainObject(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function writeConversion(
  ir: PortableCoreIR,
  adapter: AgentAdapter,
  outputDir: string,
): Promise<void> {
  const result: ConversionResult = adapter.convert(ir, 'workspace');
  const resolvedOut = path.resolve(outputDir);

  console.log(`\n🔄 Converting to ${adapter.displayName || adapter.name}...`);

  for (const file of result.files) {
    const filePath = path.join(resolvedOut, file.relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (file.merge) {
      let existing = {};
      try {
        existing = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      } catch {
        // file may not exist yet
      }
      const merged = deepMerge(
        existing as Record<string, unknown>,
        JSON.parse(file.content) as Record<string, unknown>,
      );
      await fs.writeFile(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    } else {
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    console.log(`   ├── ${file.relativePath}`);
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of result.warnings) {
      console.log(`   ⚠️  ${warning}`);
    }
  }

  if (result.manualSteps.length > 0) {
    console.log('\n📋 Manual steps:');
    for (const step of result.manualSteps) {
      console.log(`   • ${step}`);
    }
  }

  console.log(`\n✅ Converted ${result.files.length} files to ${resolvedOut}`);
}
