// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * @title IContentRegistry
 * @notice Minimal interface consumed by BoostRouter to resolve a manifest
 *         hash to its creator address.
 *
 * @dev Matches the `ownerOf` and `isRegistered` methods on the canonical
 *      `ContentRegistry` implementation. Defined as a separate interface
 *      to keep BoostRouter decoupled from ContentRegistry's full surface
 *      (registration, policy flags, EIP-712 signature verification).
 */
interface IContentRegistry {
    /**
     * @notice Returns the creator address that registered `manifestCid`.
     * @dev MUST revert if the manifest has not been registered.
     */
    function ownerOf(bytes32 manifestCid) external view returns (address);

    /**
     * @notice Returns true if `manifestCid` has been registered.
     */
    function isRegistered(bytes32 manifestCid) external view returns (bool);
}
