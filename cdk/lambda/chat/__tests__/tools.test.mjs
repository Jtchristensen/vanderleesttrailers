import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_SPECS, runTool } from '../tools.mjs';

describe('TOOL_SPECS', () => {
  it('exposes exactly the three expected tools', () => {
    const names = TOOL_SPECS.map(t => t.toolSpec.name).sort();
    assert.deepEqual(names, ['getSiteContent', 'searchTrailers', 'submitLead']);
  });

  it('each tool has a description and JSON schema', () => {
    for (const t of TOOL_SPECS) {
      assert.ok(t.toolSpec.description, `${t.toolSpec.name} missing description`);
      assert.ok(t.toolSpec.inputSchema?.json, `${t.toolSpec.name} missing inputSchema.json`);
    }
  });
});

describe('runTool dispatch', () => {
  it('throws for an unknown tool name', async () => {
    await assert.rejects(
      () => runTool({ name: 'nope', toolUseId: 'x', input: {} }, {}),
      /Unknown tool/
    );
  });
});
