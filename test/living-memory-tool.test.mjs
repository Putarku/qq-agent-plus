import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-living-memory-tool-'));
process.env.QQ_AGENT_DATA_DIR = root;

const { buildToolDefs, executeTool } = await import('../src/tools/tools-core.js');
const { experimentalToolClass } = await import('../src/pilots/experimental-tool-scheduler.js');
const { DEFAULT_CONFIG, setRuntimeConfig } = await import('../src/core/config.js');
const { buildSystemPrompt } = await import('../src/llm/prompt.js');

test('living_memory_search 只读查询当前会话的长期记忆', async () => {
  const defs = buildToolDefs();
  const ctx = {
    chatKey: 'group:123',
    session: {},
    livingMemory: {
      async recallTest({ chatKey, query, limit }) {
        assert.equal(chatKey, 'group:123');
        assert.equal(query, '上次 NAS 迁移');
        assert.equal(limit, 16);
        return {
          entries: [{
            id: 'memory-1', type: 'project', summary: 'NAS 迁移计划', content: '使用新磁盘并在周末切换。',
            tags: ['NAS', '迁移'], importance: 7, retrieval: { score: 0.91 }, source: { private: '不能泄露' }
          }],
          injectedText: '【长期记忆】\nNAS 迁移计划：使用新磁盘并在周末切换。'
        };
      }
    }
  };
  const result = await executeTool(defs, ctx, 'living_memory_search', JSON.stringify({ query: '上次 NAS 迁移', limit: 2 }));
  assert.equal(result.isError, undefined);
  assert.match(result.content, /NAS 迁移计划/);
  assert.doesNotMatch(result.content, /不能泄露/);
  assert.equal(experimentalToolClass('living_memory_search'), 'parallel-read');
});

test('关闭旧人物记忆后，系统提示不再教旧版人物记忆工具', () => {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.memory.personImpressionsPromptEnabled = false;
  setRuntimeConfig(cfg);
  const prompt = buildSystemPrompt({ persona: cfg.persona });
  assert.doesNotMatch(prompt, /memory_append 只用来/);
  assert.match(prompt, /memory_append \/ memory_query \/ memory_remove 都不在工具表里/);
});
