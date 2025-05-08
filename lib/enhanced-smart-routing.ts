import { ethers } from "ethers"
import { getRpcUrl, getWplsAddress } from "./env-config"
import type { Token } from "@/types/token"
import { getConservativeSwapEstimate } from "./swap-simulator"

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

export interface RouteQuote {
  path: string[]
  percentage: number
  version: string
  outputAmount: string
  pathDescription: string
  routerAddress: string
}

export interface EnhancedSwapQuote {
  routes: RouteQuote[]
  totalOutputAmount: string
  minOutputAmount: string
  priceImpact: number
  executionPrice: number
  bestRouter: string
  conservativeOutputAmount: string
}

// Token decimals cache to avoid repeated errors
const tokenDecimalsCache: Record<string, number> = {
  // Pre-populate with known tokens
  "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab": 18, // PLSX
  "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": 8, // HEX - has 8 decimals
  "0xA1077a294dDE1B09bB078844df40758a5D0f9a27": 18, // WPLS
  "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d": 18, // INC
  "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07": 6, // USDC - has 6 decimals
  "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f": 6, // USDT - has 6 decimals
  "0xefD766cCb38EaF1dfd701853BFCe31359239F305": 18, // DAI
  "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719": 18, // 9MM
  NATIVE: 18, // Native PLS
}

// Router addresses - focusing only on 9mm routers as requested
const ROUTER_ADDRESSES = {
  V2: "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47", // 9mm V2 router
  V3: "0xf6076d61A0C46C944852F65838E1b12A2910a717", // 9mm V3 router
}

// Richard Heart tokens for multihops
const RH_TOKENS = [
  "0xA1077a294dDE1B09bB078844df40758a5D0f9a27", // WPLS
  "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PLSX
  "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
  "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d", // INC
]

// Stablecoins for multihops
const STABLECOINS = [
  "0xefD766cCb38EaF1dfd701853BFCe31359239F305", // DAI
  "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07", // USDC
  "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f", // USDT
]

// 9MM token
const NINEMM_TOKEN = "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719" // 9MM

// Native PLS
const NATIVE_PLS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" // WPLS

/**
 * Get token symbol for display
 */
function getTokenSymbolForDisplay(address: string): string {
  const knownTokens: Record<string, string> = {
    "0xA1077a294dDE1B09bB078844df40758a5D0f9a27": "WPLS",
    "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab": "PLSX",
    "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": "HEX",
    "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d": "INC",
    "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07": "USDC",
    "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f": "USDT",
    "0xefD766cCb38EaF1dfd701853BFCe31359239F305": "DAI",
    "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719": "9MM",
  }

  if (address === "NATIVE") return "PLS"

  const lowercaseAddress = address.toLowerCase()
  for (const [addr, symbol] of Object.entries(knownTokens)) {
    if (addr.toLowerCase() === lowercaseAddress) {
      return symbol
    }
  }

  return address.substring(0, 6) + "..." + address.substring(address.length - 4)
}

/**
 * Get safe token decimals - use cache or fallback to default
 */
function getSafeTokenDecimals(token: Token): number {
  // Check if we have cached decimals for this token
  if (token.address && tokenDecimalsCache[token.address]) {
    return tokenDecimalsCache[token.address]
  }

  // Try to parse decimals from token
  let decimals: number
  try {
    decimals = typeof token.decimals === "string" ? Number.parseInt(token.decimals) : token.decimals

    // Validate decimals
    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      console.warn(`Invalid decimals for ${token.symbol}: ${decimals}, using 18 as default`)
      decimals = 18
    }
  } catch (error) {
    console.warn(`Error parsing decimals for ${token.symbol}, using 18 as default:`, error)
    decimals = 18
  }

  // Cache the result
  if (token.address) {
    tokenDecimalsCache[token.address] = decimals
  }

  return decimals
}

/**
 * Generate all possible paths between two tokens
 * Includes direct paths and paths through intermediary tokens
 * Prioritizes paths through Richard Heart tokens, stablecoins, and 9MM
 */
