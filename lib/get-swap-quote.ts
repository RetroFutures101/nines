import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { smartOrderRouter } from "./smart-order-router"

export interface SwapQuoteResult {
  outputAmount: string
  outputAmountWei: bigint
  priceImpact: string
  path: string[]
  executionPrice: number
  routeDescription: string | null
  routerAddress: string
  isV3?: boolean
  splitRoutes?: {
    percentage: number
    path: string[]
    routeDescription: string
  }[]
  error?: string
}

/**
 * Get swap quote using the smart order router
 */
export async function getSwapQuote(
  fromToken: Token,
  toToken: Token,
  amount: string,
  slippage: number,
): Promise<SwapQuoteResult> {
  try {
    console.log("Getting swap quote for:", {
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      amount,
      slippage,
    })

    // Get route from smart order router
    const route = await smartOrderRouter.getRoute({
      fromToken,
      toToken,
      amount,
      slippage,
      recipient: ethers.ZeroAddress, // Dummy address for quote
    })

    // Format output amount
    const toDecimals = typeof toToken.decimals === "string" ? Number.parseInt(toToken.decimals) : toToken.decimals

    // Use totalAmountOut if this is a split route
    const outputAmountWei = route.totalAmountOut || route.amountOut
    const outputAmount = ethers.formatUnits(outputAmountWei, toDecimals)

    // Calculate execution price
    const fromDecimals =
      typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
    const fromAmountNum = Number(ethers.formatUnits(ethers.parseUnits(amount, fromDecimals), fromDecimals))
    const toAmountNum = Number(ethers.formatUnits(outputAmountWei, toDecimals))
    const executionPrice = fromAmountNum > 0 ? toAmountNum / fromAmountNum : 0

    // Generate route description
    let routeDescription: string | null = null
    let splitRoutes: { percentage: number; path: string[]; routeDescription: string }[] | undefined = undefined

    if (route.splitRoutes) {
      // This is a split route
      routeDescription = "Split route"
      splitRoutes = route.splitRoutes.map((splitRoute) => ({
        percentage: splitRoute.percentage,
        path: splitRoute.path,
        routeDescription: generateRouteDescription(splitRoute.path),
      }))
    } else {
      // This is a single route
      routeDescription = generateRouteDescription(route.path)
    }

    return {
      outputAmount,
      outputAmountWei,
      priceImpact: route.priceImpact.toFixed(2),
      path: route.path,
      executionPrice,
      routeDescription,
      routerAddress: route.routerAddress,
      isV3: route.isV3,
      splitRoutes,
    }
  } catch (error) {
    console.error("Error getting swap quote:", error)

    return {
      outputAmount: "0",
      outputAmountWei: ethers.getBigInt(0),
      priceImpact: "0",
      path: [],
      executionPrice: 0,
      routeDescription: null,
      routerAddress: "",
      error: error instanceof Error ? error.message : "Unknown error getting swap quote",
    }
  }
}

/**
 * Generate a human-readable route description
 */
function generateRouteDescription(path: string[]): string {
  const tokenSymbols = {
    "0xA1077a294dDE1B09bB078844df40758a5D0f9a27": "WPLS",
    "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab": "PLSX",
    "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": "HEX",
    "0xefD766cCb38EaF1dfd701853BFCe31359239F305": "DAI",
    "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07": "USDC",
    "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f": "USDT",
    "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719": "9MM",
  }

  return path
    .map((address) => {
      const lowercaseAddress = address.toLowerCase()
      for (const [addr, symbol] of Object.entries(tokenSymbols)) {
        if (addr.toLowerCase() === lowercaseAddress) {
          return symbol
        }
      }
      return address.substring(0, 6) + "..." + address.substring(address.length - 4)
    })
    .join(" → ")
}
