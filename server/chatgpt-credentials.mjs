import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const credentialPath = '.siftory/chatgpt-credentials.dpapi'
const maxCredentialBytes = 64 * 1024

// Windows DPAPI binds the encrypted record to this Windows account. Secrets are
// passed over a child process pipe, never on a command line or in a browser.
const protectScript = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$value = [Console]::In.ReadToEnd()
$bytes = [Text.Encoding]::UTF8.GetBytes($value)
$sealed = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Convert]::ToBase64String($sealed))
`
const unprotectScript = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$value = [Console]::In.ReadToEnd()
$bytes = [Convert]::FromBase64String($value)
$plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))
`

function runDpapi(script, input) {
  if (process.platform !== 'win32') throw new Error('Protected ChatGPT sessions require Windows DPAPI on this installation.')
  return new Promise((resolve, reject) => {
    const command = Buffer.from(script, 'utf16le').toString('base64')
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', command], {
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      output += chunk
      if (output.length > maxCredentialBytes * 2) child.kill()
    })
    child.stderr.resume()
    const timer = setTimeout(() => child.kill(), 15_000).unref()
    child.on('error', () => { clearTimeout(timer); reject(new Error('Windows credential protection is unavailable.')) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && output.length) resolve(output)
      else reject(new Error('Windows credential protection failed.'))
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

export function createChatGptCredentialStore(path = credentialPath) {
  return {
    async load() {
      let sealed
      try { sealed = await readFile(path, 'utf8') } catch (error) {
        if (error.code === 'ENOENT') return undefined
        throw error
      }
      if (sealed.length > maxCredentialBytes || !/^[A-Za-z0-9+/=]+$/.test(sealed.trim())) throw new Error('Saved ChatGPT credentials are unreadable.')
      const record = JSON.parse(await runDpapi(unprotectScript, sealed))
      if (record.version !== 1 || !/^[a-f0-9]{64}$/.test(record.id) ||
        !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/u.test(record.origin) ||
        typeof record.clientId !== 'string' || !record.clientId ||
        typeof record.refreshToken !== 'string' || !record.refreshToken ||
        typeof record.connectionId !== 'string' || !record.connectionId ||
        !Array.isArray(record.models) || !record.models.length) throw new Error('Saved ChatGPT credentials are invalid.')
      return record
    },
    async save(record) {
      const sealed = await runDpapi(protectScript, JSON.stringify({ ...record, version: 1 }))
      await mkdir(dirname(path), { recursive: true })
      const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
      try {
        await writeFile(temporary, sealed, { flag: 'wx', mode: 0o600, flush: true })
        await rename(temporary, path)
      } finally {
        await rm(temporary, { force: true })
      }
    },
    async clear() { await rm(path, { force: true }) },
  }
}
