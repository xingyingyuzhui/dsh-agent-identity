import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { apply, inject, name } from '../host.js'

test('host named exports', () => {
  assert.equal(name, 'dsh-agent-identity')
  assert.deepEqual(inject, ['systemPrompt', 'webServer'])
})

test('host never starts an idle heartbeat ticker', () => {
  const src = readFileSync(new URL('../host.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /setInterval/)
  assert.doesNotMatch(src, /tickHeartbeats/)
  assert.doesNotMatch(src, /agent\.followup/)
})

test('apply registers prompt section and routes', () => {
  const routes = []
  const sections = []
  let stop
  const ctx = {
    systemPrompt: {
      section(entry) {
        sections.push(entry)
        return () => {}
      },
    },
    webServer: {
      register(entry) {
        routes.push(entry)
        return () => {}
      },
    },
    effect(fn) { stop = fn() },
  }
  apply(ctx)
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, 'dsh-agent-identity')
  assert.equal(typeof sections[0].text, 'function')
  assert.equal(sections[0].text({}), '')
  assert.deepEqual(routes.map((row) => row.path), [
    '/dsh-agent-identity/read',
    '/dsh-agent-identity/write',
  ])
  if (typeof stop === 'function') stop()
})