async function generateAllPossiblePaths(
  fromToken: Token,
  toToken: Token,
): Promise<{ path: string[]; routerAddress: string }[]> {
  const paths: { path: string[]; routerAddress: string }[] = []
  const WPLS_ADDRESS = getWplsAddress()

  // Handle native token
  const actualFromToken = fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address
  const actualToToken = toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address

  // Add direct paths for all routers
  for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
    paths.push({
      path: [actualFromToken, actualToToken],
      routerAddress,
    })
  }

  // Add single-hop paths through Richard Heart tokens
  for (const intermediary of RH_TOKENS) {
    if (
      intermediary.toLowerCase() !== actualFromToken.toLowerCase() &&
      intermediary.toLowerCase() !== actualToToken.toLowerCase()
    ) {
      for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
        paths.push({
          path: [actualFromToken, intermediary, actualToToken],
          routerAddress,
        })
      }
    }
  }

  // Add single-hop paths through stablecoins
  for (const intermediary of STABLECOINS) {
    if (
      intermediary.toLowerCase() !== actualFromToken.toLowerCase() &&
      intermediary.toLowerCase() !== actualToToken.toLowerCase()
    ) {
      for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
        paths.push({
          path: [actualFromToken, intermediary, actualToToken],
          routerAddress,
        })
      }
    }
  }

  // Add single-hop path through 9MM token
  if (
    NINEMM_TOKEN.toLowerCase() !== actualFromToken.toLowerCase() &&
    NINEMM_TOKEN.toLowerCase() !== actualToToken.toLowerCase()
  ) {
    for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
      paths.push({
        path: [actualFromToken, NINEMM_TOKEN, actualToToken],
        routerAddress,
      })
    }
  }

  // Add specific multi-hop paths that are known to be efficient
  // 9MM → DAI → PLS → PLSX (as seen in the screenshot)
  if (
    actualFromToken.toLowerCase() === NINEMM_TOKEN.toLowerCase() &&
    actualToToken.toLowerCase() === "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab".toLowerCase() // PLSX
  ) {
    for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
      paths.push({
        path: [
          NINEMM_TOKEN, // 9MM
          "0xefD766cCb38EaF1dfd701853BFCe31359239F305", // DAI
          NATIVE_PLS, // WPLS/PLS
          "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PLSX
        ],
        routerAddress,
      })
    }
  }

  // Add double-hop paths through combinations of tokens
  // This helps find routes like 9MM → DAI → PLS → PLSX
  const allIntermediaries = [...RH_TOKENS, ...STABLECOINS, NINEMM_TOKEN]

  // Two-hop paths (token → intermediary1 → intermediary2 → token)
  for (let i = 0; i < allIntermediaries.length; i++) {
    for (let j = 0; j < allIntermediaries.length; j++) {
      const intermediary1 = allIntermediaries[i]
      const intermediary2 = allIntermediaries[j]

      if (
        intermediary1.toLowerCase() !== actualFromToken.toLowerCase() &&
        intermediary1.toLowerCase() !== actualToToken.toLowerCase() &&
        intermediary2.toLowerCase() !== actualFromToken.toLowerCase() &&
        intermediary2.toLowerCase() !== actualToToken.toLowerCase() &&
        intermediary1.toLowerCase() !== intermediary2.toLowerCase()
      ) {
        for (const [version, routerAddress] of Object.entries(ROUTER_ADDRESSES)) {
          paths.push({
            path: [actualFromToken, intermediary1, intermediary2, actualToToken],
            routerAddress,
          })
        }
      }
    }
  }

  return paths
}

/**
 * Test a path to see if it's valid and get the output amount
 */
async function testPath(
  path: string[],
  routerAddress: string,
  amount: string,
  provider: ethers.JsonRpcProvider,
): Promise<{ valid: boolean; outputAmount: string }> {
  try {
    const router = new ethers.Contract(routerAddress, RouterABI, provider)
    const amounts = await router.getAmountsOut(amount, path)
    return {
      valid: true,
      outputAmount: amounts[amounts.length - 1].toString(),
    }
  } catch (error) {
    return {
      valid: false,
      outputAmount: "0",
    }
  }
}

/**
 * Find the best paths for a swap
 */
async function findBestPaths(
  fromToken: Token,
  toToken: Token,
  amount: string,
  provider: ethers.JsonRpcProvider,
): Promise<RouteQuote[]> {
  // Generate all possible paths
  const possiblePaths = await generateAllPossiblePaths(fromToken, toToken)

  console.log(`Testing ${possiblePaths.length} possible paths for ${fromToken.symbol} to ${toToken.symbol}`)

  // Test each path
  const pathResults = await Promise.all(
    possiblePaths.map(async ({ path, routerAddress }) => {
      const result = await testPath(path, routerAddress, amount, provider)
      if (!result.valid) return null

      return {
        path,
        routerAddress,
        outputAmount: result.outputAmount,
        pathDescription: path.map((addr) => getTokenSymbolForDisplay(addr)).join(" → "),
        percentage: 0, // Will be calculated later
        version: Object.entries(ROUTER_ADDRESSES).find(([_, addr]) => addr === routerAddress)?.[0] || "Unknown",
      }
    }),
  )

  // Filter out invalid paths and sort by output amount (descending)
  const validPaths = pathResults.filter(Boolean) as RouteQuote[]
  validPaths.sort((a, b) => {
    const aBigInt = ethers.getBigInt(a.outputAmount)
    const bBigInt = ethers.getBigInt(b.outputAmount)
    return aBigInt > bBigInt ? -1 : aBigInt < bBigInt ? 1 : 0
  })

  console.log(`Found ${validPaths.length} valid paths. Best path: ${validPaths[0]?.pathDescription}`)

  // Take top 3 paths
  const bestPaths = validPaths.slice(0, 3)

  // Calculate percentages
  const totalOutput = bestPaths.reduce((sum, path) => sum + ethers.getBigInt(path.outputAmount), ethers.getBigInt(0))

  if (totalOutput > ethers.getBigInt(0)) {
    bestPaths.forEach((path) => {
      const pathOutput = ethers.getBigInt(path.outputAmount)
      path.percentage = Number(((pathOutput * ethers.getBigInt(10000)) / totalOutput) * ethers.getBigInt(1)) / 100
    })
  }

  return bestPaths
}

