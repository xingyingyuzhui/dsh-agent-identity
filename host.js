import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import {
  IDENTITY_FILES,
  PROMPT_FILES,
  WRITABLE_IDENTITY_FILES,
  defaultDshHome,
  isDsClawPath,
  isVaultFile,
  isWritableIdentityFile,
  renderIdentityPrompt,
  safeJoin,
} from './identity-files.mjs'
import { ensureMemoryDir } from './identity-memory.mjs'

export const name = 'dsh-agent-identity'
export const inject = ['systemPrompt', 'webServer']

const BODY_CAP = 65536
const LOOPBACK_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/

let dshHome = defaultDshHome()
const _internal = {
  setDshHome(dir) { dshHome = dir },
  getDshHome() { return dshHome },
}
export { _internal }

const writeJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

const readJsonBody = (req, cap = BODY_CAP) => new Promise((resolveBody, reject) => {
  let size = 0
  const chunks = []
  req.on('data', (chunk) => {
    size += chunk.length
    if (size > cap) {
      reject(new Error('body too large'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => {
    try {
      resolveBody(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
    } catch {
      reject(new Error('invalid json body'))
    }
  })
  req.on('error', reject)
})

const guard = (req, res) => {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'method not allowed' })
    return false
  }
  const headers = req.headers || {}
  if (headers['x-dsh-agent-identity'] !== '1') {
    writeJson(res, 403, { ok: false, error: 'missing csrf header' })
    return false
  }
  const origin = headers.origin
  if (origin !== undefined && origin !== null && !LOOPBACK_ORIGIN.test(origin)) {
    writeJson(res, 403, { ok: false, error: 'origin not allowed' })
    return false
  }
  return true
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return ''
    throw error
  }
}

async function readIdentityFiles(root) {
  const files = {}
  for (let i = 0; i < IDENTITY_FILES.length; i++) {
    const name = IDENTITY_FILES[i]
    const path = safeJoin(root, name, dshHome)
    if (!path) continue
    files[name] = await readOptionalFile(path)
  }
  return files
}

function cwdOf(agent) {
  const session = agent && agent.session
  const header = session && session.header
  return header && header.cwd ? String(header.cwd) : ''
}

function loadPrompt(root) {
  const files = {}
  for (let i = 0; i < PROMPT_FILES.length; i++) {
    const name = PROMPT_FILES[i]
    const path = safeJoin(root, name, dshHome)
    if (!path) continue
    try {
      files[name] = readFileSync(path, 'utf8')
    } catch (error) {
      if (error && error.code === 'ENOENT') files[name] = ''
    }
  }
  return renderIdentityPrompt(files)
}

export function apply(ctx) {
  const stopSection = ctx.systemPrompt.section({
    name: 'dsh-agent-identity',
    order: 15,
    text: (assemble) => {
      const cwd = cwdOf(assemble && assemble.agent)
      if (!isDsClawPath(cwd, dshHome)) return ''
      return loadPrompt(cwd)
    },
  })

  const handle = (fn) => async (req, res) => {
    if (!guard(req, res)) return
    try {
      const body = await readJsonBody(req)
      await fn(req, res, body)
    } catch (error) {
      writeJson(res, 400, { ok: false, error: error && error.message ? error.message : 'bad request' })
    }
  }

  const routes = [
    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-agent-identity/read',
      handler: handle(async (_req, res, body) => {
        const root = body && body.root
        if (!isDsClawPath(root, dshHome)) {
          writeJson(res, 400, { ok: false, error: 'invalid identity root' })
          return
        }
        const files = await readIdentityFiles(root)
        writeJson(res, 200, { ok: true, files })
      }),
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-agent-identity/write',
      handler: handle(async (_req, res, body) => {
        const root = body && body.root
        const incoming = body && body.files
        if (!isDsClawPath(root, dshHome) || incoming == null || typeof incoming !== 'object') {
          writeJson(res, 400, { ok: false, error: 'invalid identity write' })
          return
        }
        const names = Object.keys(incoming)
        if (names.some((name) => isVaultFile(name))) {
          writeJson(res, 400, { ok: false, error: 'USER.md and MEMORY.md are owned by memory' })
          return
        }
        const written = []
        for (let i = 0; i < WRITABLE_IDENTITY_FILES.length; i++) {
          const name = WRITABLE_IDENTITY_FILES[i]
          if (!Object.prototype.hasOwnProperty.call(incoming, name)) continue
          if (!isWritableIdentityFile(name)) continue
          const path = safeJoin(root, name, dshHome)
          if (!path) continue
          const text = typeof incoming[name] === 'string' ? incoming[name] : ''
          await writeFile(path, text)
          written.push(name)
        }
        ensureMemoryDir(root)
        writeJson(res, 200, { ok: true, written })
      }),
    }),
  ]

  ctx.effect(() => () => {
    if (typeof stopSection === 'function') stopSection()
    for (const dispose of routes) {
      if (typeof dispose === 'function') dispose()
    }
  })
}
