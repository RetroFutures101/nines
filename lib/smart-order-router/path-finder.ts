import { ethers } from "ethers"
import type { Token } from "@/types/token"
import type { Pair, V3Pool } from "./pairs"
import type { SwapRoute, SplitRoute } from "./index"
import { getWplsAddress } from "../env-config"
import routerAbi from "../abis/router.json"
import v3QuoterAbi from "../abis/v3-quoter.json"

// Maximum number of hops to consider
const MAX_HOPS = 4 // Increased from 3 to 4

// V3 Quoter address
const V3_QUOTER_ADDRESS = "0xd6840a5F07D21e68383F159a19A9842AF32BDcc5"

// Split percentages to try
const SPLIT_PERCENTAGES = [
  [50, 50],
  [60, 40],
  [70, 30],
  [80, 20],
  [90, 10],
]

// Richard Heart tokens and other important tokens for routing
const IMPORTANT_TOKENS = [
  "0xA1077a294dDE1B09bB078844df40758a5D0f9a27", // WPLS
  "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PLSX
  "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
  "0xefD766cCb38EaF1dfd701853BFCe31359239F305", // DAI
  "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07", // USDC
  "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f", // USDT
  "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719", // 9MM
]

/**
 * Find the best path for a swap
 */
export async function findBestPath(
  provider: ethers.Provider,
  fromToken: Token,
  toToken: Token,
  amount: string,
  pairs: Pair[],
  v3Pools: V3Pool[],
): Promise<SwapRoute> {
  const WPLS_ADDRESS = getWplsAddress()

  // Handle native token
  const fromAddress = fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address
  const toAddress = toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address

  // Parse amount
  const fromDecimals = typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
  const amountIn = ethers.parseUnits(amount, fromDecimals)

  // Build graph of pairs
  const graph = buildGraph(pairs, v3Pools)

  // Find all possible paths
  const paths = findAllPaths(graph, fromAddress, toAddress, MAX_HOPS)

  console.log(`Found ${paths.length} possible paths`)

  // Prioritize paths through important tokens
  const prioritizedPaths = prioritizePaths(paths)

  // Get quotes for all paths
  const quotes = await Promise.all(
    prioritizedPaths.map((path) => getQuoteForPath(provider, path, amountIn, pairs, v3Pools)),
  )

  // Filter out invalid quotes
  const validQuotes = quotes.filter((quote) => quote.amountOut > ethers.getBigInt(0))

  // Sort by output amount (descending)
  validQuotes.sort((a, b) => {
    if (b.amountOut > a.amountOut) return 1
    if (b.amountOut < a.amountOut) return -1
    return 0
  })

  // If no valid quotes, throw error
  if (validQuotes.length === 0) {
    throw new Error("No valid routes found")
  }

  // Get best quote
  const bestQuote = validQuotes[0]

  // Calculate price impact
  const priceImpact = calculatePriceImpact(
    bestQuote.path,
    bestQuote.amountOut,
    amountIn,
    fromDecimals,
    toToken.decimals,
  )

  return {
    path: bestQuote.path,
    amountOut: bestQuote.amountOut,
    priceImpact,
    routerAddress: bestQuote.routerAddress,
    isV3: bestQuote.isV3,
    poolFees: bestQuote.poolFees,
  }
}

/**
 * Find the best split path for a swap
 */
