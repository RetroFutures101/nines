// Subgraph URL for 9mm
const SUBGRAPH_URL = "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexV2"

// Interface for pool data
interface PoolData {
  id: string
  token0: {
    id: string
    symbol: string
    decimals: string
  }
  token1: {
    id: string
    symbol: string
    decimals: string
  }
  feeTier?: string
  liquidity: string
  volumeUSD: string
}

/**
 * Fetch pools from subgraph
 */
export async function fetchPoolsFromSubgraph(token0Address?: string, token1Address?: string): Promise<PoolData[]> {
  try {
    // Build query
    let query = `
      {
        pools(first: 1000, where: { liquidity_gt: "1000" }
    `

    // Add token filters if provided
    if (token0Address && token1Address) {
      query += `, token0: "${token0Address.toLowerCase()}", token1: "${token1Address.toLowerCase()}"`
    } else if (token0Address) {
      query += `, token0: "${token0Address.toLowerCase()}"`
    } else if (token1Address) {
      query += `, token1: "${token1Address.toLowerCase()}"`
    }

    // Complete query
    query += `) {
        id
        token0 {
          id
          symbol
          decimals
        }
        token1 {
          id
          symbol
          decimals
        }
        feeTier
        liquidity
        volumeUSD
      }
    }`

    // Execute query
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("Subgraph query errors:", data.errors)
      return []
    }

    return data.data.pools
  } catch (error) {
    console.error("Error fetching pools from subgraph:", error)
    return []
  }
}

/**
 * Find best pools for a token pair
 */
export async function findBestPoolsForPair(token0Address: string, token1Address: string): Promise<PoolData[]> {
  try {
    // Fetch direct pools
    const directPools = await fetchPoolsFromSubgraph(token0Address, token1Address)

    // If we found direct pools, return them
    if (directPools.length > 0) {
      // Sort by liquidity (descending)
      return directPools.sort((a, b) => (BigInt(b.liquidity) > BigInt(a.liquidity) ? 1 : -1))
    }

    // If no direct pools, find pools for each token
    const token0Pools = await fetchPoolsFromSubgraph(token0Address)
    const token1Pools = await fetchPoolsFromSubgraph(token1Address)

    // Find common intermediary tokens
    const intermediaryTokens = new Set<string>()

    token0Pools.forEach((pool) => {
      const otherToken = pool.token0.id.toLowerCase() === token0Address.toLowerCase() ? pool.token1.id : pool.token0.id
      intermediaryTokens.add(otherToken.toLowerCase())
    })

    const commonIntermediaries: string[] = []

    token1Pools.forEach((pool) => {
      const otherToken = pool.token0.id.toLowerCase() === token1Address.toLowerCase() ? pool.token1.id : pool.token0.id
      if (intermediaryTokens.has(otherToken.toLowerCase())) {
        commonIntermediaries.push(otherToken.toLowerCase())
      }
    })

    // Return pools for common intermediaries
    const result: PoolData[] = []

    for (const intermediary of commonIntermediaries) {
      const pool0 = token0Pools.find(
        (pool) => pool.token0.id.toLowerCase() === intermediary || pool.token1.id.toLowerCase() === intermediary,
      )

      const pool1 = token1Pools.find(
        (pool) => pool.token0.id.toLowerCase() === intermediary || pool.token1.id.toLowerCase() === intermediary,
      )

      if (pool0 && pool1) {
        result.push(pool0, pool1)
      }
    }

    return result
  } catch (error) {
    console.error("Error finding best pools for pair:", error)
    return []
  }
}
