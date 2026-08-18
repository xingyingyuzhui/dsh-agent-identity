import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { apply, inject, name, _internal } from '../host.js'

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

test('identity write rejects vault files and traversal roots', async () => {
  const { mkdtemp, mkdir, writeFile, readFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'id-write-'))
  const root = join(home, 'DSclaw', 'alpha')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'SOUL.md'), 'old soul\n')
  await writeFile(join(root, 'MEMORY.md'), 'keep me\n')
  _internal.setDshHome(home)
  const routes = {}
  apply({
    systemPrompt: { section() { return () => {} } },
    webServer: {
      register(entry) {
        routes[entry.path] = entry.handler
        return () => {}
      },
    },
    effect() {},
  })
  const replies = []
  const res = {
    writeHead(status) { this.status = status },
    end(body) { replies.push({ status: this.status, body: JSON.parse(body) }) },
  }
  const post = (path, body) => routes[path]({
    method: 'POST',
    headers: { 'x-dsh-agent-identity': '1', origin: 'http://127.0.0.1' },
    on(name, fn) {
      if (name === 'data') fn(Buffer.from(JSON.stringify(body)))
      if (name === 'end') fn()
    },
  }, res)
  await post('/dsh-agent-identity/write', { root, files: { 'MEMORY.md': 'x'.repeat(3200) } })
  assert.equal(replies.at(-1).status, 400)
  assert.equal(await readFile(join(root, 'MEMORY.md'), 'utf8'), 'keep me\n')
  await post('/dsh-agent-identity/write', { root: join(root, '..', '..', 'outside'), files: { 'SOUL.md': 'nope' } })
  assert.equal(replies.at(-1).status, 400)
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
