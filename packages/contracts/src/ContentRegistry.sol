// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * @title ContentRegistry
 * @notice Immutable registry mapping `manifestCid` to creator and metadata.
 * @dev Sprint 0 placeholder. Full implementation in Sprint 2 per
 *      docs/protocol-spec/6-content-registry.md. Axiom: persistence does not
 *      imply distribution — on-chain record is permanent; distribution is
 *      regulated off-chain via ModerationRegistry.
 *
 * Invariants (to be enforced in v0.1):
 *   1. Once registered, record.owner never changes.
 *   2. Once registered, record.timestamp and record.parentCid never change.
 *   3. policyFlags may only be mutated by MODERATOR_ROLE (ModerationRegistry).
 */
contract ContentRegistry {
    struct ContentRecord {
        address owner;
        uint64 timestamp;
        uint8 policyFlags;
        bytes32 parentCid;
    }

    mapping(bytes32 manifestCid => ContentRecord) private _records;

    event ContentRegistered(
        bytes32 indexed manifestCid,
        address indexed owner,
        bytes32 indexed parentCid,
        uint64 timestamp,
        uint8 policyFlags
    );

    event PolicyFlagsUpdated(bytes32 indexed manifestCid, uint8 oldFlags, uint8 newFlags, address indexed by);

    error AlreadyRegistered();
    error ZeroCid();
    error SelfParent();
    error ParentNotRegistered();
    error ReservedFlag();

    /// @notice Returns the full record for a given manifest CID.
    function getRecord(bytes32 manifestCid) external view returns (ContentRecord memory) {
        return _records[manifestCid];
    }

    /// @notice Returns true if the given manifest CID has been registered.
    function isRegistered(bytes32 manifestCid) external view returns (bool) {
        return _records[manifestCid].owner != address(0);
    }

    /// @notice Returns the owner of a given manifest CID, or address(0) if unregistered.
    function ownerOf(bytes32 manifestCid) external view returns (address) {
        return _records[manifestCid].owner;
    }
}
