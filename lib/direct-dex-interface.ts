import { ethers } from "ethers"
import { getRpcUrl } from "./env-config"
import type { Token } from "@/types/token"

// Router ABI - minimal version with just the functions we need
const RouterABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
]

// Token ABI for approvals
const TokenABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]

// 9mm Router addresses
const ROUTER_ADDRESSES = {
  V2: "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47", // 9mm V2 router
  V3: "0xf6076d61A0C46C944852F65838E1b12A2910a717", // 9mm V3 router
}

// Default router to use
const DEFAULT_ROUTER = ROUTER_ADDRESSES.V3

// Create a provider with ENS explicitly disabled
function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  // @ts-ignore - We're intentionally overriding a method
  provider.getResolver = async () => null
  return provider
}

export interface DirectSwapQuote {
  outputAmount: string
  outputAmountWei: bigint
  path: string[]
  routerAddress: string
  priceImpact: number
}

/**
 * Get a direct swap quote from the DEX router
 */
export async function getDirectSwapQuote(fromToken: Token, toToken: Token, amount: string): Promise<DirectSwapQuote> {
  try {
    const provider = createProvider(getRpcUrl())
    const router = new ethers.Contract(DEFAULT_ROUTER, RouterABI, provider)

    // Handle native token (PLS)
    const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    const fromAddress = fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address
    const toAddress = toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address

    // Parse amount
    const fromDecimals =
      typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
    const parsedAmount = ethers.parseUnits(amount, fromDecimals)

    // Get the path from the router
    // Note: In a real implementation, we might want to try different paths
    // but here we're letting the DEX handle the routing
    const path = [fromAddress, toAddress]

    // Get amounts out
    const amounts = await router.getAmountsOut(parsedAmount, path)
    const outputAmountWei = amounts[amounts.length - 1]

    // Format output amount
    const toDecimals = typeof toToken.decimals === "string" ? Number.parseInt(toToken.decimals) : toToken.decimals
    const outputAmount = ethers.formatUnits(outputAmountWei, toDecimals)

    // Calculate a simple price impact (this is just an estimate)
    // In reality, the DEX would calculate this more accurately
    const priceImpact = 0.3 // Default value, could be refined

    return {
      outputAmount,
      outputAmountWei,
      path,
      routerAddress: DEFAULT_ROUTER,
      priceImpact,
    }
  } catch (error) {
    console.error("Error getting direct swap quote:", error)
    throw error
  }
}

/**
 * Execute a swap directly through the DEX router
 */
export async function executeDirectSwap(
  fromToken: Token,
  toToken: Token,
  amount: string,
  minOutputAmount: string,
  userAddress: string,
  signer: ethers.Signer,
  deadline = Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // Connect to the router with the signer
    const router = new ethers.Contract(DEFAULT_ROUTER, RouterABI, signer)

    // Handle native token (PLS)
    const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    const fromAddress = fromToken.address === "NATIVE" ? WPLS_ADDRESS : fromToken.address
    const toAddress = toToken.address === "NATIVE" ? WPLS_ADDRESS : toToken.address

    // Parse amounts
    const fromDecimals =
      typeof fromToken.decimals === "string" ? Number.parseInt(fromToken.decimals) : fromToken.decimals
    const parsedAmount = ethers.parseUnits(amount, fromDecimals)
    const parsedMinOutput = ethers.getBigInt(minOutputAmount)

    // Set up the path
    const path = [fromAddress, toAddress]

    // Check if we need to approve tokens (skip for native token)
    if (fromToken.address !== "NATIVE") {
      await approveTokenIfNeeded(fromToken.address, DEFAULT_ROUTER, parsedAmount, userAddress, signer)
    }

    // Execute the swap based on token types
    let tx

    if (fromToken.address === "NATIVE" && toToken.address !== "NATIVE") {
      // Swap PLS -> Token
      tx = await router.swapExactETHForTokens(parsedMinOutput, path, userAddress, deadline, { value: parsedAmount })
    } else if (fromToken.address !== "NATIVE" && toToken.address === "NATIVE") {
      // Swap Token -> PLS
      tx = await router.swapExactTokensForETH(parsedAmount, parsedMinOutput, path, userAddress, deadline)
    } else if (fromToken.address !== "NATIVE" && toToken.address !== "NATIVE") {
      // Swap Token -> Token
      tx = await router.swapExactTokensForTokens(parsedAmount, parsedMinOutput, path, userAddress, deadline)
    } else {
      throw new Error("Cannot swap PLS to PLS")
    }

    // Wait for transaction to be mined
    const receipt = await tx.wait()

    return {
      success: true,
      transactionHash: receipt.hash,
    }
  } catch (error) {
    console.error("Error executing direct swap:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during swap",
    }
  }
}

/**
 * Approve token spending if needed
 */
async function approveTokenIfNeeded(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  ownerAddress: string,
  signer: ethers.Signer,
): Promise<void> {
  const tokenContract = new ethers.Contract(tokenAddress, TokenABI, signer)

  // Check current allowance
  const currentAllowance = await tokenContract.allowance(ownerAddress, spenderAddress)

  // If allowance is less than amount, approve
  if (currentAllowance < amount) {
    console.log(`Approving ${tokenAddress} for spending...`)
    const tx = await tokenContract.approve(spenderAddress, ethers.MaxUint256)
    await tx.wait()
    console.log(`Approved ${tokenAddress} for spending`)
  }
}
