import type { ethers } from "ethers"
import { getTokenPrice as getTokenPriceFromService } from "./price-service"

// Re-export for backward compatibility
export { getTokenPriceFromService as getTokenPrice }

// Interfaces
export interface SwapQuoteParams {
  fromToken: string
  toToken: string
  amount: string
  slippage: number
  isTestnet?: boolean
}

export interface SwapQuoteResult {
  toTokenAmount: string
  priceImpact: number
  path: string[]
  executionPrice?: number
  marketPrice?: number
  routeDescription?: string
}

export interface SwapParams {
  signer: ethers.Signer
  fromToken: string
  toToken: string
  amount: string
  slippage: number
  userAddress: string
  isTestnet?: boolean
}

// Actual Router ABI with the methods we need
const RouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
]

// Add timeout to promise
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId)
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl, undefined, {
    ensAddress: null // Explicitly disable ENS
  })
}

// Helper function to get token decimals
async function getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    // For native token, return 18
    if (tokenAddress === "NATIVE") {
      return 18
    }

    const provider = createProvider(getRpcUrl())

    const abi = ["function decimals() view returns (uint8)"]
    const contract = new ethers.Contract(tokenAddress, abi, provider)

    const decimals = await contract.decimals()
    return Number(decimals)
  } catch (error: any) {
    console.error(`Failed to get decimals for token ${tokenAddress}:`, error)
    return 18 // Default to 18 decimals
  }
}

// Helper function to calculate price impact
async function calculatePriceImpact(
  fromAmount: string,
  toAmount: string,
  fromDecimals: number,
  toDecimals: number,
): Promise<number> {
  try {
    // Define parameters for more accurate price impact calculation
    const baseReserve = 1000000; // Larger base liquidity for more realistic calculation
    
    // Convert amounts to numbers for calculation
    const fromAmountNum = Number(ethers.formatUnits(fromAmount, fromDecimals));
    const toAmountNum = Number(ethers.formatUnits(toAmount, toDecimals));
    
    // Estimate pool reserves based on the output amount
    // This simulates a more realistic pool with appropriate depth
    const estimatedK = baseReserve * baseReserve; // Constant product k = x * y
    const reserveRatio = toAmountNum / fromAmountNum; // Ideal exchange rate
    
    // Calculate reserves that would give this ratio
    const reserveB = Math.sqrt(estimatedK / reserveRatio);
    const reserveA = estimatedK / reserveB;
    
    // Calculate price before swap
    const priceBefore = reserveB / reserveA;
    
    // Calculate reserves after swap
    const reserveAAfter = reserveA + fromAmountNum;
    const reserveBAfter = estimatedK / reserveAAfter;
    
    // Calculate actual output amount
    const actualOutput = reserveB - reserveBAfter;
    
    // Calculate effective price
    const effectivePrice = actualOutput / fromAmountNum;
    
    // Calculate price impact as percentage difference
    const priceImpact = Math.abs((effectivePrice - priceBefore) / priceBefore);
    
    // Apply trade size factor (larger trades have higher impact)
    const tradeSizeFactor = Math.min(1, fromAmountNum / baseReserve);
    
    // Apply volatility factor (can be adjusted based on token pair)
    const volatilityFactor = 0.2; // Lower volatility factor for more realistic impact
    
    // Combine factors for final impact
    const finalImpact = priceImpact * (1 + tradeSizeFactor * volatilityFactor);
    
    // Ensure the price impact is within reasonable bounds (0.1% to 5%)
    const cappedPriceImpact = Math.min(Math.max(finalImpact, 0.001), 0.05);
    
    return cappedPriceImpact * 100; // Return as percentage
  } catch (error: any) {
    console.error("Failed to calculate price impact:", error);
    return 0.5; // Default price impact
  }
}

// Function to safely stringify BigInt values in an object
function safeStringifyBigInt<T>(obj: T): T {
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (typeof v === 'bigint') {
          return [k, v.toString()];
        } else if (typeof v === 'object' && v !== null) {
          return [k, safeStringifyBigInt(v)];
        } else {
          return [k, v];
        }
      })
    ) as T;
  }
  return obj;
}

