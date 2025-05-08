import { ethers } from "ethers"
import { getRpcUrl, getTestnetRpcUrl } from "./env-config"

/**
 * Verify if a contract exists at the given address on the blockchain
 * @param address The contract address to verify
 * @param isTestnet Whether to check on testnet or mainnet
 * @returns True if the contract exists, false otherwise
 */
export async function verifyContractExists(address: string, isTestnet = false): Promise<boolean> {
  try {
    // Skip verification for native token
    if (address === "NATIVE") return true

    // Create provider based on network - use hardcoded values from env-config.ts
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Get the code at the address
    const code = await provider.getCode(address)

    // If there's no code at the address, it's not a contract
    if (code === "0x" || code === "") {
      console.log(`No contract code found at address ${address}`)
      return false
    }

    // Verify it's an ERC20 token by checking for required methods
    try {
      const minimalABI = [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ]

      const contract = new ethers.Contract(address, minimalABI, provider)

      // Try to call basic ERC20 methods
      await Promise.all([contract.symbol(), contract.decimals()])

      // If we get here, the contract has the required ERC20 methods
      return true
    } catch (error) {
      console.error(`Contract at ${address} is not a valid ERC20 token:`, error)
      return false
    }
  } catch (error) {
    console.error(`Error verifying contract at ${address}:`, error)
    return false
  }
}

/**
 * Enhanced verification that checks if a token exists on the correct blockchain
 * @param address The token address to verify
 * @param isTestnet Whether to check on testnet or mainnet
 * @returns An object with success status and error message if applicable
 */
export async function verifyTokenOnCorrectChain(
  address: string,
  isTestnet = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip verification for native token
    if (address === "NATIVE") return { success: true }

    // Create provider based on network
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Step 1: Check if the contract exists on this chain
    const code = await provider.getCode(address)
    if (code === "0x" || code === "") {
      return {
        success: false,
        error: `Contract not found on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}. The token may exist on a different blockchain.`,
      }
    }

    // Step 2: Verify it's an ERC20 token
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

/**
 * Additional network-specific validation for tokens
 * @param address The token address to validate
 * @param isTestnet Whether to check on testnet or mainnet
 * @returns True if the token is valid for the network
 */
export async function validateTokenForNetwork(address: string, isTestnet = false): Promise<boolean> {
  try {
    // Skip validation for native token
    if (address === "NATIVE") return true

    // Create provider based on network
    const rpcUrl = isTestnet ? getTestnetRpcUrl() : getRpcUrl()
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Get the network to confirm we're on the right chain
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    // PulseChain Mainnet has chain ID 369, Testnet has chain ID 943
    const expectedChainId = isTestnet ? 943 : 369

    if (chainId !== expectedChainId) {
      console.error(`Connected to wrong network. Expected chain ID: ${expectedChainId}, got: ${chainId}`)
      return false
    }

    // If we're on the right network, check if the contract exists
    const code = await provider.getCode(address)
    return code !== "0x" && code !== ""
  } catch (error) {
    console.error(`Error validating token for network:`, error)
    return false
  }
}
