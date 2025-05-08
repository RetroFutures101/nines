import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { FACTORY_ADDRESSES, ROUTER_ADDRESSES } from "../constants"
import factoryAbi from "../abis/factory.json"
import pairAbi from "../abis/pair.json"
import v3FactoryAbi from "../abis/v3-factory.json"
import v3PoolAbi from "../abis/v3-pool.json"

export interface Pair {
  address: string
  token0: string
  token1: string
  reserve0: bigint
  reserve1: bigint
  routerAddress: string
}

export interface V3Pool {
  address: string
  token0: string
  token1: string
  fee: number
  liquidity: bigint
  sqrtPriceX96: bigint
  tick: number
}

/**
 * Get all token pairs for a given token pair
 */
export async function getTokenPairs(provider: ethers.Provider, fromToken: Token, toToken: Token): Promise<Pair[]> {
  const pairs: Pair[] = []

  // Get pairs from all factories
  for (const [name, factoryAddress] of Object.entries(FACTORY_ADDRESSES)) {
    if (name.includes("V3")) continue // Skip V3 factories

    try {
      const routerAddress = ROUTER_ADDRESSES[name as keyof typeof ROUTER_ADDRESSES]
      if (!routerAddress) continue

      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider)

      // Get pair address
      const pairAddress = await factory.getPair(fromToken.address, toToken.address)

      // If pair exists, get reserves
      if (pairAddress !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(pairAddress, pairAbi, provider)
        const reserves = await pair.getReserves()
        const token0 = await pair.token0()
        const token1 = await pair.token1()

        pairs.push({
          address: pairAddress,
          token0,
          token1,
          reserve0: reserves[0],
          reserve1: reserves[1],
          routerAddress,
        })
      }
    } catch (error) {
      console.error(`Error getting pair from ${name}:`, error)
    }
  }

  return pairs
}

/**
 * Get all V3 pools for a given token pair
 */
export async function getV3Pools(provider: ethers.Provider, fromToken: Token, toToken: Token): Promise<V3Pool[]> {
  const pools: V3Pool[] = []

  // Get pools from all V3 factories
  for (const [name, factoryAddress] of Object.entries(FACTORY_ADDRESSES)) {
    if (!name.includes("V3")) continue // Only V3 factories

    try {
      const factory = new ethers.Contract(factoryAddress, v3FactoryAbi, provider)

      // Fee tiers to check
      const feeTiers = [100, 500, 3000, 10000]

      for (const fee of feeTiers) {
        try {
          // Get pool address
          const poolAddress = await factory.getPool(fromToken.address, toToken.address, fee)

          // If pool exists, get data
          if (poolAddress !== ethers.ZeroAddress) {
            const pool = new ethers.Contract(poolAddress, v3PoolAbi, provider)
            const [token0, token1, liquidity, slot0] = await Promise.all([
              pool.token0(),
              pool.token1(),
              pool.liquidity(),
              pool.slot0(),
            ])

            pools.push({
              address: poolAddress,
              token0,
              token1,
              fee,
              liquidity,
              sqrtPriceX96: slot0.sqrtPriceX96,
              tick: slot0.tick,
            })
          }
        } catch (error) {
          console.error(`Error getting V3 pool with fee ${fee}:`, error)
        }
      }
    } catch (error) {
      console.error(`Error getting V3 pools from ${name}:`, error)
    }
  }

  return pools
}
