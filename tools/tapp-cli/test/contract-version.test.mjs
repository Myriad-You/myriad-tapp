import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { contractVersionDiagnostics } from '../src/contract-version.mjs'
import { createProject, generatedContract, inspectProject } from '../src/project.mjs'

// A contract at version 3 where one field and one action came later.
const contract = {
  contractVersion: 3,
  manifestFieldsSince: { placement: 3 },
  actionsSince: { 'capabilities.get': 2 },
}

function codes(manifest, actions = []) {
  return contractVersionDiagnostics({
    manifest,
    usedActions: actions.map((action) => ({ action })),
    contract,
  }).map(({ severity, code }) => `${severity}:${code}`)
}

describe('minContractVersion', () => {
  it('is required, with the value to write, when a newer action or field is used', () => {
    const [diagnostic] = contractVersionDiagnostics({
      manifest: { id: 'x' },
      usedActions: [{ action: 'capabilities.get' }, { action: 'storage.get' }],
      contract,
    })
    assert.equal(diagnostic.code, 'contract-version-required')
    assert.match(diagnostic.message, /capabilities\.get/)
    assert.match(diagnostic.message, /"minContractVersion": 2/)

    assert.deepEqual(codes({ placement: {} }, ['capabilities.get']), ['error:contract-version-required'])
    assert.deepEqual(codes({ placement: {}, minContractVersion: 2 }), ['error:contract-version-required'])
    assert.deepEqual(codes({ placement: {}, minContractVersion: 3 }, ['capabilities.get']), [])
    assert.deepEqual(codes({ minContractVersion: 2 }, ['capabilities.get']), [])
  })

  it('is flagged when nothing needs it or it asks for more than needed', () => {
    assert.deepEqual(codes({}), [])
    assert.deepEqual(codes({ minContractVersion: 1 }), ['warning:contract-version-unneeded'])
    assert.deepEqual(codes({ minContractVersion: 3 }, ['capabilities.get']), ['warning:contract-version-unneeded'])
  })

  it('rejects values this CLI cannot vouch for', () => {
    for (const value of [0, -1, 1.5, '2', null]) {
      assert.deepEqual(codes({ minContractVersion: value }), ['error:invalid-contract-version'], String(value))
    }
    assert.deepEqual(codes({ minContractVersion: 4 }), [
      'error:contract-version-too-new',
      'warning:contract-version-unneeded',
    ])
  })

  it('ships the contract version and what came after version 1', () => {
    const shipped = generatedContract()
    assert.ok(Number.isInteger(shipped.contractVersion) && shipped.contractVersion >= 1)
    assert.equal(typeof shipped.manifestFieldsSince, 'object')
    assert.equal(typeof shipped.actionsSince, 'object')
    assert.ok(shipped.schema.properties.minContractVersion)
  })

  it('reaches check through the project inspection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'myriad-tapp-contract-version-'))
    try {
      await createProject(root, { type: 'page' })
      const manifestPath = join(root, 'manifest.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      manifest.minContractVersion = 1
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      const report = await inspectProject(root)
      assert.ok(report.diagnostics.some(({ code }) => code === 'contract-version-unneeded'))
      assert.equal(report.diagnostics.filter(({ severity }) => severity === 'error').length, 0)
    } finally {
      await rm(root, { recursive: true })
    }
  })
})
