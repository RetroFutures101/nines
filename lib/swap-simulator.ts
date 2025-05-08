import { ethers } from "ethers"
import { getRpcUrl } from "./env-config"
import routerAbi from "./abis/router.json"

/**
 * Simulates a swap transaction to get the actual output amount
 */
export async function simulateSwap(
  routerAddress: string,
  path: string[],
  amountIn: bigint,
  userAddress: string,
): Promise<{
  success: boolean
  outputAmount: bigint
  error?: string
}> {
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(getRpcUrl())

    // Create router contract
    const router = new ethers.Contract(routerAddress, routerAbi, provider)

    // Check if this is a native token swap (first token is WPLS)
    const isNativeIn = path[0].toLowerCase() === "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase()
    const isNativeOut =
      path[path.length - 1].toLowerCase() === "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase()

    // Simulate the swap
    try {
      // For token to token swaps
      if (!isNativeIn && !isNativeOut) {
        const amounts = await router.getAmountsOut(amountIn, path)
        return {
          success: true,
          outputAmount: amounts[amounts.length - 1],
        }
      }
      // For native to token swaps
      else if (isNativeIn && !isNativeOut) {
        const amounts = await router.getAmountsOut(amountIn, path)
        return {
          success: true,
          outputAmount: amounts[amounts.length - 1],
        }
      }
      // For token to native swaps
      else if (!isNativeIn && isNativeOut) {
        const amounts = await router.getAmountsOut(amountIn, path)
        return {
          success: true,
          outputAmount: amounts[amounts.length - 1],
        }
      }

      throw new Error("Unsupported swap type")
    } catch (error) {
      console.error("Simulation error:", error)
      return {
        success: false,
        outputAmount: BigInt(0),
        error: error instanceof Error ? error.message : "Unknown simulation error",
      }
    }
  } catch (error) {
    console.error("Simulation setup error:", error)
    return {
      success: false,
      outputAmount: BigInt(0),
      error: error instanceof Error ? error.message : "Unknown simulation setup error",
    }
  }
}

/**
 * Get a conservative estimate of the swap output amount
 * This applies a safety factor to account for price impact, slippage, and other factors
 */
export async function getConservativeSwapEstimate(
  path: string[],
  amountIn: bigint,
  userAddress: string,
  toDecimals: number,
): Promise<{
  outputAmount: bigint
  safetyFactor: number
  routerAddress: string
}> {
  // Try multiple routers
  const routerAddresses = [
    "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47", // 9mm V2
    "0xf6076d61A0C46C944852F65838E1b12A2910a717", // 9mm V3
  ]

  const results = []

  // Simulate on each router
  for (const router of routerAddresses) {
    try {
      const result = await simulateSwap(router, path, amountIn, userAddress)
      if (result.success && result.outputAmount > BigInt(0)) {
        results.push({
          outputAmount: result.outputAmount,
          routerAddress: router,
        })
      }
    } catch (error) {
      console.warn(`Failed to simulate on router ${router}:`, error)
    }
  }

  if (results.length === 0) {
    // If all simulations failed, return a very conservative estimate
    return {
      outputAmount: amountIn / BigInt(3), // Return 1/3 of input as a fallback
      safetyFactor: 0.33,
      routerAddress: routerAddresses[0],
    }
  }

  // Sort by output amount (descending)
  results.sort((a, b) => (a.outputAmount > b.outputAmount ? -1 : 1))

  // Get the highest estimate - we want to be competitive with other DEXes
  const highestEstimate = results[0]

  // Apply a minimal safety factor - we want to be close to the actual amount
  // The safety factor is smaller for shorter paths and larger for longer paths
  let safetyFactor = 0.995 // Base safety factor (0.5% reduction)

  // Apply additional safety factor based on path length
  safetyFactor = safetyFactor - (path.length - 2) * 0.005 // Reduce by 0.5% per additional hop

  // Ensure safety factor doesn't go below 0.98 (2% reduction)
  safetyFactor = Math.max(safetyFactor, 0.98)

  // Calculate the conservative output amount
  const safeOutputAmount = BigInt(Math.floor(Number(highestEstimate.outputAmount) * safetyFactor))

  console.log(
    `Conservative estimate: ${ethers.formatUnits(safeOutputAmount, toDecimals)} (${safetyFactor * 100}% of ${ethers.formatUnits(highestEstimate.outputAmount, toDecimals)})`,
  )

  return {
    outputAmount: safeOutputAmount,
    safetyFactor,
    routerAddress: highestEstimate.routerAddress,
  }
}