export async function findBestSplitPath(
  provider: ethers.Provider,
  fromToken: Token,
  toToken: Token,
  amount: string,
  pairs: Pair[],
  v3Pools: V3Pool[],
): Promise<SwapRoute> {
  const WPLS_ADDRESS = getWplsAddress()

  // Handle native token
  const fromAddress = fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address
  const toAddress = toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address

  // Parse amount
  const fromDecimals = typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
  const amountIn = ethers.parseUnits(amount, fromDecimals)

  // Build graph of pairs
  const graph = buildGraph(pairs, v3Pools)

  // Find all possible paths
  const paths = findAllPaths(graph, fromAddress, toAddress, MAX_HOPS)

  console.log(`Found ${paths.length} possible paths for split routing`)

  // Prioritize paths through important tokens
  const prioritizedPaths = prioritizePaths(paths)

  // Get quotes for all paths
  const quotes = await Promise.all(
    prioritizedPaths.map((path) => getQuoteForPath(provider, path, amountIn, pairs, v3Pools)),
  )

  // Filter out invalid quotes
  const validQuotes = quotes.filter((quote) => quote.amountOut > ethers.getBigInt(0))

  // Sort by output amount (descending)
  validQuotes.sort((a, b) => {
    if (b.amountOut > a.amountOut) return 1
    if (b.amountOut < a.amountOut) return -1
    return 0
  })

  // If no valid quotes, throw error
  if (validQuotes.length === 0) {
    throw new Error("No valid routes found")
  }

  // Get top 5 quotes
  const topQuotes = validQuotes.slice(0, 5)

  // Try different split percentages
  let bestSplitRoute: {
    splitRoutes: SplitRoute[]
    totalAmountOut: bigint
  } | null = null

  for (const [percent1, percent2] of SPLIT_PERCENTAGES) {
    for (let i = 0; i < topQuotes.length; i++) {
      for (let j = i + 1; j < topQuotes.length; j++) {
        const quote1 = topQuotes[i]
        const quote2 = topQuotes[j]

        // Calculate split amounts
        const amountIn1 = (amountIn * BigInt(percent1)) / BigInt(100)
        const amountIn2 = amountIn - amountIn1

        // Get quotes for split amounts
        const splitQuote1 = await getQuoteForPath(provider, quote1.path, amountIn1, pairs, v3Pools)
        const splitQuote2 = await getQuoteForPath(provider, quote2.path, amountIn2, pairs, v3Pools)

        // Calculate total output
        const totalAmountOut = splitQuote1.amountOut + splitQuote2.amountOut

        // Update best split route if this is better
        if (!bestSplitRoute || totalAmountOut > bestSplitRoute.totalAmountOut) {
          bestSplitRoute = {
            splitRoutes: [
              {
                path: splitQuote1.path,
                amountIn: amountIn1,
                amountOut: splitQuote1.amountOut,
                percentage: percent1,
                routerAddress: splitQuote1.routerAddress,
                isV3: splitQuote1.isV3,
                poolFees: splitQuote1.poolFees,
              },
              {
                path: splitQuote2.path,
                amountIn: amountIn2,
                amountOut: splitQuote2.amountOut,
                percentage: percent2,
                routerAddress: splitQuote2.routerAddress,
                isV3: splitQuote2.isV3,
                poolFees: splitQuote2.poolFees,
              },
            ],
            totalAmountOut,
          }
        }
      }
    }
  }

  // If no valid split route, throw error
  if (!bestSplitRoute) {
    throw new Error("No valid split routes found")
  }

  // Calculate price impact
  const priceImpact = calculatePriceImpact(
    bestSplitRoute.splitRoutes[0].path,
    bestSplitRoute.totalAmountOut,
    amountIn,
    fromDecimals,
    toToken.decimals,
  )

  return {
    path: bestSplitRoute.splitRoutes[0].path, // Use first path for compatibility
    amountOut: bestSplitRoute.splitRoutes[0].amountOut, // Use first amount for compatibility
    priceImpact,
    routerAddress: bestSplitRoute.splitRoutes[0].routerAddress, // Use first router for compatibility
    isV3: bestSplitRoute.splitRoutes[0].isV3, // Use first isV3 for compatibility
    splitRoutes: bestSplitRoute.splitRoutes,
    totalAmountOut: bestSplitRoute.totalAmountOut,
  }
}

/**
 * Prioritize paths through important tokens
 */
