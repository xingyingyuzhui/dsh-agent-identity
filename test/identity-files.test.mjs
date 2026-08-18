import assert from 'node:assert/strict'
import test from 'node:test'
import { isDsClawPath, isIdentityFile, isWritableIdentityFile, renderIdentityPrompt, safeJoin } from '../identity-files.mjs'

test('only DSclaw paths are identity roots', () => {
  const home = '/Users/qin/.dsh'
  assert.equal(isDsClawPath('/Users/qin/.dsh/DSclaw/test1', home), true)
  assert.equal(isDsClawPath('/Users/qin/DSH', home), false)
  assert.equal(isDsClawPath('/tmp/DSclaw/x/../../outside', '/tmp'), false)
  assert.equal(isDsClawPath('/Users/qin/.dsh/DSclaw/test1/../../workspace-agents', home), false)
  assert.equal(isIdentityFile('SOUL.md'), true)
  assert.equal(isIdentityFile('TOOLS.md'), true)
  assert.equal(isIdentityFile('IDENTITY.md'), true)
  assert.equal(isIdentityFile('HEARTBEAT.md'), true)
  assert.equal(isIdentityFile('MEMORY.md'), true)
  assert.equal(isIdentityFile('secret.txt'), false)
  assert.equal(isWritableIdentityFile('SOUL.md'), true)
  assert.equal(isWritableIdentityFile('MEMORY.md'), false)
  assert.equal(isWritableIdentityFile('USER.md'), false)
})

test('safeJoin refuses path escape', () => {
  assert.equal(safeJoin('/Users/qin/.dsh/DSclaw/test1', 'SOUL.md'), '/Users/qin/.dsh/DSclaw/test1/SOUL.md')
  assert.equal(safeJoin('/Users/qin/DSH', 'SOUL.md'), '')
  assert.equal(safeJoin('/Users/qin/.dsh/DSclaw/test1', '../x'), '')
})

test('renderIdentityPrompt skips empty files', () => {
  const text = renderIdentityPrompt({
    'SOUL.md': 'You are test1.\n',
    'AGENTS.md': '',
    'TOOLS.md': 'use bash carefully',
  })
  assert.match(text, /SOUL\.md/)
  assert.match(text, /You are test1/)
  assert.match(text, /TOOLS\.md/)
  assert.doesNotMatch(text, /AGENTS\.md/)
  assert.doesNotMatch(text, /MEMORY\.md/)
})

test('USER MEMORY and HEARTBEAT stay off the identity prompt', () => {
  const text = renderIdentityPrompt({
    'SOUL.md': 'soul',
    'USER.md': 'Speak Chinese.\n',
    'MEMORY.md': 'secret diary',
    'HEARTBEAT.md': 'every: 30m\n\nreply HEARTBEAT_OK',
    'TOOLS.md': 'use bash carefully',
  })
  assert.match(text, /TOOLS\.md/)
  assert.doesNotMatch(text, /USER\.md/)
  assert.doesNotMatch(text, /Speak Chinese/)
  assert.doesNotMatch(text, /MEMORY\.md/)
  assert.doesNotMatch(text, /secret diary/)
  assert.doesNotMatch(text, /HEARTBEAT/)
  assert.doesNotMatch(text, /HEARTBEAT_OK/)
})
