import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { universalRouter, type UniversalSwapParams } from "./universal-router-adapter"

interface SplitRouteParams {
  fromToken: Token
  toToken: Token
  amount: string
  slippage: number
  recipient: string
  routes: {
    path: string[]
    percentage: number
    isV3?: boolean
    poolFees?: number[]
  }[]
}

/**
 * Execute a split route swap
 */
export async function executeSplitRouteSwap(
  params: SplitRouteParams,
  signer: ethers.Signer,
): Promise<{
  success: boolean
  transactionHash?: string[]
  error?: string
}> {
  try {
    const { fromToken, toToken, amount, slippage, recipient, routes } = params

    // Parse amount
    const fromDecimals =
      typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
    const totalAmount = ethers.parseUnits(amount, fromDecimals)

    // Execute each route
    const results = []

    for (const route of routes) {
      // Calculate amount for this route
      const routeAmount = (totalAmount * BigInt(route.percentage)) / BigInt(100)
      const routeAmountString = ethers.formatUnits(routeAmount, fromDecimals)

      console.log(`Executing route with ${route.percentage}% (${routeAmountString} ${fromToken.symbol})`)
      console.log(`Path: ${route.path.join(" → ")}`)

      // Prepare swap parameters
      const swapParams: UniversalSwapParams = {
        fromToken,
        toToken,
        amount: routeAmountString,
        slippage,
        recipient,
        path: route.path,
        isV3: route.isV3,
        poolFees: route.poolFees,
        splitPercentage: route.percentage,
      }

      // Execute swap
      const result = await universalRouter.executeSwap(swapParams, signer)

      if (result.success) {
        results.push(result)
      } else {
        console.error(`Route execution failed: ${result.error}`)
      }
    }

    // Check if any routes succeeded
    if (results.length === 0) {
      return {
        success: false,
        error: "All routes failed",
      }
    }

    return {
      success: true,
      transactionHash: results.map((r) => r.transactionHash!),
    }
  } catch (error) {
    console.error("Error executing split route swap:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during split route swap",
    }
  }
}
