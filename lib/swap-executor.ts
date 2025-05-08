import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getRpcUrl, getRouterAddress, getWplsAddress } from "./env-config"
import routerAbi from "./abis/router.json"
import erc20Abi from "./abis/erc20.json"

export interface SwapExecutionResult {
  success: boolean
  transactionHash?: string
  error?: string
}

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  // Create a basic provider with no network specification
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  // Explicitly disable ENS by overriding the getResolver method
  // @ts-ignore - We're intentionally overriding a method
  provider.getResolver = async () => null

  return provider
}

export class SwapExecutor {
  private provider: ethers.JsonRpcProvider
  private router: ethers.Contract
  private routerAddress: string
  private wplsAddress: string

  constructor() {
    const rpcUrl = getRpcUrl()
    this.routerAddress = getRouterAddress()
    this.wplsAddress = getWplsAddress()

    // Create provider with ENS disabled
    this.provider = createProvider(rpcUrl)

    this.router = new ethers.Contract(this.routerAddress, routerAbi, this.provider)
  }

  async executeSwap(
    fromToken: Token,
    toToken: Token,
    amount: string,
    minAmountOut: bigint,
    path: string[],
    walletAddress: string,
    signer: ethers.Signer,
    deadline: number = Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
  ): Promise<SwapExecutionResult> {
    try {
      // Connect signer to provider
      const connectedSigner = signer.connect(this.provider)

      // Create router contract instance with signer
      const routerWithSigner = this.router.connect(connectedSigner)

      // Parse amount to wei
      const amountIn = ethers.parseUnits(amount, fromToken.decimals)

      // Check if we're dealing with native token (PLS)
      const isFromNative = fromToken.address === "NATIVE"
      const isToNative = toToken.address === "NATIVE"

      // If from token is not native, we need to approve the router to spend our tokens
      if (!isFromNative) {
        const tokenContract = new ethers.Contract(fromToken.address, erc20Abi, connectedSigner)

        // Check current allowance
        const currentAllowance = await tokenContract.allowance(walletAddress, this.routerAddress)

        // If allowance is less than amount, approve
        if (currentAllowance < amountIn) {
          console.log("Approving token spend...")
          const approveTx = await tokenContract.approve(this.routerAddress, ethers.MaxUint256)
          await approveTx.wait()
          console.log("Approval confirmed")
        }
      }

      let tx

      // Execute the swap based on token types
      if (isFromNative && !isToNative) {
        // Swap PLS -> Token
        tx = await routerWithSigner.swapExactETHForTokens(
          minAmountOut,
          [this.wplsAddress, toToken.address],
          walletAddress,
          deadline,
          { value: amountIn },
        )
      } else if (!isFromNative && isToNative) {
        // Swap Token -> PLS
        tx = await routerWithSigner.swapExactTokensForETH(
          amountIn,
          minAmountOut,
          [fromToken.address, this.wplsAddress],
          walletAddress,
          deadline,
        )
      } else if (isFromNative && isToNative) {
        // This shouldn't happen (PLS -> PLS), but handle it anyway
        throw new Error("Cannot swap native token to itself")
      } else {
        // Swap Token -> Token
        tx = await routerWithSigner.swapExactTokensForTokens(amountIn, minAmountOut, path, walletAddress, deadline)
      }

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      return {
        success: true,
        transactionHash: receipt.hash,
      }
    } catch (error) {
      console.error("Error executing swap:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during swap",
      }
    }
  }

  async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> {
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path)
      return amounts
    } catch (error) {
      console.error("Error getting amounts out:", error)
      throw error
    }
  }
}
