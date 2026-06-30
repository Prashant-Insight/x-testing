/* eslint-disable @typescript-eslint/no-require-imports */
import * as assert from 'assert';
import Module = require('module');

interface ModuleLoader { _load(request: string, parent: NodeModule | null, isMain: boolean): unknown; }
type TestCase = { name: string; run: () => void | Promise<void> };

const tests: TestCase[] = [];
const loader = Module as unknown as ModuleLoader;
const originalLoad = loader._load;
loader._load = (request: string, parent: NodeModule | null, isMain: boolean): unknown => {
  if (request === 'vscode') {
    return { workspace: { workspaceFolders: undefined, getConfiguration: () => ({ get: <T>(_key: string, defaultValue: T) => defaultValue }) } };
  }
  return originalLoad.call(Module, request, parent, isMain);
};

globalThis.suite = ((_name: string, callback: () => void): void => { callback(); }) as Mocha.SuiteFunction;
globalThis.test = ((name: string, callback: () => void | Promise<void>): void => { tests.push({ name, run: callback }); }) as Mocha.TestFunction;

require('./extension.test');

(async () => {
  for (const testCase of tests) {
    await testCase.run();
    console.log(`✓ ${testCase.name}`);
  }
  assert.ok(tests.length > 0, 'No tests were registered');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
