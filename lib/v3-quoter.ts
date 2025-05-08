import { ethers } from "ethers"
import { getProvider } from "./provider"

// V3 Pool ABI (minimal)
const V3_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function tickSpacing() external view returns (int24)",
  "function fee() external view returns (uint24)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]

// Constants for tick math
const Q96 = ethers.BigInt("0x1000000000000000000000000")
const MIN_SQRT_RATIO = ethers.BigInt("4295128739")
const MAX_SQRT_RATIO = ethers.BigInt("1461446703485210103287273052203988822378723970342")

/**
 * Get the next sqrt price from a swap
 */
function getNextSqrtPriceFromAmount0(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amount: bigint,
  zeroForOne: boolean,
): bigint {
  if (amount === ethers.BigInt(0)) return sqrtPriceX96

  const numerator = liquidity * sqrtPriceX96 * ethers.BigInt(2)
  const denominator =
    liquidity * ethers.BigInt(2) + (zeroForOne ? amount * sqrtPriceX96 : (amount * Q96) / sqrtPriceX96)

  return numerator / denominator
}

function getNextSqrtPriceFromAmount1(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amount: bigint,
  zeroForOne: boolean,
): bigint {
  if (amount === ethers.BigInt(0)) return sqrtPriceX96

  const denominator = liquidity * ethers.BigInt(2)
  let numerator

  if (zeroForOne) {
    numerator = liquidity * sqrtPriceX96 * ethers.BigInt(2) - amount * Q96
  } else {
    numerator = liquidity * sqrtPriceX96 * ethers.BigInt(2) + amount * Q96
  }

  return numerator / denominator
}

/**
 * Calculate amount out from a V3 swap
 */
function calculateAmountOut(
  sqrtRatioX96: bigint,
  sqrtRatioNextX96: bigint,
  liquidity: bigint,
  zeroForOne: boolean,
): bigint {
  if (zeroForOne) {
    // amount1 = L * (sqrt(P) - sqrt(P'))
    return (liquidity * (sqrtRatioX96 - sqrtRatioNextX96)) / Q96
  } else {
    // amount0 = L * (1/sqrt(P') - 1/sqrt(P))
    return (liquidity * Q96 * (sqrtRatioNextX96 - sqrtRatioX96)) / (sqrtRatioNextX96 * sqrtRatioX96)
  }
}

/**
 * Get quote from a V3 pool
 */
export async function getV3Quote(poolAddress: string, amountIn: bigint, zeroForOne: boolean): Promise<bigint> {
  try {
    const provider = getProvider()
    const pool = new ethers.Contract(poolAddress, V3_POOL_ABI, provider)

    // Get pool data
    const [slot0, liquidity] = await Promise.all([pool.slot0(), pool.liquidity()])

    const sqrtPriceX96 = slot0.sqrtPriceX96

    // Calculate next sqrt price
    let sqrtPriceNextX96
    if (zeroForOne) {
      sqrtPriceNextX96 = getNextSqrtPriceFromAmount0(sqrtPriceX96, liquidity, amountIn, true)
      // Ensure we don't go below MIN_SQRT_RATIO
      sqrtPriceNextX96 = sqrtPriceNextX96 < MIN_SQRT_RATIO ? MIN_SQRT_RATIO : sqrtPriceNextX96
    } else {
      sqrtPriceNextX96 = getNextSqrtPriceFromAmount1(sqrtPriceX96, liquidity, amountIn, false)
      // Ensure we don't go above MAX_SQRT_RATIO
      sqrtPriceNextX96 = sqrtPriceNextX96 > MAX_SQRT_RATIO ? MAX_SQRT_RATIO : sqrtPriceNextX96
    }

    // Calculate amount out
    const amountOut = calculateAmountOut(sqrtPriceX96, sqrtPriceNextX96, liquidity, zeroForOne)

    return amountOut
  } catch (error) {
    console.error("Error getting V3 quote:", error)
    return ethers.BigInt(0)
  }
}

/**
 * Get quote for a multi-hop path
 */
export async function getV3PathQuote(path: string[], poolAddresses: string[], amountIn: bigint): Promise<bigint> {
  try {
    let currentAmountIn = amountIn

    for (let i = 0; i < path.length - 1; i++) {
      const tokenIn = path[i]
      const tokenOut = path[i + 1]
      const poolAddress = poolAddresses[i]

      // Get pool tokens to determine direction
      const pool = new ethers.Contract(poolAddress, V3_POOL_ABI, getProvider())
      const token0 = await pool.token0()

      // Determine if we're swapping from token0 to token1
      const zeroForOne = tokenIn.toLowerCase() === token0.toLowerCase()

      // Get quote for this hop
      const amountOut = await getV3Quote(poolAddress, currentAmountIn, zeroForOne)

      // Use output as input for next hop
      currentAmountIn = amountOut
    }

    return currentAmountIn
  } catch (error) {
    console.error("Error getting V3 path quote:", error)
    return ethers.BigInt(0)
  }
}
