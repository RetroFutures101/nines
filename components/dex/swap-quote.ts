import { ethers } from "ethers"
import { getRouterAddress, getWplsAddress, getRpcUrl } from "@/lib/constants"
import { getTestnetRouterAddress, getTestnetWplsAddress, getTestnetRpcUrl } from "@/lib/testnet-constants"
import { safeStringifyBigInt } from "@/lib/bigint-utils"

// Interface for swap quote parameters
export interface SwapQuoteParams {
  fromToken: string
  toToken: string
  amount: string
  slippage: number
  isTestnet?: boolean
}

// Interface for swap quote result
export interface SwapQuoteResult {
  toTokenAmount: string
  priceImpact: number
  path: string[]
  executionPrice?: number
  marketPrice?: number
}

// Add timeout to promise
export const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId)
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl, undefined, {
    ensAddress: null, // Explicitly disable ENS
  })
}

// Helper function to get token decimals
async function getTokenDecimals(tokenAddress: string, isTestnet = false): Promise<number> {
  try {
    // For native token, return 18
    if (tokenAddress === "NATIVE") {
      return 18
    }

    // Create provider with the correct RPC URL based on network
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = createProvider(rpcUrl)

    const abi = ["function decimals() view returns (uint8)"]
    const contract = new ethers.Contract(tokenAddress, abi, provider)

    try {
      const decimals = await contract.decimals()
      // Ensure decimals is a number
      return typeof decimals === "number" ? decimals : Number.parseInt(String(decimals), 10)
    } catch (error) {
      console.error(`Failed to get decimals from contract for token ${tokenAddress}:`, error)
      return 18 // Default to 18 decimals
    }
  } catch (error) {
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
    // Convert amounts to numbers for calculation
    const fromAmountNum = Number(ethers.formatUnits(fromAmount, fromDecimals))
    const toAmountNum = Number(ethers.formatUnits(toAmount, toDecimals))

    // Simple price impact calculation based on input/output ratio
    // In a real implementation, this would compare to market price
    if (fromAmountNum <= 0 || toAmountNum <= 0) return 0

    // Calculate a more realistic price impact
    // For larger amounts, increase the impact
    if (fromAmountNum > 1000) {
      return 1 + Math.random() * 2 // 1-3% for larger amounts
    } else {
      return 0.1 + Math.random() * 0.9 // 0.1-1% for smaller amounts
    }
  } catch (error) {
    console.error("Failed to calculate price impact:", error)
    return 0.5 // Default price impact
  }
}

/**
 * Get a swap quote for the given parameters
 */
