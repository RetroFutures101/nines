import type { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getProvider } from "../provider"
import { getTokenPairs, getV3Pools } from "./pairs"
import { findBestPath, findBestSplitPath } from "./path-finder"
import { executeSwap, executeSplitSwap } from "./executor"

export interface SwapRoute {
  path: string[]
  amountOut: bigint
  priceImpact: number
  routerAddress: string
  isV3?: boolean
  splitRoutes?: SplitRoute[]
  totalAmountOut?: bigint
}

export interface SplitRoute {
  path: string[]
  amountIn: bigint
  amountOut: bigint
  percentage: number
  routerAddress: string
  isV3?: boolean
  poolFees?: number[] // For V3 paths
}

export interface SwapParams {
  fromToken: Token
  toToken: Token
  amount: string
  slippage: number
  recipient: string
  deadline?: number
}

/**
 * Smart Order Router - Main entry point
 * Finds the best path for a swap and executes it
 */
export class SmartOrderRouter {
  private provider: ethers.Provider

  constructor(provider?: ethers.Provider) {
    this.provider = provider || getProvider()
  }

  /**
   * Get the best route for a swap
   */
  async getRoute(params: SwapParams): Promise<SwapRoute> {
    const { fromToken, toToken, amount } = params

    console.log(`Finding best route for ${fromToken.symbol} -> ${toToken.symbol}, amount: ${amount}`)

    // Get all available token pairs (V2)
    const pairs = await getTokenPairs(this.provider, fromToken, toToken)

    // Get all available V3 pools
    const v3Pools = await getV3Pools(this.provider, fromToken, toToken)

    // Find the best single path
    const bestSinglePath = await findBestPath(this.provider, fromToken, toToken, amount, pairs, v3Pools)

    // Find the best split path
    const bestSplitPath = await findBestSplitPath(this.provider, fromToken, toToken, amount, pairs, v3Pools)

    // Compare and return the best route
    if (bestSplitPath.totalAmountOut > bestSinglePath.amountOut) {
      console.log("Split path is better than single path")
      return bestSplitPath
    } else {
      console.log("Single path is better than split path")
      return bestSinglePath
    }
  }

  /**
   * Execute a swap using the best route
   */
  async executeSwap(
    params: SwapParams,
    signer: ethers.Signer,
  ): Promise<{
    success: boolean
    transactionHash?: string
    error?: string
  }> {
    try {
      // Get the best route
      const route = await this.getRoute(params)

      // Execute the swap
      if (route.splitRoutes) {
        return await executeSplitSwap(params, route, signer)
      } else {
        return await executeSwap(params, route, signer)
      }
    } catch (error) {
      console.error("Error executing swap:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during swap",
      }
    }
  }
}

// Export a singleton instance
export const smartOrderRouter = new SmartOrderRouter()
