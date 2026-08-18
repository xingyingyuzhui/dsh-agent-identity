import assert from 'node:assert/strict'
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { isDsClawPath, renderIdentityPrompt, safeJoin } from '../identity-files.mjs'

async function clawRoot(home, slug) {
  const root = join(home, 'DSclaw', slug)
  await mkdir(root, { recursive: true })
  return root
}

test('two Claw agents do not share identity prompt text', async () => {
  const home = await mkdtemp(join(tmpdir(), 'id-iso-'))
  const a = await clawRoot(home, 'alpha')
  const b = await clawRoot(home, 'beta')
  await writeFile(join(a, 'SOUL.md'), 'You are Alpha.\n')
  await writeFile(join(b, 'SOUL.md'), 'You are Beta.\n')
  const promptA = renderIdentityPrompt({ 'SOUL.md': 'You are Alpha.\n' })
  const promptB = renderIdentityPrompt({ 'SOUL.md': 'You are Beta.\n' })
  assert.match(promptA, /Alpha/)
  assert.doesNotMatch(promptA, /Beta/)
  assert.match(promptB, /Beta/)
  assert.doesNotMatch(promptB, /Alpha/)
  assert.equal(safeJoin(a, 'SOUL.md'), a + '/SOUL.md')
  assert.notEqual(safeJoin(a, 'SOUL.md'), safeJoin(b, 'SOUL.md'))
})

test('a symlink into DSclaw still counts as an identity root', async () => {
  const home = await mkdtemp(join(tmpdir(), 'id-link-'))
  const real = await clawRoot(home, 'alpha')
  const alias = join(home, 'alias-alpha')
  await symlink(real, alias)
  assert.equal(isDsClawPath(real), true)
  assert.equal(isDsClawPath(alias), true)
  assert.equal(isDsClawPath(home), false)
})