/**
 * Get enhanced swap quote with optimal routing
 */
export async function getEnhancedSwapQuote(
  fromToken: Token,
  toToken: Token,
  amount: string,
  slippage: number,
): Promise<EnhancedSwapQuote> {
  try {
    console.log("Getting enhanced swap quote...")

    // Create provider
    const provider = createProvider(getRpcUrl())

    // Get safe decimals for both tokens
    const fromDecimals = getSafeTokenDecimals(fromToken)
    const toDecimals = getSafeTokenDecimals(toToken)

    // Parse amount safely
    let parsedAmount: bigint
    try {
      parsedAmount = ethers.parseUnits(amount, fromDecimals)
    } catch (error) {
      console.error(`Error parsing amount ${amount} with decimals ${fromDecimals}:`, error)
      // Try with a default of 18 decimals as fallback
      parsedAmount = ethers.parseUnits(amount, 18)
    }

    // Find the best paths
    const bestRoutes = await findBestPaths(fromToken, toToken, parsedAmount.toString(), provider)

    if (bestRoutes.length === 0) {
      throw new Error("No valid routes found")
    }

    // Use the best route for now (we'll implement split routing in the future)
    const bestRoute = bestRoutes[0]

    // Calculate total output amount
    const totalOutputAmount = bestRoute.outputAmount

    // Get a conservative estimate through simulation
    const userAddress = "0x0000000000000000000000000000000000000000" // Dummy address for simulation
    const { outputAmount: conservativeOutputAmount, safetyFactor } = await getConservativeSwapEstimate(
      bestRoute.path,
      parsedAmount,
      userAddress,
      toDecimals,
    )

    // Use the conservative output amount for display and calculations
    const displayOutputAmount = conservativeOutputAmount.toString()

    // Calculate minimum amount out with slippage
    const slippageFactor = ethers.getBigInt(Math.floor((100 - slippage) * 100))
    const minOutputAmount = (conservativeOutputAmount * slippageFactor) / ethers.getBigInt(10000)

    // Calculate execution price safely
    let executionPrice = 0
    try {
      const fromAmountNum = Number(ethers.formatUnits(parsedAmount, fromDecimals))
      const toAmountNum = Number(ethers.formatUnits(conservativeOutputAmount, toDecimals))
      executionPrice = fromAmountNum > 0 ? toAmountNum / fromAmountNum : 0
    } catch (error) {
      console.error("Error calculating execution price:", error)
      executionPrice = 0
    }

    // Calculate price impact based on path length
    // Longer paths typically have higher price impact
    const priceImpact = 0.3 + (bestRoute.path.length - 2) * 0.1

    return {
      routes: [bestRoute],
      totalOutputAmount: displayOutputAmount, // Use conservative estimate
      minOutputAmount: minOutputAmount.toString(),
      conservativeOutputAmount: displayOutputAmount,
      priceImpact,
      executionPrice,
      bestRouter: bestRoute.routerAddress,
    }
  } catch (error) {
    console.error("Enhanced routing error:", error)

    // Return a fallback quote with a direct route
    const WPLS_ADDRESS = getWplsAddress()
    const directPath = [
      fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address,
      toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address,
    ]

    return {
      routes: [
        {
          path: directPath,
          percentage: 100,
          version: "V2",
          outputAmount: "0",
          pathDescription: `${getTokenSymbolForDisplay(directPath[0])} → ${getTokenSymbolForDisplay(directPath[1])}`,
          routerAddress: ROUTER_ADDRESSES.V2,
        },
      ],
      totalOutputAmount: "0",
      minOutputAmount: "0",
      conservativeOutputAmount: "0",
      priceImpact: 0.3,
      executionPrice: 0,
      bestRouter: ROUTER_ADDRESSES.V2,
    }
  }
}
