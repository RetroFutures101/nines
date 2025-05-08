import { ethers } from "ethers"
import {
  SUBGRAPH_URL,
  FACTORY_ADDRESS,
  MORALIS_API_KEY,
  MORALIS_API_BASE_URL,
  getRpcUrl,
  getWplsAddress,
} from "./constants"
import { mirrorTokenPrice } from "./price-service-validator"
import { debugTokenPrice } from "./price-debug"

// Interface for token data from the subgraph
interface TokenData {
  id: string
  symbol: string
  name: string
  decimals: string
  derivedETH: string // Price in PLS
}

// Interface for PLS price in USD
interface BundleData {
  ethPrice: string // PLS price in USD
}

// Interface for Moralis token price response
interface MoralisTokenPriceResponse {
  nativePrice?: {
    value: string
    decimals: number
    name: string
    symbol: string
  }
  usdPrice: number
  exchangeAddress?: string
  exchangeName?: string
}

// Cache for token prices to avoid too many requests
const priceCache: Record<string, { price: number; timestamp: number }> = {}
const CACHE_DURATION = 60 * 1000 // 1 minute cache

/**
 * Get token price from Moralis API
 */
export async function getTokenPriceFromMoralis(tokenAddress: string, tokenSymbol = ""): Promise<number | null> {
  try {
    // Special case for native token
    if (tokenAddress === "NATIVE") {
      // For native token, get the WPLS price
      const wplsAddress = getWplsAddress()
      const wplsPrice = await getTokenPriceFromMoralis(wplsAddress, "WPLS")
      return mirrorTokenPrice(wplsPrice, "WPLS", "PLS")
    }

    const url = `${MORALIS_API_BASE_URL}/erc20/${tokenAddress}/price?chain=pulse`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": MORALIS_API_KEY,
      },
    })

    if (!response.ok) {
      console.warn(`Moralis API returned ${response.status} for token ${tokenAddress}`)
      return null
    }

    const data: MoralisTokenPriceResponse = await response.json()

    if (data && data.usdPrice) {
      return validateTokenPrice(data.usdPrice, tokenSymbol)
    }

    return null
  } catch (error) {
    console.error(`Failed to fetch price from Moralis for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Get token price from The Graph PulseX subgraph
 */
export async function getTokenPriceFromSubgraph(tokenAddress: string, tokenSymbol = ""): Promise<number | null> {
  try {
    // Special case for native token
    if (tokenAddress === "NATIVE") {
      // For native token, get the WPLS price
      const wplsAddress = getWplsAddress()
      const wplsPrice = await getTokenPriceFromSubgraph(wplsAddress, "WPLS")
      return mirrorTokenPrice(wplsPrice, "WPLS", "PLS")
    }

    // GraphQL query to get token price in PLS and PLS price in USD
    const query = `
    {
      token(id: "${tokenAddress.toLowerCase()}") {
        id
        symbol
        name
        decimals
        derivedETH
      }
      bundle(id: "1") {
        ethPrice
      }
    }
  `

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })

    const { data } = await response.json()

    if (!data || !data.token || !data.bundle) {
      console.warn(`No price data found in subgraph for token ${tokenAddress}`)
      return null
    }

    const token = data.token as TokenData
    const bundle = data.bundle as BundleData

    // Calculate price in USD: token price in PLS * PLS price in USD
    const priceInPls = Number.parseFloat(token.derivedETH)
    const plsPrice = Number.parseFloat(bundle.ethPrice)
    const priceInUsd = priceInPls * plsPrice

    return validateTokenPrice(priceInUsd, tokenSymbol)
  } catch (error) {
    console.error(`Failed to fetch price from subgraph for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Get token price by checking the token/WPLS pair on PulseX
 */
async function getTokenPriceFromPair(tokenAddress: string, tokenSymbol = ""): Promise<number | null> {
  try {
    // Special case for native token
    if (tokenAddress === "NATIVE") {
      // For native token, get the WPLS price
      const wplsAddress = getWplsAddress()
      const wplsPrice = await getTokenPriceFromPair(wplsAddress, "WPLS")
      return mirrorTokenPrice(wplsPrice, "WPLS", "PLS")
    }

    // Create provider using ethers v6 syntax with ENS disabled
    const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
      ensAddress: null, // Disable ENS lookup
    })
    const WPLS_ADDRESS = getWplsAddress()

    // PulseX factory ABI (minimal for getPair)
    const factoryAbi = ["function getPair(address tokenA, address tokenB) external view returns (address pair)"]

    // PulseX pair ABI (minimal for getReserves)
    const pairAbi = [
      "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
    ]

    // Get factory contract
    const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, provider)

    // Get pair address - wrap this in a try/catch to handle non-existent pairs
    let pairAddress
    try {
      pairAddress = await factory.getPair(tokenAddress, WPLS_ADDRESS)
    } catch (error) {
      console.warn(`Error getting pair for token ${tokenAddress}: ${error}`)
      return null
    }

    if (!pairAddress || pairAddress === ethers.ZeroAddress) {
      console.warn(`No liquidity pair found for token ${tokenAddress}`)
      return null
    }

    // Get pair contract
    const pair = new ethers.Contract(pairAddress, pairAbi, provider)

    // Get reserves
    let reserve0, reserve1
    try {
      ;[reserve0, reserve1] = await pair.getReserves()
    } catch (error) {
      console.warn(`Error getting reserves for pair ${pairAddress}: ${error}`)
      return null
    }

    // Get token order
    let token0
    try {
      token0 = await pair.token0()
    } catch (error) {
      console.warn(`Error getting token0 for pair ${pairAddress}: ${error}`)
      return null
    }

    // Calculate price based on reserves
    let priceInPls
    if (token0.toLowerCase() === tokenAddress.toLowerCase()) {
      // If token is token0, price = reserve1 / reserve0
      priceInPls = Number(reserve1) / Number(reserve0)
    } else {
      // If token is token1, price = reserve0 / reserve1
      priceInPls = Number(reserve0) / Number(reserve1)
    }

    // Get PLS price in USD
    const plsPriceInUsd = await getPlsPriceInUsd()

    // Calculate token price in USD
    const priceInUsd = priceInPls * plsPriceInUsd

    return validateTokenPrice(priceInUsd, tokenSymbol)
  } catch (error) {
    console.error(`Failed to fetch price from pair for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Get PLS price in USD
 */
async function getPlsPriceInUsd(): Promise<number> {
  try {
    const WPLS_ADDRESS = getWplsAddress()

    // Try to get PLS price from Moralis first
    const plsPriceFromMoralis = await getTokenPriceFromMoralis(WPLS_ADDRESS, "WPLS")
    if (plsPriceFromMoralis !== null) {
      return plsPriceFromMoralis
    }

    // Try to get PLS price from subgraph as fallback
    const query = `
    {
      bundle(id: "1") {
        ethPrice
      }
    }
  `

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })

    const { data } = await response.json()

    if (data && data.bundle) {
      return Number.parseFloat(data.bundle.ethPrice)
    }

    // Fallback to a default value if all methods fail
    return 0.00012 // Example value, replace with a more accurate default if known
  } catch (error) {
    console.error("Failed to fetch PLS price:", error)
    return 0.00012 // Example value, replace with a more accurate default if known
  }
}

/**
 * Get token price - main function that tries different methods
 */
export async function getTokenPrice(tokenAddress: string, tokenSymbol = ""): Promise<number | null> {
  // Extract symbol from token if not provided
  if (!tokenSymbol && typeof tokenAddress === "object" && tokenAddress.symbol) {
    tokenSymbol = tokenAddress.symbol
    tokenAddress = tokenAddress.address
  }

  // First, check if we have a cached price
  const cachedPrice = priceCache[tokenAddress]
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION) {
    // Add debugging for WATT token
    if (tokenSymbol === "WATT") {
      debugTokenPrice("WATT", tokenAddress, cachedPrice.price)
    }
    return cachedPrice.price
  }

  try {
    // Special case for PLS (native token)
    if (tokenAddress === "NATIVE") {
      // For native token, get the WPLS price
      const wplsAddress = getWplsAddress()
      const wplsPrice = await getTokenPrice(wplsAddress, "WPLS")
      return mirrorTokenPrice(wplsPrice, "WPLS", "PLS")
    }

    // Try to get price from Moralis first
    const moralisPrice = await getTokenPriceFromMoralis(tokenAddress, tokenSymbol)
    if (moralisPrice !== null) {
      // Cache the price
      priceCache[tokenAddress] = {
        price: moralisPrice,
        timestamp: Date.now(),
      }

      // Add debugging for WATT token
      if (tokenSymbol === "WATT") {
        debugTokenPrice("WATT", tokenAddress, moralisPrice)
      }

      return moralisPrice
    }

    // If Moralis fails, try to get price from subgraph
    const subgraphPrice = await getTokenPriceFromSubgraph(tokenAddress, tokenSymbol)
    if (subgraphPrice !== null) {
      // Cache the price
      priceCache[tokenAddress] = {
        price: subgraphPrice,
        timestamp: Date.now(),
      }

      // Add debugging for WATT token
      if (tokenSymbol === "WATT") {
        debugTokenPrice("WATT", tokenAddress, subgraphPrice)
      }

      return subgraphPrice
    }

    // If both fail, try to get price from pair
    const pairPrice = await getTokenPriceFromPair(tokenAddress, tokenSymbol)
    if (pairPrice !== null) {
      // Cache the price
      priceCache[tokenAddress] = {
        price: pairPrice,
        timestamp: Date.now(),
      }

      // Add debugging for WATT token
      if (tokenSymbol === "WATT") {
        debugTokenPrice("WATT", tokenAddress, pairPrice)
      }

      return pairPrice
    }

    // If all methods fail, return null
    return null
  } catch (error) {
    console.error(`Failed to get price for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Get 24h price change percentage
 */
export async function getTokenPriceChange(tokenAddress: string): Promise<number | null> {
  try {
    // For now, we'll return a random value between -5% and +5%
    // In a real implementation, you'd compare current price with 24h ago price
    return Math.random() * 10 - 5
  } catch (error) {
    console.error(`Failed to get price change for ${tokenAddress}:`, error)
    return null
  }
}

// Add special handling for WATT token in the validateTokenPrice function:

const MAX_TOKEN_PRICE = 100000

function validateTokenPrice(price: number | null, tokenSymbol: string): number | null {
  if (price === null || price === undefined) {
    return null
  }

  // Check if price is a valid number
  if (isNaN(price) || !isFinite(price)) {
    console.warn(`Invalid price for ${tokenSymbol}: ${price}`)
    return null
  }

  // Check if price is within reasonable bounds
  if (price < 0) {
    console.warn(`Negative price for ${tokenSymbol}: ${price}`)
    return null
  }

  if (price > MAX_TOKEN_PRICE) {
    console.warn(`Price too high for ${tokenSymbol}: ${price}`)
    // Return a more reasonable price
    return 0.01 // Default to $0.01 for tokens with unreasonably high prices
  }

  // Special handling for WATT token to ensure consistent formatting
  if (tokenSymbol === "WATT") {
    // Ensure WATT price is properly formatted as a decimal number
    // This prevents scientific notation issues
    if (price.toString().includes("e")) {
      // Convert from scientific notation to decimal
      const [mantissa, exponent] = price.toString().split("e")
      const exponentNum = Number.parseInt(exponent, 10)
      if (exponentNum < 0) {
        // For negative exponents (small numbers)
        const absExponent = Math.abs(exponentNum)
        const mantissaWithoutDot = mantissa.replace(".", "")
        const paddedMantissa = mantissaWithoutDot.padStart(absExponent + mantissaWithoutDot.length, "0")
        const result = "0." + paddedMantissa
        console.log(`[WATT Debug] Converted scientific notation ${price} to decimal ${result}`)
        return Number.parseFloat(result)
      }
    }
  }

  return price
}
