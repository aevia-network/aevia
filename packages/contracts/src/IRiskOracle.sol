// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * @title IRiskOracle
 * @notice Minimal interface consumed by BoostRouter to gate paid
 *         amplification on the Risk Score R(c) defined in RFC-6.
 *
 * @dev The full RiskOracle (RFC-6 §8) exposes richer data (per-component
 *      scores, classifier version, contest state). BoostRouter only
 *      needs the composite R(c) for the θ_feed gate, so this interface
 *      is deliberately narrow.
 *
 *      Values are basis points, 0-10_000. So R(c) = 0.3 is encoded as
 *      3_000 bps. Freshness is enforced by the caller if required;
 *      this interface does not timestamp scores.
 */
interface IRiskOracle {
    /**
     * @notice Current composite Risk Score for `manifestHash`, in basis points.
     * @dev MUST return a value in [0, 10_000]. Implementations SHOULD revert
     *      or return 0 for unknown manifests — BoostRouter treats 0 as "no
     *      signal" and allows the boost to proceed (subject to other gates).
     * @param manifestHash The canonical manifest hash per RFC-1 §5.
     * @return bps The Risk Score in basis points.
     */
    function scoreBps(bytes32 manifestHash) external view returns (uint16 bps);
}
