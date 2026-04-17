// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title ContentRegistry
 * @notice Immutable registry mapping `manifestCid` to creator and metadata.
 * @dev Sprint 2 implementation of the on-chain anchor for the Aevia protocol.
 *      Axiom: persistence does not imply distribution. This contract records the
 *      fact that a signed manifest exists; distribution, ranking, and feed
 *      surfacing are governed off-chain via ModerationRegistry and the Risk
 *      Score pipeline.
 *
 * Signer model:
 *   - The content owner is NOT `msg.sender`. A relayer (Privy paymaster, server,
 *     or third party) may submit the transaction while the manifest is signed
 *     by the creator's wallet.
 *   - `owner` is an explicit argument. The signature commits to `owner`,
 *     `manifestCid`, `parentCid`, `policyFlags`, `chainId`, and `nonce` via
 *     EIP-712. An attacker who forges `owner` produces an invalid signature.
 *   - Validation dispatches to ERC-1271 automatically via OpenZeppelin's
 *     `SignatureChecker` when `owner` has deployed code (smart wallets), or to
 *     ECDSA recovery otherwise (EOAs and Privy embedded EOAs).
 *   - This is the same pattern used by EIP-2612 Permit and OpenZeppelin's
 *     `GovernorCountingSimple.castVoteBySig` — the caller names the signer and
 *     the contract verifies, which is safe because the signature commits to
 *     the signer.
 *
 * Replay resistance:
 *   - `nonces[owner]` is monotonically increasing per owner. The signed payload
 *     commits to `nonce` and `chainId`, so replay is impossible across chains
 *     (domain separator recomputed on chainId change) and within a chain
 *     (nonce consumed exactly once per registration).
 *   - `DOMAIN_SEPARATOR()` is recomputed if `block.chainid` diverges from the
 *     value cached at deploy time, so signatures remain valid across honest
 *     forks without becoming cross-chain-valid.
 *
 * Invariants:
 *   1. Once registered, `record.owner` never changes.
 *   2. Once registered, `record.timestamp` and `record.parentCid` never change.
 *   3. `policyFlags` top bit (0x80) is reserved for future moderator use.
 *   4. A manifest cannot be its own parent.
 *   5. A parent CID must itself be registered before it can be referenced.
 *   6. `manifestCid == bytes32(0)` is never a valid CID.
 */
