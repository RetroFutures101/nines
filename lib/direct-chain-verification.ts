import { ethers } from "ethers"

// Hardcoded RPC URLs for PulseChain
const PULSECHAIN_MAINNET_RPC = "https://rpc-pulsechain.g4mm4.io"
const PULSECHAIN_TESTNET_RPC = "https://rpc-testnet-pulsechain.g4mm4.io"

// Chain IDs for PulseChain
const PULSECHAIN_MAINNET_CHAIN_ID = 369
const PULSECHAIN_TESTNET_CHAIN_ID = 943

/**
 * Direct verification that a token exists on PulseChain
 * This function bypasses any environment variables and directly uses hardcoded values
 */
export async function directVerifyTokenOnPulseChain(
  address: string,
  isTestnet = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip verification for native token
    if (address === "NATIVE") return { success: true }

    // Use hardcoded RPC URL based on network
    const rpcUrl = isTestnet ? PULSECHAIN_TESTNET_RPC : PULSECHAIN_MAINNET_RPC
    const expectedChainId = isTestnet ? PULSECHAIN_TESTNET_CHAIN_ID : PULSECHAIN_MAINNET_CHAIN_ID

    // Create provider with the hardcoded RPC URL
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Verify we're on the correct chain
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    if (chainId !== expectedChainId) {
      return {
        success: false,
        error: `Connected to wrong network. Expected chain ID: ${expectedChainId}, got: ${chainId}`,
      }
    }

    // Check if the contract exists on this chain
    const code = await provider.getCode(address)
    if (code === "0x" || code === "") {
      return {
        success: false,
        error: `Contract not found on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}. The token may exist on a different blockchain.`,
      }
    }

    // Verify it's an ERC20 token
    const minimalABI = [
      "function balanceOf(address) view returns (uint256)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function name() view returns (string)",
    ]

    const contract = new ethers.Contract(address, minimalABI, provider)

    try {
      // Try to call multiple ERC20 methods to verify it's a valid token
      const [symbol, decimals, name] = await Promise.all([
        contract.symbol(),
        contract.decimals(),
        contract.name().catch(() => "Unknown Token"),
      ])

      console.log(`Verified token on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}: ${symbol} (${name})`)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Address exists but is not a valid ERC20 token on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}.`,
      }
    }
  } catch (error) {
    console.error(`Error verifying token on chain:`, error)
    return {
      success: false,
      error: `Failed to verify token. Please check the address and try again.`,
    }
  }
}
