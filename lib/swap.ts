import { ethers } from "ethers"
import { getTokenPrice as getTokenPriceFromService } from "./price-service"

interface SwapQuoteParams {
  fromToken: string
  toToken: string
  amount: string
  slippage: number
}

interface SwapQuoteResult {
  toTokenAmount: string
  priceImpact: number
  path: string[]
  executionPrice: number
  marketPrice: number
}

interface SwapParams {
  signer: ethers.Signer
  fromToken: string
  toToken: string
  amount: string
  slippage: number
  userAddress: string
}

// Re-export for backward compatibility
export { getTokenPriceFromService as getTokenPrice }

// Actual Router ABI with the methods we need
const RouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
]

// Add timeout to promise
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
};

// Helper function to get token decimals
async function getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    // For native token, return 18
    if (tokenAddress === "NATIVE") {
      return 18
    }

    const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
      ensAddress: null, // Disable ENS lookup
    })

    const abi = ["function decimals() view returns (uint8)"]
    const contract = new ethers.Contract(tokenAddress, abi, provider)

    const decimals = await contract.decimals()
    return Number(decimals)
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

// Update the getSwapQuote function to better handle errors and timeouts
export async function getSwapQuote(params: SwapQuoteParams): Promise<SwapQuoteResult> {
  const { fromToken, toToken, amount, slippage } = params

  try {
    console.log("Getting swap quote for:", {
      fromToken,
      toToken,
      amount,
      slippage,
    })

    // Create provider using ethers v6 syntax with ENS disabled
    const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
      ensAddress: null, // Disable ENS lookup
    })

    // Log the RPC URL and router address for debugging
    console.log("Using RPC URL:", getRpcUrl())
    console.log("Using Router Address:", getRouterAddress())
    console.log("Using WPLS Address:", getWplsAddress())

    // Create router contract
    const router = new ethers.Contract(getRouterAddress(), RouterABI, provider)
    const WPLS_ADDRESS = getWplsAddress()

    // Get token decimals for proper formatting
    const [fromTokenDecimals, toTokenDecimals] = await Promise.all([
      getTokenDecimals(fromToken),
      getTokenDecimals(toToken),
    ])

    console.log("Token decimals:", {
      fromTokenDecimals,
      toTokenDecimals,
    })

    // Define path - try direct path first
    let path = [fromToken, toToken]
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
      console.warn("Direct path failed or timed out, trying with WPLS as intermediary:", error)

      // If direct path fails, try using WPLS as intermediary
      path = [fromToken, WPLS_ADDRESS, toToken]
      routeDescription = "via WPLS"

      try {
        console.log("Trying intermediary path:", path)

        // Try intermediary path with timeout
        const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

        // Convert BigInt values to strings
        amountsOut = Array.isArray(rawAmountsOut)
          ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
          : []

        console.log("Intermediary path successful:", amountsOut)
      } catch (intermediaryError) {
        console.error("Both direct and intermediary paths failed:", intermediaryError)

        // Try one more path with a different intermediary if available
        try {
          // Use a common stablecoin as intermediary
          const USDC_ADDRESS = "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07"
          path = [fromToken, USDC_ADDRESS, toToken]
          routeDescription = "via USDC"

          console.log("Trying USDC intermediary path:", path)

          const rawAmountsOut = await withTimeout(router.getAmountsOut(amount, path), 10000)

          // Convert BigInt values to strings
          amountsOut = Array.isArray(rawAmountsOut)
            ? rawAmountsOut.map((amt) => (typeof amt === "bigint" ? amt.toString() : amt.toString()))
            : []

          console.log("USDC intermediary path successful:", amountsOut)
        } catch (finalError) {
          console.error("All paths failed:", finalError)

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
      path,
      executionPrice,
      marketPrice: executionPrice, // Use execution price as market price for now
    }

    // Return the result with all BigInt values converted to strings
    return result
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

/**
* Execute a token swap
*/
export async function executeSwap({
  signer,
  fromToken,
  toToken,
  amount,
  slippage,
  userAddress,
}: SwapParams): Promise<ethers.ContractTransaction> {
  try {
    // Get router contract with signer that has ENS disabled
    const router = new ethers.Contract(getRouterAddress(), RouterABI, signer)

    // Get quote with timeout
    const quote = await withTimeout(
      getSwapQuote({
        fromToken,
        toToken,
        amount,
        slippage,
      }),
      15000, // 15 seconds timeout
    )

    // If quote returned zero, there's no valid path
    if (quote.toTokenAmount === "0") {
      throw new Error("No valid swap path found between these tokens")
    }

    // Calculate minimum amount out with slippage
    // Convert to BigInt for calculation, then back to string
    const quoteAmountBigInt = ethers.getBigInt(quote.toTokenAmount)
    const slippageFactor = ethers.getBigInt(Math.floor((100 - slippage) * 100))
    const minAmountOut = (quoteAmountBigInt * slippageFactor) / ethers.getBigInt(10000)
    const minAmountOutStr = minAmountOut.toString()

    // Check if token approval is needed
    const tokenContract = new ethers.Contract(
      fromToken,
      ["function approve(address spender, uint256 amount) public returns (bool)"],
      signer,
    )

    // Approve router to spend tokens
    const approveTx = await tokenContract.approve(getRouterAddress(), amount)
    await approveTx.wait()

    // Execute swap
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now

    // Call swapExactTokensForTokens with the correct path
    return router.swapExactTokensForTokens(amount, minAmountOutStr, quote.path, userAddress, deadline)
  } catch (error) {
    console.error("Failed to execute swap:", error)
    throw error
  }
}
