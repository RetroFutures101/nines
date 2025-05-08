import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { universalRouter, type UniversalSwapParams } from "./universal-router-adapter"
import { findBestPoolsForPair } from "./subgraph-pool-discovery"
import { calculateOptimalDeadline, checkForMEVRisk } from "./mev-protection"

interface SwapResult {
  success: boolean
  transactionHash?: string
  actualOutputAmount?: string
  error?: string
}

/**
 * Execute a swap transaction using the universal router
 */
export default async function executeSwap(
  fromToken: Token,
  toToken: Token,
  amount: string,
  minAmountOut: bigint,
  path: string[],
  walletAddress: string,
  signer: ethers.Signer,
  deadline: number = calculateOptimalDeadline(),
  routerAddress?: string,
  isV3?: boolean,
  poolFees?: number[],
): Promise<SwapResult> {
  try {
    console.log(`Executing swap: ${fromToken.symbol} -> ${toToken.symbol}, amount: ${amount}`)

    // Check for MEV risk
    const fromDecimals =
      typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
    const amountIn = ethers.parseUnits(amount, fromDecimals)
    const expectedPrice = 1.0 // This should be calculated based on token prices

    const mevRisk = checkForMEVRisk(amountIn, minAmountOut, expectedPrice)
    console.log(`MEV risk: ${mevRisk.risk} - ${mevRisk.reason}`)

    // If high MEV risk, consider adjusting parameters
    let slippage = 0.5 // Default slippage
    if (mevRisk.risk === "high") {
      slippage = 1.0 // Increase slippage for high MEV risk
      console.log("Increasing slippage due to high MEV risk")
    }

    // If we don't have pool fees for V3, try to discover them
    if (isV3 && (!poolFees || poolFees.length === 0) && path.length >= 2) {
      console.log("Discovering pool fees for V3 swap")

      const discoveredPools = []
      for (let i = 0; i < path.length - 1; i++) {
        const token0 = path[i]
        const token1 = path[i + 1]

        const pools = await findBestPoolsForPair(token0, token1)
        if (pools.length > 0) {
          discoveredPools.push(pools[0])
        }
      }

      // Extract fees from discovered pools
      poolFees = discoveredPools.map((pool) => Number.parseInt(pool.feeTier || "3000"))
      console.log("Discovered pool fees:", poolFees)
    }

    // Prepare swap parameters
    const swapParams: UniversalSwapParams = {
      fromToken,
      toToken,
      amount,
      slippage,
      recipient: walletAddress,
      path,
      isV3,
      poolFees,
    }

    // Execute swap using universal router
    const result = await universalRouter.executeSwap(swapParams, signer)

    return {
      success: result.success,
      transactionHash: result.transactionHash,
      error: result.error,
    }
  } catch (error) {
    console.error("Error executing swap:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during swap",
    }
  }
}
