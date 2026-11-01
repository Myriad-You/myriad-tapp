//! The contract version a manifest needs, read before the strict parse.
//!
//! Manifests are parsed with `deny_unknown_fields`, so a host that predates a
//! field rejects the whole manifest with a parse error. A manifest that relies
//! on something added after version 1 says so in `minContractVersion`; a host
//! reads that one field from the raw JSON first and answers a version newer
//! than its own with [`ContractTooNew`] instead. Hosts from before this field
//! existed still reject it like any unknown field, so a manifest carries it
//! only when it needs it (the CLI checks that).

use serde_json::Value;

/// The contract version this crate implements. Bump it when the contract gains
/// something an app can rely on, a manifest field or a bridge action, and
/// record what came with it: fields in [`MANIFEST_FIELDS_SINCE`], actions in
/// `actionsSince` of `shared/tapp_sandbox_contract.json`.
pub const TAPP_CONTRACT_VERSION: u32 = 1;

/// Top-level manifest fields and the contract version that added them. A field
/// not listed has been there since version 1.
pub const MANIFEST_FIELDS_SINCE: &[(&str, u32)] = &[];

/// The manifest field, as it appears in the raw JSON.
pub const MIN_CONTRACT_VERSION_FIELD: &str = "minContractVersion";

/// The manifest needs a newer contract than this host implements: the host
/// must be updated before it can install the Tapp.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ContractTooNew {
    pub required: u64,
    pub supported: u32,
}

impl std::fmt::Display for ContractTooNew {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "This Tapp needs a newer host: it requires Tapp contract version {}, this host supports {}",
            self.required, self.supported
        )
    }
}

impl std::error::Error for ContractTooNew {}

/// Check `minContractVersion` in raw manifest JSON against this host's
/// contract. Only a well-formed integer newer than [`TAPP_CONTRACT_VERSION`]
/// fails here; a missing field passes, and a malformed one is left to the
/// strict parse and validation to reject.
pub fn check_min_contract_version(raw: &Value) -> Result<(), ContractTooNew> {
    match raw.get(MIN_CONTRACT_VERSION_FIELD).and_then(Value::as_u64) {
        Some(required) if required > u64::from(TAPP_CONTRACT_VERSION) => Err(ContractTooNew {
            required,
            supported: TAPP_CONTRACT_VERSION,
        }),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_newer_version_is_the_only_failure() {
        let newer = u64::from(TAPP_CONTRACT_VERSION) + 1;
        assert_eq!(
            check_min_contract_version(&json!({ "minContractVersion": newer })),
            Err(ContractTooNew {
                required: newer,
                supported: TAPP_CONTRACT_VERSION,
            })
        );
        for passes in [
            json!({}),
            json!({ "minContractVersion": TAPP_CONTRACT_VERSION }),
            json!({ "minContractVersion": "999" }),
            json!({ "minContractVersion": -1 }),
            json!({ "minContractVersion": 2.5 }),
            json!([]),
        ] {
            assert_eq!(check_min_contract_version(&passes), Ok(()), "{passes}");
        }
    }

    #[test]
    fn fields_since_name_versions_this_crate_implements() {
        for (field, since) in MANIFEST_FIELDS_SINCE {
            assert!(
                (2..=u64::from(TAPP_CONTRACT_VERSION)).contains(&u64::from(*since)),
                "{field} since {since}"
            );
        }
    }
}
