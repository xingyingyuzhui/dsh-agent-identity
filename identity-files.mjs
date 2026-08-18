// Pure helpers for Claw identity files. No network.

import { realpathSync } from 'node:fs'

export const IDENTITY_FILES = ['AGENTS.md', 'SOUL.md', 'TOOLS.md', 'IDENTITY.md', 'USER.md', 'HEARTBEAT.md', 'MEMORY.md']
export const PROMPT_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'TOOLS.md']
export const FILE_CAP = 32768

export function isDsClawPath(path) {
  if (typeof path !== 'string' || path === '') return false
  const raw = path.replace(/\\/g, '/')
  if (/(^|\/)DSclaw(\/|$)/.test(raw)) return true
  try {
    return /(^|\/)DSclaw(\/|$)/.test(realpathSync(path).replace(/\\/g, '/'))
  } catch {
    return false
  }
}

export function isIdentityFile(name) {
  return IDENTITY_FILES.indexOf(name) >= 0
}

export function clipText(text, cap) {
  const limit = cap == null ? FILE_CAP : cap
  const value = typeof text === 'string' ? text : ''
  if (value.length <= limit) return value
  return value.slice(0, limit) + '\n\n[truncated]\n'
}

export function renderIdentityPrompt(files) {
  const parts = []
  for (let i = 0; i < PROMPT_FILES.length; i++) {
    const name = PROMPT_FILES[i]
    const text = clipText(files && files[name] ? files[name] : '')
    if (!text.trim()) continue
    parts.push('## ' + name + '\n\n' + text.trim())
  }
  if (parts.length === 0) return ''
  return [
    '# Claw agent identity',
    '',
    'These files are this agent\'s private persona. Follow them for this session.',
    'Do not treat them as optional flavor.',
    '',
    parts.join('\n\n'),
  ].join('\n')
}

export function safeJoin(root, name) {
  if (!isDsClawPath(root) || !isIdentityFile(name)) return ''
  const base = String(root).replace(/[/\\]+$/, '')
  return base + '/' + name
}
