import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getRpcUrl, getRouterAddress, getWplsAddress } from "./env-config"
import { getTestnetRpcUrl } from "./env-config"

interface TokenInput {
  token: Token
  amount: string
}

export interface EnhancedMultiSwapParams {
  inputTokens: TokenInput[]
  outputToken: Token
  minAmountOut: string
  userAddress: string
  slippage: number
  deadline: number
  isTestnet?: boolean
}

export interface SwapExecutionResult {
  success: boolean
  transactionHash?: string
  error?: string
}

/**
 * Enhanced Multi-Swap Executor based on denliehoo/multi-swap approach
 * This executor batches multiple swaps into a single transaction where possible
 */
export class EnhancedMultiSwapExecutor {
  private async getProvider(isTestnet: boolean): Promise<ethers.JsonRpcProvider> {
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    // Disable ENS to avoid issues
    // @ts-ignore - We're intentionally overriding a method
    provider.getResolver = async () => null
    return provider
  }

  /**
   * Execute a multi-swap transaction
   */
  public async executeMultiSwap(params: EnhancedMultiSwapParams): Promise<SwapExecutionResult> {
    const { inputTokens, outputToken, minAmountOut, userAddress, slippage, deadline, isTestnet = false } = params

    try {
      console.log("Executing enhanced multi-swap with:", {
        inputTokens: inputTokens.map((i) => `${i.token.symbol}: ${i.amount}`),
        outputToken: outputToken.symbol,
        minAmountOut,
        userAddress,
        slippage,
        isTestnet,
      })

      // For testnet, simulate the swap
      if (isTestnet) {
        return await this.simulateTestnetSwap(inputTokens, outputToken, userAddress)
      }

      // For mainnet, execute the real swap
      return await this.executeMainnetSwap(inputTokens, outputToken, minAmountOut, userAddress, slippage, deadline)
    } catch (error) {
      console.error("Enhanced multi-swap execution failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during multi-swap",
      }
    }
  }

  /**
   * Simulate a testnet swap (for testing purposes)
   */
  private async simulateTestnetSwap(
    inputTokens: TokenInput[],
    outputToken: Token,
    userAddress: string,
  ): Promise<SwapExecutionResult> {
    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Return a simulated successful result
    return {
      success: true,
      transactionHash: `0x${Math.random().toString(16).substring(2)}`,
    }
  }

