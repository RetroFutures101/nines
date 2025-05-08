import { ethers } from "ethers"
import { getRpcUrl } from "./env-config"
import { getOptimalSplitRoutes, splitAmountByRoutes, getRouterAddressByVersion } from "./advanced-routing"
import type { Token } from "@/types/token"

// Router ABI - minimal version with just the functions we need
const RouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
]

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  // @ts-ignore - We're intentionally overriding a method
  provider.getResolver = async () => null
  return provider
}

export interface SmartRouteQuote {
  routes: {
    path: string[]
    percentage: number
    version: string
    outputAmount: string
    pathDescription: string
  }[]
  totalOutputAmount: string
  priceImpact: number
}

/**
 * Get smart routing quotes for a swap
 */
export async function getSmartRoutingQuote(
  fromToken: Token,
  toToken: Token,
  amount: string,
  isTestnet = false,
): Promise<SmartRouteQuote> {
  try {
    // Create provider
    const provider = createProvider(getRpcUrl())

    // Get optimal routes for this token pair
    const optimalRoutes = getOptimalSplitRoutes(
      fromToken.address === "NATIVE" ? "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" : fromToken.address,
      toToken.address === "NATIVE" ? "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" : toToken.address,
    )

    // Parse amount
    const parsedAmount = ethers.parseUnits(amount, fromToken.decimals)

    // Split amount by routes
    const splitRoutes = splitAmountByRoutes(parsedAmount, optimalRoutes)

    // Get quotes for each route
    const routeQuotes = await Promise.all(
      splitRoutes.map(async (route) => {
        try {
          // Get router for this version
          const routerAddress = getRouterAddressByVersion(route.version)
          const router = new ethers.Contract(routerAddress, RouterABI, provider)

          // Get amounts out
          const amounts = await router.getAmountsOut(route.amount, route.path)
          const outputAmount = amounts[amounts.length - 1].toString()

          // Get path description
          const pathDescription = route.path
            .map((addr) => {
              if (addr.toLowerCase() === "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase()) {
                return "WPLS"
              }
              return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4)
            })
            .join(" → ")

          return {
            path: route.path,
            percentage:
              optimalRoutes.find(
                (r) =>
                  r.path.join("").toLowerCase() === route.path.join("").toLowerCase() && r.version === route.version,
              )?.percentage || 0,
            version: route.version,
            outputAmount,
            pathDescription,
          }
        } catch (error) {
          console.error(`Error getting quote for route ${route.path.join(" → ")}:`, error)
          return {
            path: route.path,
            percentage:
              optimalRoutes.find(
                (r) =>
                  r.path.join("").toLowerCase() === route.path.join("").toLowerCase() && r.version === route.version,
              )?.percentage || 0,
            version: route.version,
            outputAmount: "0",
            pathDescription: "Failed route",
          }
        }
      }),
    )

    // Calculate total output amount
    const totalOutputAmount = routeQuotes
      .reduce((sum, route) => sum + ethers.getBigInt(route.outputAmount), ethers.getBigInt(0))
      .toString()

    // Calculate price impact (simplified)
    const priceImpact = 0.5 // This would need a more sophisticated calculation in production

    return {
      routes: routeQuotes,
      totalOutputAmount,
      priceImpact,
    }
  } catch (error) {
    console.error("Error getting smart routing quote:", error)
    throw error
  }
}

/**
 * Get a visual representation of the routing for UI display
 */
export function getRoutingDisplay(quote: SmartRouteQuote): {
  routes: {
    path: string[]
    percentage: number
    version: string
    pathDescription: string
  }[]
} {
  return {
    routes: quote.routes.map((route) => ({
      path: route.path,
      percentage: route.percentage,
      version: route.version,
      pathDescription: route.pathDescription,
    })),
  }
}
