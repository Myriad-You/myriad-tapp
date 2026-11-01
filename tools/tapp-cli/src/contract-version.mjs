// minContractVersion: a manifest declares it only when it uses something added
// after contract version 1. Hosts from before the field reject any manifest
// that carries it, so it is required exactly when needed and flagged otherwise.

function diagnostic(severity, code, message) {
  return { severity, code, message, file: 'manifest.json' }
}

/**
 * @param {{
 *   manifest: Record<string, unknown>,
 *   usedActions: Array<{ action: string }>,
 *   contract: {
 *     contractVersion: number,
 *     manifestFieldsSince?: Record<string, number>,
 *     actionsSince?: Record<string, number>,
 *   },
 * }} input
 */
export function contractVersionDiagnostics({ manifest, usedActions, contract }) {
  const declared = manifest.minContractVersion
  if (declared !== undefined && (!Number.isInteger(declared) || declared < 1)) {
    return [diagnostic('error', 'invalid-contract-version', 'minContractVersion must be a positive integer')]
  }

  const needs = new Map()
  const need = (what, since) => {
    if (Number.isInteger(since) && since > 1 && !needs.has(what)) needs.set(what, since)
  }
  for (const field of Object.keys(manifest)) need(`manifest field ${field}`, contract.manifestFieldsSince?.[field])
  for (const { action } of usedActions) need(action, contract.actionsSince?.[action])
  const required = Math.max(1, ...needs.values())

  const diagnostics = []
  if (declared > contract.contractVersion) {
    diagnostics.push(diagnostic(
      'error',
      'contract-version-too-new',
      `minContractVersion ${declared} is newer than contract version ${contract.contractVersion} this CLI knows; upgrade @myriad-you/tapp-cli`,
    ))
  }
  if (required > 1 && !(declared >= required)) {
    const uses = [...needs].filter(([, since]) => since === required).map(([what]) => what)
    diagnostics.push(diagnostic(
      'error',
      'contract-version-required',
      `Uses ${uses.join(', ')} (contract version ${required}); add "minContractVersion": ${required} to manifest.json`,
    ))
  } else if (declared !== undefined && declared > (required > 1 ? required : 0)) {
    diagnostics.push(diagnostic(
      'warning',
      'contract-version-unneeded',
      required > 1
        ? `minContractVersion ${declared} is higher than the ${required} this Tapp needs; hosts on contract ${required} cannot install it`
        : 'minContractVersion is only needed for features added after contract version 1; hosts that predate the field reject any manifest carrying it',
    ))
  }
  return diagnostics
}