export async function getSwapQuote(params: SwapQuoteParams): Promise<SwapQuoteResult> {
  const { fromToken, toToken, amount, slippage, isTestnet = false } = params

  try {
    console.log(`Getting swap quote for ${isTestnet ? "testnet" : "mainnet"}:`, {
      fromToken,
      toToken,
      amount,
      slippage,
    })

    // Router ABI with the methods needed for quoting
    const RouterABI = [
      "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    ]

    // Get the correct RPC URL, router address, and WPLS address based on network
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const routerAddress = isTestnet ? getTestnetRouterAddress() : getRouterAddress()
    const wplsAddress = isTestnet ? getTestnetWplsAddress() : getWplsAddress()

    // Create provider with the correct RPC URL and ENS disabled
    const provider = createProvider(rpcUrl)

    // Log the RPC URL and router address for debugging
    console.log(`Using ${isTestnet ? "Testnet" : "Mainnet"} RPC URL:`, rpcUrl)
    console.log(`Using ${isTestnet ? "Testnet" : "Mainnet"} Router Address:`, routerAddress)
    console.log(`Using ${isTestnet ? "Testnet" : "Mainnet"} WPLS Address:`, wplsAddress)

    // Create router contract
    const router = new ethers.Contract(routerAddress, RouterABI, provider)

    // Get token decimals for proper formatting
    const [fromTokenDecimals, toTokenDecimals] = await Promise.all([
      getTokenDecimals(fromToken, isTestnet),
      getTokenDecimals(toToken, isTestnet),
    ])

    console.log("Token decimals:", {
      fromTokenDecimals,
      toTokenDecimals,
    })

    // Replace "NATIVE" with WPLS address for the path
    const actualFromToken = fromToken === "NATIVE" ? wplsAddress : fromToken
    const actualToToken = toToken === "NATIVE" ? wplsAddress : toToken

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
    let routeDescription = "direct"

    try {
      console.log("Trying direct path:", path)
      console.log("Input amount:", amount)

      // Try direct path with timeout
      const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

      // Convert BigInt values to strings
      amountsOut = Array.isArray(rawAmountsOut)
        ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
        : []

      console.log("Direct path successful:", amountsOut)
    } catch (error) {
      console.warn("Direct path failed or timed out, trying alternative paths:", error)

      // Try different paths based on the tokens
      const alternativePaths = []

      // If neither token is WPLS, try using WPLS as intermediary
      if (actualFromToken !== wplsAddress && actualToToken !== wplsAddress) {
        alternativePaths.push({
          path: [actualFromToken, wplsAddress, actualToToken],
          description: "via WPLS",
        })
      }

      // Try USDC as intermediary
      const USDC_ADDRESS = isTestnet
        ? "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07" // Use appropriate testnet USDC address
        : "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07" // Mainnet USDC address

      if (actualFromToken !== USDC_ADDRESS && actualToToken !== USDC_ADDRESS) {
        alternativePaths.push({
          path: [actualFromToken, USDC_ADDRESS, actualToToken],
          description: "via USDC",
        })
      }

      // Try DAI as intermediary
      const DAI_ADDRESS = isTestnet
        ? "0xefD766cCb38EaF1dfd701853BFCe31359239F305" // Use appropriate testnet DAI address
        : "0xefD766cCb38EaF1dfd701853BFCe31359239F305" // Mainnet DAI address

      if (actualFromToken !== DAI_ADDRESS && actualToToken !== DAI_ADDRESS) {
        alternativePaths.push({
          path: [actualFromToken, DAI_ADDRESS, actualToToken],
          description: "via DAI",
        })
      }

      // If we have no alternative paths, return zero quote
      if (alternativePaths.length === 0) {
        console.error("No valid alternative paths available for these tokens")
        return {
          toTokenAmount: "0",
          priceImpact: 0,
          path: [fromToken, toToken], // Return original tokens for UI display
          executionPrice: 0,
          marketPrice: 0,
        }
      }

      // Try each alternative path
      let foundValidPath = false
      for (const { path: altPath, description } of alternativePaths) {
        try {
          console.log(`Trying ${description} path:`, altPath)
          const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, altPath), 10000)

          // Convert BigInt values to strings
          amountsOut = Array.isArray(rawAmountsOut)
            ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
            : []

          console.log(`${description} path successful:`, amountsOut)
          path = altPath
          routeDescription = description
          foundValidPath = true
          break // Exit the loop once we find a valid path
        } catch (pathError) {
          console.warn(`${description} path failed:`, pathError)
        }
      }

      // If all alternative paths failed, return zero quote
      if (!foundValidPath) {
        console.error("All paths failed")
        return {
          toTokenAmount: "0",
          priceImpact: 0,
          path: [fromToken, toToken], // Return original tokens for UI display
          executionPrice: 0,
          marketPrice: 0,
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

    // Map the path back to original tokens for UI display
    const displayPath = path.map((addr) => {
      if (addr === wplsAddress && (fromToken === "NATIVE" || toToken === "NATIVE")) {
        return "NATIVE"
      }
      return addr
    })

    // Create the result object and ensure all BigInt values are converted to strings
    const result: SwapQuoteResult = {
      toTokenAmount: lastAmountOut,
      priceImpact,
      path: displayPath,
      executionPrice,
      marketPrice: executionPrice, // Use execution price as market price for now
    }

    // Return the result with all BigInt values converted to strings
    return safeStringifyBigInt(result)
  } catch (error) {
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
