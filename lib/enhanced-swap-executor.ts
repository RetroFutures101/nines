import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getRouterAddress, getWplsAddress } from "./env-config"
import { getEnhancedSwapQuote } from "./enhanced-smart-routing"

/**
 * Execute a swap using the enhanced routing system
 */
export async function executeEnhancedSwap(
  fromToken: Token,
  toToken: Token,
  amount: string,
  slippage: number,
  userAddress: string,
  signer: ethers.Signer,
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    console.log(`Executing enhanced swap: ${fromToken.symbol} -> ${toToken.symbol}, amount: ${amount}`)

    // Get the enhanced swap quote
    const quote = await getEnhancedSwapQuote(fromToken, toToken, amount, slippage)
    console.log("Enhanced swap quote:", quote)

    // Check if we have valid routes
    if (!quote.routes || quote.routes.length === 0) {
      throw new Error("No valid routes found for this swap")
    }

    // Get the router address and WPLS address
    const routerAddress = getRouterAddress()
    const wplsAddress = getWplsAddress()

    // Check if we're dealing with native token (PLS)
    const isFromNative = fromToken.address === "NATIVE"
    const isToNative = toToken.address === "NATIVE"

    // Router ABI - minimal version with just the functions we need
    const routerAbi = [
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    ]

    // Create router contract instance - use the signer directly, don't try to reconnect it
    const router = new ethers.Contract(routerAddress, routerAbi, signer)

    // Parse amount
    const decimals = typeof fromToken.decimals === "number" ? fromToken.decimals : Number(fromToken.decimals)
    const parsedAmount = ethers.parseUnits(amount, decimals)

    // Set deadline
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now

    // Approve token if needed (skip for native token)
    if (!isFromNative) {
      await approveToken(fromToken.address, routerAddress, parsedAmount, signer)
    }

    // Get the best route
    const bestRoute = quote.routes[0]
    console.log("Using route:", bestRoute.path.join(" -> "))

    // Execute the swap based on token types
    let swapTx

    if (isFromNative && !isToNative) {
      // Swap PLS -> Token
      console.log(`Swapping ${amount} PLS for ${toToken.symbol}`)
      swapTx = await router.swapExactETHForTokens(quote.minOutputAmount, bestRoute.path, userAddress, deadline, {
        value: parsedAmount,
      })
    } else if (!isFromNative && isToNative) {
      // Swap Token -> PLS
      console.log(`Swapping ${amount} ${fromToken.symbol} for PLS`)
      swapTx = await router.swapExactTokensForETH(
        parsedAmount,
        quote.minOutputAmount,
        bestRoute.path,
        userAddress,
        deadline,
      )
    } else if (!isFromNative && !isToNative) {
      // Swap Token -> Token
      console.log(`Swapping ${amount} ${fromToken.symbol} for ${toToken.symbol}`)
      swapTx = await router.swapExactTokensForTokens(
        parsedAmount,
        quote.minOutputAmount,
        bestRoute.path,
        userAddress,
        deadline,
      )
    } else {
      // PLS -> PLS (shouldn't happen, but just in case)
      throw new Error("Cannot swap PLS to PLS")
    }

    // Wait for transaction to be mined
    console.log("Swap transaction submitted:", swapTx.hash)
    const receipt = await swapTx.wait()
    console.log("Swap transaction confirmed:", receipt.hash)

    return {
      success: true,
      transactionHash: receipt.hash,
    }
  } catch (error) {
    console.error("Enhanced swap execution failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during swap",
    }
  }
}

/**
 * Approve a token for spending by the router
 */
async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: ethers.BigNumberish,
  signer: ethers.Signer,
): Promise<void> {
  try {
    const tokenAbi = [
      "function approve(address spender, uint256 amount) public returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ]

    // Create token contract with the signer directly, don't try to reconnect it
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer)
    const signerAddress = await signer.getAddress()

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signerAddress, spenderAddress)
    const parsedAmount = ethers.getBigInt(amount.toString())

    // If allowance is less than amount, approve
    if (currentAllowance < parsedAmount) {
      console.log(`Approving ${tokenAddress} for spending...`)
      const approveTx = await tokenContract.approve(spenderAddress, ethers.MaxUint256)
      await approveTx.wait()
      console.log(`Approved ${tokenAddress} for spending`)
    } else {
      console.log(`${tokenAddress} already approved for spending`)
    }
  } catch (error) {
    console.error(`Error approving token ${tokenAddress}:`, error)
    throw error
  }
}
