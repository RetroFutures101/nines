import { ethers } from "ethers"
import type { Token } from "@/types/token"

/**
 * Estimate gas for a swap transaction
 * @param fromToken The token to swap from
 * @param toToken The token to swap to
 * @param amount The amount to swap
 * @param slippage The slippage tolerance in percentage
 * @returns The estimated gas limit
 */
export async function estimateSwapGas(
  fromToken: Token,
  toToken: Token,
  amount: string,
  slippage: number,
): Promise<bigint> {
  try {
    // Ensure we have window.ethereum
    if (!window.ethereum) {
      throw new Error("MetaMask not detected")
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const userAddress = await signer.getAddress()

    // Router address and ABI
    const routerAddress = "0x165C3410fC91EF562C50559f7d2289fEbed552d9" // PulseX router
    const wplsAddress = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" // WPLS

    // Router ABI - minimal version with just the functions we need
    const routerAbi = [
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    ]

    // Create router contract instance
    const router = new ethers.Contract(routerAddress, routerAbi, signer)

    // Set deadline for all swaps
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now

    // Parse amount
    const decimals = typeof fromToken.decimals === "number" ? fromToken.decimals : Number(fromToken.decimals)
    const parsedAmount = ethers.parseUnits(amount, decimals)

    // Calculate minimum output amount with slippage
    const outputDecimals = typeof toToken.decimals === "number" ? toToken.decimals : Number(toToken.decimals)
    const inputValue = Number.parseFloat(amount) * (fromToken.price || 0.0001)
    const outputValue = inputValue / (toToken.price || 0.0001)
    const minOutputAmount = ethers.parseUnits(
      ((outputValue * (100 - slippage)) / 100).toFixed(outputDecimals),
      outputDecimals,
    )

    // Check if we're dealing with native token (PLS)
    const isFromNative = fromToken.address === "NATIVE"
    const isToNative = toToken.address === "NATIVE"

    // Create path for this token to output token
    const path = [isFromNative ? wplsAddress : fromToken.address, isToNative ? wplsAddress : toToken.address]

    // Estimate gas based on token types
    let gasEstimate: bigint

    if (isFromNative && !isToNative) {
      // Swap PLS -> Token
      gasEstimate = await router.swapExactETHForTokens.estimateGas(minOutputAmount, path, userAddress, deadline, {
        value: parsedAmount,
      })
    } else if (!isFromNative && isToNative) {
      // Swap Token -> PLS
      gasEstimate = await router.swapExactTokensForETH.estimateGas(
        parsedAmount,
        minOutputAmount,
        path,
        userAddress,
        deadline,
      )
    } else if (!isFromNative && !isToNative) {
      // Swap Token -> Token
      gasEstimate = await router.swapExactTokensForTokens.estimateGas(
        parsedAmount,
        minOutputAmount,
        path,
        userAddress,
        deadline,
      )
    } else {
      // PLS -> PLS (shouldn't happen, but just in case)
      return ethers.getBigInt(300000) // Default gas limit
    }

    // Add a buffer to the gas estimate
    return (gasEstimate * ethers.getBigInt(120)) / ethers.getBigInt(100) // 20% buffer
  } catch (error) {
    console.error("Error estimating gas:", error)
    return ethers.getBigInt(300000) // Default gas limit
  }
}

/**
 * Calculate the optimal slippage for a token based on its volatility and liquidity
 * @param token The token to calculate slippage for
 * @param amount The amount to swap
 * @param baseSlippage The base slippage tolerance in percentage
 * @returns The optimal slippage tolerance in percentage
 */
export function calculateOptimalSlippage(token: Token, amount: string, baseSlippage: number): number {
  // Default to the base slippage
  let optimalSlippage = baseSlippage

  // Adjust slippage based on token characteristics
  // This is a simplified implementation - in a real implementation, we would use more sophisticated logic

  // Known high-volatility tokens
  const highVolatilityTokens = ["HDRN", "HEX", "PLSX"]
  if (highVolatilityTokens.includes(token.symbol)) {
    optimalSlippage += 5 // Add 5% slippage for high-volatility tokens
  }

  // Adjust based on amount (larger amounts may need higher slippage)
  const amountValue = Number.parseFloat(amount) * (token.price || 0.0001)
  if (amountValue > 1000) {
    optimalSlippage += 2 // Add 2% slippage for large amounts
  } else if (amountValue > 100) {
    optimalSlippage += 1 // Add 1% slippage for medium amounts
  }

  // Cap slippage at a reasonable maximum
  return Math.min(optimalSlippage, 15) // Maximum 15% slippage
}