function prioritizePaths(paths: string[][]): string[][] {
  // Sort paths by number of important tokens they contain
  return [...paths].sort((a, b) => {
    const aImportance = a.filter((token) => IMPORTANT_TOKENS.includes(token)).length
    const bImportance = b.filter((token) => IMPORTANT_TOKENS.includes(token)).length
    return bImportance - aImportance
  })
}

/**
 * Build a graph of token pairs
 */
function buildGraph(pairs: Pair[], v3Pools: V3Pool[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {}

  // Add V2 pairs to graph
  for (const pair of pairs) {
    // Add token0 -> token1
    if (!graph[pair.token0]) {
      graph[pair.token0] = []
    }
    if (!graph[pair.token0].includes(pair.token1)) {
      graph[pair.token0].push(pair.token1)
    }

    // Add token1 -> token0
    if (!graph[pair.token1]) {
      graph[pair.token1] = []
    }
    if (!graph[pair.token1].includes(pair.token0)) {
      graph[pair.token1].push(pair.token0)
    }
  }

  // Add V3 pools to graph
  for (const pool of v3Pools) {
    // Add token0 -> token1
    if (!graph[pool.token0]) {
      graph[pool.token0] = []
    }
    if (!graph[pool.token0].includes(pool.token1)) {
      graph[pool.token0].push(pool.token1)
    }

    // Add token1 -> token0
    if (!graph[pool.token1]) {
      graph[pool.token1] = []
    }
    if (!graph[pool.token1].includes(pool.token0)) {
      graph[pool.token1].push(pool.token0)
    }
  }

  return graph
}

/**
 * Find all possible paths between two tokens
 */
function findAllPaths(graph: Record<string, string[]>, start: string, end: string, maxHops: number): string[][] {
  const visited: Record<string, boolean> = {}
  const paths: string[][] = []

  function dfs(current: string, path: string[], hops: number) {
    // Mark current node as visited
    visited[current] = true

    // Add current node to path
    path.push(current)

    // If we reached the end, add path to result
    if (current === end) {
      paths.push([...path])
    }
    // Otherwise, continue DFS if we haven't reached max hops
    else if (hops < maxHops) {
      // Get neighbors
      const neighbors = graph[current] || []

      // Visit each neighbor
      for (const neighbor of neighbors) {
        if (!visited[neighbor]) {
          dfs(neighbor, path, hops + 1)
        }
      }
    }

    // Backtrack
    path.pop()
    visited[current] = false
  }

  // Start DFS
  dfs(start, [], 0)

  return paths
}

/**
 * Get quote for a path
 */
async function getQuoteForPath(
  provider: ethers.Provider,
  path: string[],
  amountIn: bigint,
  pairs: Pair[],
  v3Pools: V3Pool[],
): Promise<{
  path: string[]
  amountOut: bigint
  routerAddress: string
  isV3?: boolean
  poolFees?: number[]
}> {
  try {
    // Check if this is a V3 path
    const isV3Path = isV3PathAvailable(path, v3Pools)

    if (isV3Path) {
      return await getV3QuoteForPath(provider, path, amountIn, v3Pools)
    }

    // Find router for this path
    const routerAddress = findRouterForPath(path, pairs)

    if (!routerAddress) {
      return {
        path,
        amountOut: ethers.getBigInt(0),
        routerAddress: "",
      }
    }

    // Create router contract
    const router = new ethers.Contract(routerAddress, routerAbi, provider)

    // Get amounts out
    const amounts = await router.getAmountsOut(amountIn, path)

    return {
      path,
      amountOut: amounts[amounts.length - 1],
      routerAddress,
    }
  } catch (error) {
    console.error(`Error getting quote for path ${path.join(" -> ")}:`, error)

    return {
      path,
      amountOut: ethers.getBigInt(0),
      routerAddress: "",
    }
  }
}

/**
 * Check if a V3 path is available
 */
function isV3PathAvailable(path: string[], v3Pools: V3Pool[]): boolean {
  // For a path to be a V3 path, each consecutive pair must have a V3 pool
  for (let i = 0; i < path.length - 1; i++) {
    const token0 = path[i]
    const token1 = path[i + 1]

    // Check if there's a V3 pool for this pair
    const hasV3Pool = v3Pools.some(
      (pool) =>
        (pool.token0 === token0 && pool.token1 === token1) || (pool.token0 === token1 && pool.token1 === token0),
    )

    if (!hasV3Pool) {
      return false
    }
  }

  return true
}

/**
 * Get V3 quote for a path
 */
async function getV3QuoteForPath(
  provider: ethers.Provider,
  path: string[],
  amountIn: bigint,
  v3Pools: V3Pool[],
): Promise<{
  path: string[]
  amountOut: bigint
  routerAddress: string
  isV3: boolean
  poolFees: number[]
}> {
  try {
    // Create V3 quoter contract
    const quoter = new ethers.Contract(V3_QUOTER_ADDRESS, v3QuoterAbi, provider)

    // Find pool fees for each hop
    const poolFees: number[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const token0 = path[i]
      const token1 = path[i + 1]

      // Find V3 pool for this pair
      const pool = v3Pools.find(
        (p) => (p.token0 === token0 && p.token1 === token1) || (p.token0 === token1 && p.token1 === token0),
      )

      if (!pool) {
        throw new Error(`No V3 pool found for ${token0} -> ${token1}`)
      }

      poolFees.push(pool.fee)
    }

    // Encode path
    const encodedPath = encodePath(path, poolFees)

    // Get quote
    const quote = await quoter.quoteExactInput(encodedPath, amountIn)

    return {
      path,
      amountOut: quote.amountOut,
      routerAddress: "0xf6076d61A0C46C944852F65838E1b12A2910a717", // V3 router address
      isV3: true,
      poolFees,
    }
  } catch (error) {
    console.error(`Error getting V3 quote for path ${path.join(" -> ")}:`, error)

    return {
      path,
      amountOut: ethers.getBigInt(0),
      routerAddress: "",
      isV3: true,
      poolFees: [],
    }
  }
}

/**
 * Encode path for V3 quoter
 */
function encodePath(path: string[], fees: number[]): string {
  if (path.length !== fees.length + 1) {
    throw new Error("Path and fees length mismatch")
  }

  let encoded = "0x"
  for (let i = 0; i < fees.length; i++) {
    encoded += path[i].slice(2)
    encoded += fees[i].toString(16).padStart(6, "0")
  }
  encoded += path[path.length - 1].slice(2)

  return encoded
}

/**
 * Find router for a path
 */
function findRouterForPath(path: string[], pairs: Pair[]): string | null {
  // For a path to be valid, each consecutive pair of tokens must have a pair
  for (let i = 0; i < path.length - 1; i++) {
    const token0 = path[i]
    const token1 = path[i + 1]

    // Find pair for these tokens
    const pair = pairs.find(
      (p) => (p.token0 === token0 && p.token1 === token1) || (p.token0 === token1 && p.token1 === token0),
    )

    if (!pair) {
      return null
    }

    // Return router address from first pair
    if (i === 0) {
      return pair.routerAddress
    }
  }

  return null
}

/**
 * Calculate price impact
 */
function calculatePriceImpact(
  path: string[],
  amountOut: bigint,
  amountIn: bigint,
  fromDecimals: number,
  toDecimals: number | string,
): number {
  // Convert toDecimals to number if it's a string
  const toDecimalsNum = typeof toDecimals === "string" ? Number.parseInt(toDecimals) : toDecimals

  // Calculate expected price (1:1 ratio adjusted for decimals)
  const expectedOut = (amountIn * ethers.getBigInt(10 ** toDecimalsNum)) / ethers.getBigInt(10 ** fromDecimals)

  // Calculate price impact
  if (expectedOut <= ethers.getBigInt(0)) {
    return 0
  }

  const impact = ((expectedOut - amountOut) * ethers.getBigInt(10000)) / expectedOut

  return Number(impact) / 100
}