// Get swap quote function
export async function getSwapQuote(params: SwapQuoteParams): Promise<SwapQuoteResult> {
  const { fromToken, toToken, amount, slippage, isTestnet } = params
  let fromTokenDecimals: number
  let toTokenDecimals: number
  let toTokenAmount: string

  try {
    console.log("Getting swap quote for:", {
      fromToken,
      toToken,
      amount,
      slippage,
      isTestnet
    })

    // Create provider using ethers v6 syntax with ENS disabled
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = createProvider(rpcUrl)

    // Get router address and WPLS address - ALWAYS USE V1 ROUTER
    const routerAddress = isTestnet 
      ? "0x165C3410fC91EF562C50559f7d2289fEbed552d9" // Testnet V1 router
      : "0x165C3410fC91EF562C50559f7d2289fEbed552d9" // Mainnet V1 router
    
    const WPLS_ADDRESS = isTestnet ? getTestnetWplsAddress() : getWplsAddress()

    // Log the RPC URL and router address for debugging
    console.log(`Using ${isTestnet ? "Testnet" : "Mainnet"} V1 Router Address:`, routerAddress)
    console.log(`Using ${isTestnet ? "Testnet" : "Mainnet"} WPLS Address:`, WPLS_ADDRESS)

    // Create router contract
    const router = new ethers.Contract(routerAddress, RouterABI, provider)

    // Get token decimals for proper formatting
    [fromTokenDecimals, toTokenDecimals] = await Promise.all([
      getTokenDecimals(fromToken),
      getTokenDecimals(toToken),
    ])

    console.log("Token decimals:", {
      fromTokenDecimals,
      toTokenDecimals,
    })

    // Replace "NATIVE" with WPLS address for the path
    const actualFromToken = fromToken === "NATIVE" ? WPLS_ADDRESS : fromToken
    const actualToToken = toToken === "NATIVE" ? WPLS_ADDRESS : toToken

    // Check if both tokens are the same
    if (actualFromToken === actualToToken) {
      console.error("Cannot swap a token to itself")
      return {
        toTokenAmount: "0",
        priceImpact: 0,
        path: [fromToken, toToken], // Return original tokens for UI display
        executionPrice: 0,
        marketPrice: 0,
      }
    }

    // Define path - try direct path first
    let path = [actualFromToken, actualToToken]
    let amountsOut
    let routeDescription = "direct (V1)"

    try {
      console.log("Trying direct path with V1 router:", path)
      console.log("Input amount:", amount)

      // Try direct path with timeout
      const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

      // Convert BigInt values to strings
      amountsOut = Array.isArray(rawAmountsOut)
        ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
        : []

      console.log("Direct path successful with V1 router:", amountsOut)
    } catch (error: any) {
      console.warn("Direct path failed or timed out, trying with WPLS as intermediary:", error)

      // If direct path fails, try using WPLS as intermediary
      path = [actualFromToken, WPLS_ADDRESS, actualToToken]
      routeDescription = "via WPLS (V1)"

      try {
        console.log("Trying intermediary path with V1 router:", path)

        // Try intermediary path with timeout
        const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

        // Convert BigInt values to strings
        amountsOut = Array.isArray(rawAmountsOut)
          ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
          : []

        console.log("Intermediary path successful with V1 router:", amountsOut)
      } catch (intermediaryError: any) {
        console.error("Both direct and intermediary paths failed with V1 router:", intermediaryError)

        // Try one more path with a different intermediary if available
        try {
          // Use a common stablecoin as intermediary
          const USDC_ADDRESS = "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07"
          path = [actualFromToken, USDC_ADDRESS, actualToToken]
          routeDescription = "via USDC (V1)"

          console.log("Trying USDC intermediary path with V1 router:", path)

          const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

          // Convert BigInt values to strings
          amountsOut = Array.isArray(rawAmountsOut)
            ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
            : []

          console.log("USDC intermediary path successful with V1 router:", amountsOut)
        } catch (finalError: any) {
          console.error("All paths failed with V1 router:", finalError)

          // If all paths fail, return a zero quote
          return {
            toTokenAmount: "0",
            priceImpact: 0,
            path: path,
            executionPrice: 0,
            marketPrice: 0,
          }
        }
      }
    }

    // Ensure we have a valid amountsOut array
    if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length === 0) {
      console.error("Invalid amounts out returned from router")
      throw new Error("Invalid amounts out returned from router")
    }

    // Get the last amount out (the amount of toToken received)
    const lastAmountOut = amountsOut[amountsOut.length - 1].toString()

    console.log("Last amount out:", lastAmountOut)

    // Calculate execution price (how much toToken is actually received per fromToken)
    const fromAmount = Number(ethers.formatUnits(amount, fromTokenDecimals))
    const toAmount = Number(ethers.formatUnits(lastAmountOut, toTokenDecimals))

    const executionPrice = fromAmount > 0 ? toAmount / fromAmount : 0

    console.log("Execution price:", executionPrice)

    // Calculate price impact
    const priceImpact = await calculatePriceImpact(amount, lastAmountOut, fromTokenDecimals, toTokenDecimals)

    console.log("Price impact:", priceImpact)

    // Log the final quote
    console.log(`Swap quote (${routeDescription}):`, {
      fromToken,
      toToken,
      amount: ethers.formatUnits(amount, fromTokenDecimals),
      result: ethers.formatUnits(lastAmountOut, toTokenDecimals),
      executionPrice,
      priceImpact,
    })

    // Create the result object and ensure all BigInt values are converted to strings
    const result: SwapQuoteResult = {
      toTokenAmount: lastAmountOut,
      priceImpact,
      path: path,
      executionPrice,
      marketPrice: executionPrice, // Use execution price as market price for now
      routeDescription
    }

    // Return the result with all BigInt values converted to strings
    return safeStringifyBigInt(result)
  } catch (error: any) {
    console.error("Failed to get swap quote:", error)

    // Return a fallback quote to prevent UI from breaking
    return {
      toTokenAmount: "0",
      priceImpact: 0,
      path: [fromToken, toToken],
      executionPrice: 0,
      marketPrice: 0,
    }
  }
}