contract ContentRegistry {
    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    struct ContentRecord {
        address owner;
        uint64 timestamp;
        uint8 policyFlags;
        bytes32 parentCid;
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    mapping(bytes32 manifestCid => ContentRecord) private _records;
    mapping(address owner => uint256) private _nonces;

    // ---------------------------------------------------------------
    // EIP-712 constants
    // ---------------------------------------------------------------

    /// @notice EIP-712 domain name. Distinct from the `Aevia Manifest` domain
    ///         used inside manifests themselves; this domain scopes the
    ///         on-chain register-content authorization.
    string public constant DOMAIN_NAME = "Aevia ContentRegistry";

    /// @notice EIP-712 domain version.
    string public constant DOMAIN_VERSION = "1";

    /// @notice EIP-712 domain typehash.
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice EIP-712 typehash for the `RegisterContent` struct.
    /// @dev Field order MUST match the off-chain typed-data payload exactly.
    bytes32 public constant REGISTER_TYPEHASH = keccak256(
        "RegisterContent(address owner,bytes32 manifestCid,bytes32 parentCid,uint8 policyFlags,uint256 chainId,uint256 nonce)"
    );

    /// @notice Reserved bit in `policyFlags`. Creators MUST NOT set this bit;
    ///         it is reserved for moderator use via a future ModerationRegistry.
    uint8 public constant RESERVED_POLICY_BIT = 0x80;

    // ---------------------------------------------------------------
    // Cached domain separator (invalidated on chainId change)
    // ---------------------------------------------------------------

    uint256 private immutable _CACHED_CHAIN_ID;
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event ContentRegistered(
        bytes32 indexed manifestCid,
        address indexed owner,
        bytes32 indexed parentCid,
        uint64 timestamp,
        uint8 policyFlags
    );

    event PolicyFlagsUpdated(bytes32 indexed manifestCid, uint8 oldFlags, uint8 newFlags, address indexed by);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error AlreadyRegistered();
    error ZeroCid();
    error SelfParent();
    error ParentNotRegistered();
    error ReservedFlag();
    error InvalidSignature();
    error ZeroSigner();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor() {
        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(block.chainid);
    }

    // ---------------------------------------------------------------
    // External: state-changing
    // ---------------------------------------------------------------

    /**
     * @notice Register a signed manifest CID on-chain.
     * @param owner         The content owner. MUST match the EIP-712 signer.
     *                      For EOAs, this is the signing EOA. For smart wallets,
     *                      this is the wallet contract address.
     * @param manifestCid   The CIDv1 of the JCS-canonicalized manifest. MUST NOT be zero.
     * @param parentCid     The parent manifest CID for clips; `bytes32(0)` when no parent.
     * @param policyFlags   Creator-declared content flags. Top bit (0x80) is reserved.
     * @param signature     EIP-712 signature over `RegisterContent(owner, manifestCid,
     *                      parentCid, policyFlags, chainId, nonce)` produced by `owner`.
     *                      EOA signatures are 65 bytes (r,s,v). Smart-wallet signatures
     *                      are variable-length per ERC-1271.
     *
     * The `owner` argument is explicit (not `msg.sender`) so relayers can submit
     * on behalf of signers. Safety: the signature commits to `owner`; any
     * tampering invalidates the signature.
     */
    function registerContent(
        address owner,
        bytes32 manifestCid,
        bytes32 parentCid,
        uint8 policyFlags,
        bytes calldata signature
    )
        external
    {
        // ---- Shape checks ---------------------------------------------
        if (owner == address(0)) revert ZeroSigner();
        if (manifestCid == bytes32(0)) revert ZeroCid();
        if (parentCid == manifestCid) revert SelfParent();
        if (policyFlags & RESERVED_POLICY_BIT != 0) revert ReservedFlag();
        if (_records[manifestCid].owner != address(0)) revert AlreadyRegistered();
        if (parentCid != bytes32(0) && _records[parentCid].owner == address(0)) {
            revert ParentNotRegistered();
        }

        // ---- Verify signature -----------------------------------------
        uint256 nonce = _nonces[owner];
        bytes32 digest = _hashRegisterContent(owner, manifestCid, parentCid, policyFlags, nonce);

        // SignatureChecker dispatches to ERC-1271 for contract owners and to
        // ECDSA recovery for EOA owners. It enforces low-s canonicalization
        // internally (OpenZeppelin v5), mitigating signature malleability.
        if (!SignatureChecker.isValidSignatureNow(owner, digest, signature)) {
            revert InvalidSignature();
        }

        // ---- Consume nonce --------------------------------------------
        // A nonce value is valid for exactly one registration. Consuming it
        // before emitting the event guarantees re-entrant `registerContent`
        // calls via malicious ERC-1271 `isValidSignature` observe the updated
        // state; in practice `isValidSignature` is `view` and cannot reenter,
        // but ordering is checks-effects-interactions compliant regardless.
        unchecked {
            _nonces[owner] = nonce + 1;
        }

        // ---- Persist record -------------------------------------------
        uint64 ts = uint64(block.timestamp);
        _records[manifestCid] =
            ContentRecord({ owner: owner, timestamp: ts, policyFlags: policyFlags, parentCid: parentCid });

        emit ContentRegistered(manifestCid, owner, parentCid, ts, policyFlags);
    }

    // ---------------------------------------------------------------
    // External: views
    // ---------------------------------------------------------------

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

    /// @notice Returns the next unused nonce for `owner`.
    /// @dev Clients MUST sign with this value; it is incremented on success.
    function nonces(address owner) external view returns (uint256) {
        return _nonces[owner];
    }

    /// @notice EIP-712 domain separator for the current chainId.
    /// @dev Recomputed if `block.chainid` differs from the value cached at
    ///      deploy time, so signatures remain valid across forks without
    ///      becoming valid on unintended chains.
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        if (block.chainid == _CACHED_CHAIN_ID) {
            return _CACHED_DOMAIN_SEPARATOR;
        }
        return _buildDomainSeparator(block.chainid);
    }

    /// @notice Convenience: returns the EIP-712 digest a client must sign for
    ///         a given `(owner, manifestCid, parentCid, policyFlags)` tuple.
    /// @dev Uses the current nonce for `owner`. Clients MUST read this digest
    ///      immediately before signing to avoid stale-nonce races.
    function hashRegisterContent(
        address owner,
        bytes32 manifestCid,
        bytes32 parentCid,
        uint8 policyFlags
    )
        external
        view
        returns (bytes32)
    {
        return _hashRegisterContent(owner, manifestCid, parentCid, policyFlags, _nonces[owner]);
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /// @dev Builds the EIP-712 digest for a RegisterContent struct.
    function _hashRegisterContent(
        address owner,
        bytes32 manifestCid,
        bytes32 parentCid,
        uint8 policyFlags,
        uint256 nonce
    )
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(REGISTER_TYPEHASH, owner, manifestCid, parentCid, uint256(policyFlags), block.chainid, nonce)
        );
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR(), structHash));
    }

    /// @dev Builds the EIP-712 domain separator for the given chainId.
    function _buildDomainSeparator(uint256 chainId) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256(bytes(DOMAIN_NAME)), keccak256(bytes(DOMAIN_VERSION)), chainId, address(this)
            )
        );
    }
}
