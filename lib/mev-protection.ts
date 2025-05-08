import { ethers } from "ethers"

/**
 * Calculate minimum output amount with adaptive slippage
 * This uses a more sophisticated approach than a simple percentage
 */
export function calculateMinOutputWithAdaptiveSlippage(
  outputAmount: bigint,
  slippagePercentage: number,
  pathLength: number,
): bigint {
  // Base slippage percentage
  let effectiveSlippage = slippagePercentage

  // Adjust slippage based on path length
  // Longer paths need more slippage tolerance
  if (pathLength > 2) {
    effectiveSlippage += (pathLength - 2) * 0.25
  }

  // Calculate minimum output amount
  const slippageFactor = ethers.BigInt(Math.floor((100 - effectiveSlippage) * 100))
  const minOutputAmount = (outputAmount * slippageFactor) / ethers.BigInt(10000)

  return minOutputAmount
}

/**
 * Calculate optimal deadline based on network conditions
 */
export function calculateOptimalDeadline(
  baseMinutes = 20,
  networkCongestion: "low" | "medium" | "high" = "medium",
): number {
  let minutes = baseMinutes

  // Adjust deadline based on network congestion
  switch (networkCongestion) {
    case "low":
      minutes = baseMinutes
      break
    case "medium":
      minutes = baseMinutes * 1.5
      break
    case "high":
      minutes = baseMinutes * 2
      break
  }

  return Math.floor(Date.now() / 1000) + Math.floor(minutes * 60)
}

/**
 * Check if a transaction might be subject to MEV
 */
export function checkForMEVRisk(
  inputAmount: bigint,
  outputAmount: bigint,
  expectedPrice: number,
): { risk: "low" | "medium" | "high"; reason: string } {
  // Calculate actual price
  const actualPrice = Number(outputAmount) / Number(inputAmount)

  // Calculate price deviation
  const deviation = Math.abs((actualPrice - expectedPrice) / expectedPrice) * 100

  if (deviation < 1) {
    return { risk: "low", reason: "Price deviation is minimal" }
  } else if (deviation < 3) {
    return { risk: "medium", reason: "Moderate price deviation detected" }
  } else {
    return { risk: "high", reason: "Significant price deviation detected" }
  }
}
