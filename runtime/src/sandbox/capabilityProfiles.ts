import type { TappBridge } from '../TappBridge'
import sandboxContract from '../../../shared/tapp_sandbox_contract.json' with { type: 'json' }

export type SandboxCapabilityProfile = 'page' | 'widget' | 'headless'

/**
 * 每种配置去掉哪些动作（例如后台 core 碰不到可见/控制面动作）。数据在
 * `shared/tapp_sandbox_contract.json` 的 `capabilities.deniedActions`（与 CLI/SDK
 * 契约同源）；契约里没列的配置什么都不去掉。
 */
const DENIED_ACTIONS: Partial<Record<SandboxCapabilityProfile, readonly string[]>>
  = sandboxContract.capabilities.deniedActions

export function deniedActionsFor(profile: SandboxCapabilityProfile): readonly string[] {
  return DENIED_ACTIONS[profile] ?? []
}

export function applySandboxCapabilityProfile(
  bridge: TappBridge,
  profile: SandboxCapabilityProfile,
): void {
  for (const action of deniedActionsFor(profile)) {
    bridge.unregisterHandler(action)
  }
}
