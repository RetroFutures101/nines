import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getRpcUrl, getRouterAddress, getWplsAddress } from "./env-config"
import { getTestnetRpcUrl, getTestnetRouterAddress, getTestnetWplsAddress } from "./env-config"
import { SwapExecutor, type SwapExecutionResult } from "./swap-executor"

interface TokenInput {
  token: Token
  amount: string
}

export interface MultiSwapParams {
  inputTokens: TokenInput[]
  outputToken: Token
  minAmountOut: ethers.BigNumberish
  userAddress: string
  signer: ethers.Signer
  isTestnet?: boolean
}

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  // @ts-ignore - We're intentionally overriding a method
  provider.getResolver = async () => null
  return provider
}

export async function executeMultiSwap(params: MultiSwapParams): Promise<SwapExecutionResult> {
  const { inputTokens, outputToken, minAmountOut, userAddress, signer, isTestnet = false } = params

  try {
    console.log("Executing multi-swap with:", {
      inputTokens: inputTokens.map((i) => `${i.token.symbol}: ${i.amount}`),
      outputToken: outputToken.symbol,
      minAmountOut: minAmountOut.toString(),
      userAddress,
      isTestnet,
    })

    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const routerAddress = isTestnet ? getTestnetRouterAddress() : getRouterAddress()
    const wplsAddress = isTestnet ? getTestnetWplsAddress() : getWplsAddress()

    // Create provider with ENS disabled
    const provider = createProvider(rpcUrl)

    // Connect signer to provider
    const connectedSigner = signer.connect(provider)

    // In a real implementation, we would use the Odos router or a similar protocol
    // For this demo, we'll execute individual swaps for each input token

    // Create a swap executor
    const swapExecutor = new SwapExecutor()

    // Set deadline for all swaps
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now

    // Execute swaps for each input token
    const results: SwapExecutionResult[] = []

    for (const input of inputTokens) {
      // Skip tokens with zero amount
      if (ethers.getBigInt(input.amount) <= 0) continue

      // For testnet, simulate the swap
      if (isTestnet) {
        // Simulate a delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Add a simulated result
        results.push({
          success: true,
          transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        })

        continue
      }

      // For mainnet, execute the real swap
      // Calculate a portion of the minimum output amount for this input
      // This is a simplification - in a real implementation, we would use a more sophisticated approach
      const inputValueShare =
        Number(ethers.formatUnits(input.amount, input.token.decimals)) /
        inputTokens.reduce((sum, token) => sum + Number(ethers.formatUnits(token.amount, token.token.decimals)), 0)

      const thisMinAmountOut =
        (ethers.getBigInt(minAmountOut.toString()) * ethers.getBigInt(Math.floor(inputValueShare * 100))) /
        ethers.getBigInt(100)

      // Create path for this token to output token
      const path = [
        input.token.address === "NATIVE" ? wplsAddress : input.token.address,
        outputToken.address === "NATIVE" ? wplsAddress : outputToken.address,
      ]

      // If path elements are the same, skip this token (can't swap a token to itself)
      if (path[0].toLowerCase() === path[1].toLowerCase()) {
        continue
      }

      try {
        // Execute the swap for this input token
        const result = await swapExecutor.executeSwap(
          input.token,
          outputToken,
          input.amount,
          thisMinAmountOut,
          path,
          userAddress,
          connectedSigner,
          deadline,
        )

        results.push(result)

        // If any swap fails, stop and return the error
        if (!result.success) {
          return result
        }
      } catch (error) {
        console.error(`Error executing swap for ${input.token.symbol}:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred during swap",
        }
      }
    }

    // If we get here, all swaps were successful
    return {
      success: true,
      transactionHash: results.map((r) => r.transactionHash).join(", "),
    }
  } catch (error) {
    console.error("Error executing multi-swap:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during multi-swap",
    }
  }
}
