/**
 * Claude CLI multi-install conflict detection — identity dedupe + opt-in gate.
 *
 * #623: npm global installs expose a PATH wrapper and a realpath under
 * node_modules/@anthropic-ai/claude-code; those must count as one install.
 * PR #5 gap: Settings → Runtime "Conflict check" (default off) must suppress
 * otherInstalls scanning in /api/claude-status, not only the drift banner.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { claudeInstallIdentityKey } from '../../lib/platform';

describe('claudeInstallIdentityKey (#623 npm wrapper dedupe)', () => {
  it('collapses npm package root for wrapper vs cli.js under the same install', () => {
    const pkg = 'C:/Users/me/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code';
    const wrapper = `${pkg}/cli.js`;
    const nested = `${pkg}/dist/cli.js`;
    assert.equal(claudeInstallIdentityKey(wrapper), claudeInstallIdentityKey(nested));
    assert.match(claudeInstallIdentityKey(wrapper), /@anthropic-ai\/claude-code$/i);
  });

  it('keeps unrelated installs distinct', () => {
    const npm = 'C:/Users/me/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/cli.js';
    const native = 'C:/Users/me/.local/bin/claude.exe';
    assert.notEqual(claudeInstallIdentityKey(npm), claudeInstallIdentityKey(native));
  });

  it('strips Windows executable extensions for same-dir variants', () => {
    const exe = 'C:/Users/me/.local/bin/claude.exe';
    const cmd = 'C:/Users/me/.local/bin/claude.cmd';
    assert.equal(claudeInstallIdentityKey(exe), claudeInstallIdentityKey(cmd));
  });
});

describe('runtime conflict check opt-in (source-pin)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');

  it('claude-status only scans otherInstalls when runtime_conflict_check_enabled is true', () => {
    const src = read('app/api/claude-status/route.ts');
    assert.match(src, /runtime_conflict_check_enabled/);
    assert.match(src, /isRuntimeConflictCheckEnabled/);
    assert.match(src, /conflictCheckEnabled && otherInstalls\.length/);
    assert.ok(
      src.includes('if (conflictCheckEnabled)') && src.includes('findAllClaudeBinaries'),
      'multi-install scan must be gated behind conflictCheckEnabled',
    );
  });

  it('RuntimePanel refreshes claude status after conflict-check toggle save', () => {
    const src = read('components/settings/RuntimePanel.tsx');
    assert.match(src, /handleConflictCheckToggle/);
    assert.match(src, /refreshStatus\(\)/);
  });

  it('settings/app ALLOWED_KEYS still includes runtime_conflict_check_enabled', () => {
    const src = read('app/api/settings/app/route.ts');
    assert.match(src, /runtime_conflict_check_enabled/);
  });
});