// Function to generate all possible paths
function generatePaths(fromToken: string, toToken: string, isTestnet: boolean): { path: string[]; description: string }[] {
  const wplsAddress = isTestnet ? getTestnetWplsAddress() : getWplsAddress()
  const paths: { path: string[]; description: string }[] = []

  // 1. Direct path (always try this first)
  paths.push({ path: [fromToken, toToken], description: "direct path" })

  // 2. Via WPLS (common intermediary for most tokens)
  if (fromToken !== wplsAddress && toToken !== wplsAddress) {
    paths.push({ path: [fromToken, wplsAddress, toToken], description: "via WPLS" })
  }

  // 3. Via stablecoins (only for non-RH token pairs)
  // const isFromRHToken = Object.values(PRIMARY_TOKENS).some((addr) => addr.toLowerCase() === fromToken.toLowerCase())
  // const isToRHToken = Object.values(PRIMARY_TOKENS).some((addr) => addr.toLowerCase() === toToken.toLowerCase())

  // if (!isTestnet && !isFromRHToken && !isToRHToken) {
  //   Object.entries(STABLECOINS).forEach(([symbol, stablecoin]) => {
  //     if (fromToken !== stablecoin && toToken !== stablecoin) {
  //       paths.push({ path: [fromToken, stablecoin, toToken], description: `via ${symbol}` })
  //     }
  //   })
  // }

  return paths
}

// Function to find the best path
async function findBestPath(router: ethers.Contract, possiblePaths: { path: string[]; description: string }[], amount: string): Promise<{ path: string[]; outputAmount: bigint; description: string } | null> {
  let bestPathResult: { path: string[]; outputAmount: bigint; description: string } | null = null

  for (const { path, description } of possiblePaths) {
    try {
      const amounts = await router.getAmountsOut(amount, path)
      const outputAmount = amounts[amounts.length - 1]

      if (!bestPathResult || outputAmount > bestPathResult.outputAmount) {
        bestPathResult = { path, outputAmount, description }
      }
    } catch (error: any) {
      console.warn(`Path ${description} failed:`, error)
    }
  }

  return bestPathResult
}