  /**
   * Execute a real mainnet swap
   */
  private async executeMainnetSwap(
    inputTokens: TokenInput[],
    outputToken: Token,
    minAmountOut: string,
    userAddress: string,
    slippage: number,
    deadline: number,
  ): Promise<SwapExecutionResult> {
    try {
      // Ensure we have window.ethereum
      if (!window.ethereum) {
        throw new Error("MetaMask not detected")
      }

      // Force request accounts to ensure MetaMask is connected
      console.log("Requesting accounts from MetaMask...")
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      })
      console.log("Accounts received:", accounts)

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available. Please unlock your MetaMask wallet.")
      }

      // Create provider with explicit connection
      const provider = new ethers.BrowserProvider(window.ethereum, "any")
      await provider.send("eth_chainId", []) // Force connection
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      console.log("Using signer with address:", signerAddress)

      // Get router and WPLS addresses
      const routerAddress = getRouterAddress()
      const wplsAddress = getWplsAddress()

      // Filter valid inputs
      const validInputs = inputTokens.filter(
        (input) => input.token && input.amount && Number.parseFloat(input.amount) > 0,
      )

      if (validInputs.length === 0) {
        throw new Error("No valid input tokens")
      }

      // If we only have one input token, use the standard swap approach
      if (validInputs.length === 1) {
        return await this.executeSingleTokenSwap(
          validInputs[0],
          outputToken,
          minAmountOut,
          signerAddress,
          slippage,
          deadline,
          signer,
          routerAddress,
          wplsAddress,
        )
      }

      // For multiple tokens, use the batched approach
      return await this.executeBatchedMultiTokenSwap(
        validInputs,
        outputToken,
        minAmountOut,
        signerAddress,
        slippage,
        deadline,
        signer,
        routerAddress,
        wplsAddress,
      )
    } catch (error) {
      console.error("Mainnet multi-swap execution failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during multi-swap",
      }
    }
  }

  /**
   * Execute a swap with a single input token
   */
  private async executeSingleTokenSwap(
    input: TokenInput,
    outputToken: Token,
    minAmountOut: string,
    userAddress: string,
    slippage: number,
    deadline: number,
    signer: ethers.Signer,
    routerAddress: string,
    wplsAddress: string,
  ): Promise<SwapExecutionResult> {
    try {
      // Router ABI - minimal version with just the functions we need
      const routerAbi = [
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      ]

      // Create router contract instance - use the signer directly, don't try to reconnect it
      const router = new ethers.Contract(routerAddress, routerAbi, signer)

      // Check if we're dealing with native token (PLS)
      const isFromNative = input.token.address === "NATIVE"
      const isToNative = outputToken.address === "NATIVE"

      // Parse amount
      const decimals = typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
      const parsedAmount = ethers.parseUnits(input.amount, decimals)

      // Calculate minimum output amount with slippage
      const parsedMinAmountOut = ethers.getBigInt(minAmountOut)

      // Create path for this token to output token
      const path = [isFromNative ? wplsAddress : input.token.address, isToNative ? wplsAddress : outputToken.address]

      // If path elements are the same, throw error
      if (path[0].toLowerCase() === path[1].toLowerCase()) {
        throw new Error("Cannot swap a token to itself")
      }

      // Approve token if needed (skip for native token)
      if (!isFromNative) {
        await this.approveToken(input.token.address, routerAddress, parsedAmount, signer)
      }

      // Execute the swap based on token types
      let swapTx

      if (isFromNative && !isToNative) {
        // Swap PLS -> Token
        swapTx = await router.swapExactETHForTokens(parsedMinAmountOut, path, userAddress, deadline, {
          value: parsedAmount,
        })
      } else if (!isFromNative && isToNative) {
        // Swap Token -> PLS
        swapTx = await router.swapExactTokensForETH(parsedAmount, parsedMinAmountOut, path, userAddress, deadline)
      } else if (!isFromNative && !isToNative) {
        // Swap Token -> Token
        swapTx = await router.swapExactTokensForTokens(parsedAmount, parsedMinAmountOut, path, userAddress, deadline)
      } else {
        // PLS -> PLS (shouldn't happen, but just in case)
        throw new Error("Cannot swap PLS to PLS")
      }

      // Wait for transaction to be mined
      const receipt = await swapTx.wait()

      return {
        success: true,
        transactionHash: receipt.hash,
      }
    } catch (error) {
      console.error("Single token swap failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during single token swap",
      }
    }
  }

  /**
   * Execute a batched multi-token swap
   * This approach is based on the denliehoo/multi-swap repository
   */
  private async executeBatchedMultiTokenSwap(
    inputs: TokenInput[],
    outputToken: Token,
    minAmountOut: string,
    userAddress: string,
    slippage: number,
    deadline: number,
    signer: ethers.Signer,
    routerAddress: string,
    wplsAddress: string,
  ): Promise<SwapExecutionResult> {
    try {
      // Group inputs by type (native and non-native)
      const nativeInputs = inputs.filter((input) => input.token.address === "NATIVE")
      const tokenInputs = inputs.filter((input) => input.token.address !== "NATIVE")

      // Calculate total native value
      let totalNativeValue = ethers.getBigInt(0)
      for (const input of nativeInputs) {
        const decimals = typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
        const parsedAmount = ethers.parseUnits(input.amount, decimals)
        totalNativeValue += parsedAmount
      }

      // Approve all token inputs
      for (const input of tokenInputs) {
        const decimals = typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
        const parsedAmount = ethers.parseUnits(input.amount, decimals)
        await this.approveToken(input.token.address, routerAddress, parsedAmount, signer)
      }

      // Create a multicall contract to batch all swaps
      // This is a simplified version - in a real implementation, we would use a proper multicall contract
      // For now, we'll execute swaps sequentially

      // Router ABI - minimal version with just the functions we need
      const routerAbi = [
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      ]

      // Create router contract instance - use the signer directly, don't try to reconnect it
      const router = new ethers.Contract(routerAddress, routerAbi, signer)

      // Execute swaps sequentially
      const txHashes = []

      // First, handle native token inputs if any
      if (nativeInputs.length > 0) {
        for (const input of nativeInputs) {
          const decimals =
            typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
          const parsedAmount = ethers.parseUnits(input.amount, decimals)

          // Calculate this input's share of the minimum output
          const inputShare = Number(input.amount) / inputs.reduce((sum, i) => sum + Number(i.amount), 0)
          const thisMinAmountOut =
            (ethers.getBigInt(minAmountOut) * ethers.getBigInt(Math.floor(inputShare * 100))) / ethers.getBigInt(100)

          // Create path
          const path = [wplsAddress, outputToken.address === "NATIVE" ? wplsAddress : outputToken.address]

          // Execute swap
          const swapTx = await router.swapExactETHForTokens(thisMinAmountOut, path, userAddress, deadline, {
            value: parsedAmount,
          })

          const receipt = await swapTx.wait()
          txHashes.push(receipt.hash)
        }
      }

      // Then, handle token inputs
      if (tokenInputs.length > 0) {
        for (const input of tokenInputs) {
          const decimals =
            typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
          const parsedAmount = ethers.parseUnits(input.amount, decimals)

          // Calculate this input's share of the minimum output
          const inputShare = Number(input.amount) / inputs.reduce((sum, i) => sum + Number(i.amount), 0)
          const thisMinAmountOut =
            (ethers.getBigInt(minAmountOut) * ethers.getBigInt(Math.floor(inputShare * 100))) / ethers.getBigInt(100)

          // Create path
          const path = [input.token.address, outputToken.address === "NATIVE" ? wplsAddress : outputToken.address]

          // Execute swap based on output token type
          let swapTx

          if (outputToken.address === "NATIVE") {
            swapTx = await router.swapExactTokensForETH(parsedAmount, thisMinAmountOut, path, userAddress, deadline)
          } else {
            swapTx = await router.swapExactTokensForTokens(parsedAmount, thisMinAmountOut, path, userAddress, deadline)
          }

          const receipt = await swapTx.wait()
          txHashes.push(receipt.hash)
        }
      }

      return {
        success: true,
        transactionHash: txHashes.join(", "),
      }
    } catch (error) {
      console.error("Batched multi-token swap failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during batched multi-token swap",
      }
    }
  }

  /**
   * Approve a token for spending by the router
   */
  private async approveToken(
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
}
