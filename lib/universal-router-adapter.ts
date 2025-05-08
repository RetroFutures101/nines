import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getProvider } from "./provider"
import { calculateMinOutputWithAdaptiveSlippage, calculateOptimalDeadline } from "./mev-protection"

// Router ABIs
const V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
]

const V3_ROUTER_ABI = [
  "function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)",
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
]

// Token ABI
const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]

// Router addresses
const V2_ROUTER_ADDRESS = "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47" // 9mm V2
const V3_ROUTER_ADDRESS = "0xf6076d61A0C46C944852F65838E1b12A2910a717" // 9mm V3

// WPLS address
const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"

export interface UniversalSwapParams {
  fromToken: Token
  toToken: Token
  amount: string
  slippage: number
  recipient: string
  path: string[]
  isV3?: boolean
  poolFees?: number[]
  splitPercentage?: number
}

/**
 * Universal Router Adapter
 * Handles both V2 and V3 swaps with a unified interface
 */
export class UniversalRouterAdapter {
  private provider: ethers.Provider

  constructor(provider?: ethers.Provider) {
    this.provider = provider || getProvider()
  }

  /**
   * Execute a swap using the appropriate router
   */
  async executeSwap(
    params: UniversalSwapParams,
    signer: ethers.Signer,
  ): Promise<{
    success: boolean
    transactionHash?: string
    error?: string
  }> {
    try {
      const { fromToken, toToken, amount, slippage, recipient, path, isV3, poolFees } = params

      // Parse amount
      const fromDecimals =
        typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
      const amountIn = ethers.parseUnits(amount, fromDecimals)

      // Get output amount (this would be from your quote service)
      // For this example, we'll use a dummy value
      const outputAmount = amountIn * ethers.BigInt(2) // Dummy value

      // Calculate minimum output amount with adaptive slippage
      const minOutputAmount = calculateMinOutputWithAdaptiveSlippage(outputAmount, slippage, path.length)

      // Calculate optimal deadline
      const deadline = calculateOptimalDeadline()

      // Check if we're dealing with native token (PLS)
      const isFromNative = fromToken.address === "NATIVE"
      const isToNative = toToken.address === "NATIVE"

      // Execute the swap based on the router type
      if (isV3 && poolFees) {
        return await this.executeV3Swap(
          fromToken,
          toToken,
          amountIn,
          minOutputAmount,
          path,
          poolFees,
          recipient,
          deadline,
          signer,
          isFromNative,
          isToNative,
        )
      } else {
        return await this.executeV2Swap(
          fromToken,
          toToken,
          amountIn,
          minOutputAmount,
          path,
          recipient,
          deadline,
          signer,
          isFromNative,
          isToNative,
        )
      }
    } catch (error) {
      console.error("Error executing swap:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during swap",
      }
    }
  }

  /**
   * Execute a V2 swap
   */
  private async executeV2Swap(
    fromToken: Token,
    toToken: Token,
    amountIn: bigint,
    minOutputAmount: bigint,
    path: string[],
    recipient: string,
    deadline: number,
    signer: ethers.Signer,
    isFromNative: boolean,
    isToNative: boolean,
  ): Promise<{
    success: boolean
    transactionHash?: string
    error?: string
  }> {
    try {
      // Create router contract
      const router = new ethers.Contract(V2_ROUTER_ADDRESS, V2_ROUTER_ABI, signer)

      // If from token is not native, we need to approve the router to spend our tokens
      if (!isFromNative) {
        await this.approveTokenIfNeeded(fromToken.address, V2_ROUTER_ADDRESS, amountIn, signer)
      }

      let tx

      // Execute the swap based on token types
      if (isFromNative && !isToNative) {
        // Swap PLS -> Token
        tx = await router.swapExactETHForTokens(minOutputAmount, path, recipient, deadline, { value: amountIn })
      } else if (!isFromNative && isToNative) {
        // Swap Token -> PLS
        tx = await router.swapExactTokensForETH(amountIn, minOutputAmount, path, recipient, deadline)
      } else if (isFromNative && isToNative) {
        // This shouldn't happen (PLS -> PLS), but handle it anyway
        throw new Error("Cannot swap native token to itself")
      } else {
        // Swap Token -> Token
        tx = await router.swapExactTokensForTokens(amountIn, minOutputAmount, path, recipient, deadline)
      }

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      return {
        success: true,
        transactionHash: receipt.hash,
      }
    } catch (error) {
      console.error("Error executing V2 swap:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during V2 swap",
      }
    }
  }

  /**
   * Execute a V3 swap
   */
  private async executeV3Swap(
    fromToken: Token,
    toToken: Token,
    amountIn: bigint,
    minOutputAmount: bigint,
    path: string[],
    poolFees: number[],
    recipient: string,
    deadline: number,
    signer: ethers.Signer,
    isFromNative: boolean,
    isToNative: boolean,
  ): Promise<{
    success: boolean
    transactionHash?: string
    error?: string
  }> {
    try {
      // Create router contract
      const router = new ethers.Contract(V3_ROUTER_ADDRESS, V3_ROUTER_ABI, signer)

      // If from token is not native, we need to approve the router to spend our tokens
      if (!isFromNative) {
        await this.approveTokenIfNeeded(fromToken.address, V3_ROUTER_ADDRESS, amountIn, signer)
      }

      let tx

      // For V3, we need to encode the path
      if (path.length === 2) {
        // Single hop
        const params = {
          tokenIn: isFromNative ? WPLS_ADDRESS : fromToken.address,
          tokenOut: isToNative ? WPLS_ADDRESS : toToken.address,
          fee: poolFees[0],
          recipient,
          deadline,
          amountIn,
          amountOutMinimum: minOutputAmount,
          sqrtPriceLimitX96: 0, // No price limit
        }

        // Execute the swap
        tx = await router.exactInputSingle(params, { value: isFromNative ? amountIn : 0 })
      } else {
        // Multi hop
        // Encode path for V3
        const encodedPath = this.encodePath(path, poolFees)

        const params = {
          path: encodedPath,
          recipient,
          deadline,
          amountIn,
          amountOutMinimum: minOutputAmount,
        }

        // Execute the swap
        tx = await router.exactInput(params, { value: isFromNative ? amountIn : 0 })
      }

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      return {
        success: true,
        transactionHash: receipt.hash,
      }
    } catch (error) {
      console.error("Error executing V3 swap:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during V3 swap",
      }
    }
  }

  /**
   * Approve token spending if needed
   */
  private async approveTokenIfNeeded(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    signer: ethers.Signer,
  ): Promise<void> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer)
      const signerAddress = await signer.getAddress()

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(signerAddress, spenderAddress)

      // If allowance is less than amount, approve
      if (currentAllowance < amount) {
        console.log(`Approving ${tokenAddress} for spending...`)
        const tx = await tokenContract.approve(spenderAddress, ethers.MaxUint256)
        await tx.wait()
        console.log(`Approved ${tokenAddress} for spending`)
      }
    } catch (error) {
      console.error(`Error approving token ${tokenAddress}:`, error)
      throw error
    }
  }

  /**
   * Encode path for V3 router
   */
  private encodePath(path: string[], fees: number[]): string {
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
}

// Export a singleton instance
export const universalRouter = new UniversalRouterAdapter()
