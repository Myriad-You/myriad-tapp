import type { TappBridge, TappCapabilities } from './TappBridge.ts'
import type { TestTappKernel } from './testing.ts'
import type { TappInstance, TappPermission } from './types'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { applySandboxCapabilityProfile, deniedActionsFor } from './sandbox/capabilityProfiles.ts'
import { createTestTappKernel } from './testing.ts'

const SESSION = 'capabilities-session-token'

function makeInstance(permissions: TappPermission[]): TappInstance {
  return {
    id: 'com.example.capabilities',
    manifest: {
      id: 'com.example.capabilities',
      name: 'Capabilities',
      version: '1.0.0',
      core: { entry: 'core.js' },
      permissions,
      category: 'utility',
      minContractVersion: 2,
    },
    status: 'running',
    installedAt: '2026-11-01T00:00:00Z',
    grantedPermissions: permissions,
    userRole: 'admin',
  }
}

describe('context.getCapabilities', () => {
  let bridge: TappBridge
  let test: TestTappKernel
  let iframe: HTMLIFrameElement
  let instance: TappInstance
  let responses: Array<Record<string, unknown>>
  let seq: number

  beforeEach(() => {
    seq = 0
    responses = []
    instance = makeInstance(['storage:read', 'ui:confirm'])
    test = createTestTappKernel()
    bridge = test.kernel.createBridge()
    const contentWindow = {
      postMessage: (message: unknown) => {
        responses.push(message as Record<string, unknown>)
      },
    } as unknown as Window
    iframe = { contentWindow } as HTMLIFrameElement
    bridge.initialize(iframe, instance, SESSION)
    bridge.attachSource()
  })

  afterEach(() => {
    bridge.destroy()
  })

  async function ask(): Promise<TappCapabilities> {
    test.dispatch({
      source: iframe.contentWindow,
      data: {
        type: 'request',
        id: `req-capabilities-${++seq}`,
        action: 'context.getCapabilities',
        payload: { api: 'context', method: 'getCapabilities', args: [] },
        timestamp: Date.now(),
        _sessionToken: SESSION,
      },
    } as MessageEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const payload = responses.at(-1)?.payload as { success?: boolean, data?: TappCapabilities }
    assert.equal(payload?.success, true)
    return payload.data!
  }

  function register(...actions: string[]) {
    for (const action of actions) {
      bridge.registerHandler(action, async () => ({ success: true, data: null }))
    }
  }

  it('lists implemented actions that are public or granted, and the granted permissions', async () => {
    register('storage.get', 'storage.set', 'ui.confirm', 'lifecycle.ready')
    const caps = await ask()
    assert.deepEqual(caps.permissions, ['storage:read', 'ui:confirm'])
    assert.deepEqual(caps.actions, [
      'context.getCapabilities',
      'lifecycle.ready',
      'storage.get',
      'ui.confirm',
    ])
  })

  it('follows what the host implements and what the profile removes', async () => {
    let caps = await ask()
    assert.deepEqual(caps.actions, ['context.getCapabilities'])

    register('ui.confirm', 'storage.get')
    applySandboxCapabilityProfile(bridge, 'headless')
    assert.ok(deniedActionsFor('headless').includes('ui.confirm'))
    caps = await ask()
    assert.deepEqual(caps.actions, ['context.getCapabilities', 'storage.get'])
  })

  it('follows the live grants', async () => {
    register('storage.get', 'storage.set')
    instance.grantedPermissions = ['storage:read', 'storage:write']
    const caps = await ask()
    assert.deepEqual(caps.permissions, ['storage:read', 'storage:write'])
    // storage.set needs storage:write, which the first grant lacked.
    assert.deepEqual(caps.actions, ['context.getCapabilities', 'storage.get', 'storage.set'])
  })

  it('cannot be replaced by a host handler', () => {
    assert.throws(
      () => bridge.registerHandler('context.getCapabilities', async () => ({ success: true, data: {} })),
      /answered by the bridge itself/,
    )
  })
})
