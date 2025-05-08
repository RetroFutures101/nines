import { ethers } from "ethers"
import { TESTNET_FEATURED_TOKENS, NATIVE_TPLS, getTestnetRpcUrl } from "./testnet-constants"
import type { Token } from "@/types/token"
import ERC20ABI from "./abis/erc20.json"

// Default token logos for testnet
const TESTNET_DEFAULT_LOGOS: Record<string, string> = {
  tPLS: "/tpls-logo.svg",
  PLS: "/tpls-logo.svg",
}

// Token metadata fallbacks in case we can't fetch from the contract
const TESTNET_TOKEN_METADATA_FALLBACKS: Record<string, { name: string; decimals: number; symbol: string }> = {
  tPLS: { name: "Test PulseChain", decimals: 18, symbol: "tPLS" },
  WPLS: { name: "Wrapped Test PLS", decimals: 18, symbol: "WPLS" },
  PLSX: { name: "PulseX", decimals: 18, symbol: "PLSX" },
  HEX: { name: "HEX", decimals: 8, symbol: "HEX" },
}

// Get testnet token list with improved error handling
export async function getTestnetTokenList(): Promise<Token[]> {
  console.log("Getting testnet token list...")
  const tokens: Token[] = []

  try {
    // Add native tPLS token first with the special logo
    tokens.push({
      ...NATIVE_TPLS,
      logoURI: "https://s2.coinmarketcap.com/static/img/coins/64x64/11145.png", // Use the special PLS logo
      price: null,
      priceChange: null,
      balance: "0",
      isTestnet: true,
    })

    // Create token objects for each featured token
    for (const [symbol, address] of Object.entries(TESTNET_FEATURED_TOKENS)) {
      // Skip native token as it's already added
      if (address === "NATIVE" || symbol === "tPLS" || symbol === "PLS") continue

      try {
        console.log(`Adding testnet token: ${symbol} (${address})`)

        // Get logo URL - use direct PulseX URL with original capitalization
        const logoURI =
          symbol === "tPLS" || symbol === "PLS"
            ? "/tpls-logo.svg"
            : `https://tokens.app.pulsex.com/images/tokens/${address}.png`

        // Create token object with logo
        tokens.push({
          address, // Keep the original address with its capitalization
          symbol,
          name: TESTNET_TOKEN_METADATA_FALLBACKS[symbol]?.name || symbol,
          decimals: TESTNET_TOKEN_METADATA_FALLBACKS[symbol]?.decimals || 18,
          logoURI,
          price: null,
          priceChange: null,
          balance: "0",
          isTestnet: true,
        })
      } catch (error) {
        console.error(`Failed to load testnet token ${symbol}:`, error)
      }
    }

    console.log(`Loaded ${tokens.length} testnet tokens`)
    return tokens
  } catch (error) {
    console.error("Failed to load testnet tokens:", error)
    return tokens
  }
}

// Direct and simple implementation for getting testnet token balance
export async function getTestnetTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
  if (!userAddress || !tokenAddress) {
    return "0"
  }

  console.log(`Getting testnet balance for token ${tokenAddress} and address ${userAddress}`)

  try {
    // Handle native tPLS
    if (tokenAddress === "NATIVE") {
      const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())
      try {
        const balance = await provider.getBalance(userAddress)
        const formattedBalance = ethers.formatEther(balance)
        console.log(`Native tPLS balance: ${formattedBalance}`)
        return formattedBalance
      } catch (error) {
        console.error("Error getting native balance:", error)
        return "0"
      }
    }

    // For ERC20 tokens
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())
    const contract = new ethers.Contract(
      tokenAddress, // Use original capitalization
      ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
      provider,
    )

    // Get balance
    const balance = await contract.balanceOf(userAddress)

    // Get decimals
    let decimals = 18
    try {
      decimals = await contract.decimals()
    } catch (error) {
      console.log(`Using default decimals (18) for ${tokenAddress}`)
    }

    const formattedBalance = ethers.formatUnits(balance, decimals)
    console.log(`Token ${tokenAddress} balance: ${formattedBalance}`)
    return formattedBalance
  } catch (error) {
    console.error(`Failed to get testnet balance for token ${tokenAddress}:`, error)
    return "0"
  }
}

// Function to get native tPLS balance with improved error handling
export async function getNativeTplsBalance(address: string): Promise<string> {
  if (!address) return "0"

  console.log(`Getting native tPLS balance for ${address}`)

  try {
    // Create provider using the testnet RPC URL
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())
    const balance = await provider.getBalance(address)
    const formattedBalance = ethers.formatEther(balance)
    console.log(`Native tPLS balance: ${formattedBalance}`)
    return formattedBalance
  } catch (error) {
    console.error("Failed to get native tPLS balance:", error)
    return "0"
  }
}

// Function to get token details from the blockchain with improved error handling
export async function getTestnetTokenDetails(tokenAddress: string): Promise<{
  name: string
  symbol: string
  decimals: number
} | null> {
  if (!tokenAddress || tokenAddress === "NATIVE") return null

  console.log(`Getting testnet token details for ${tokenAddress}`)

  try {
    // Create provider using the testnet RPC URL
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())

    // Create contract instance
    const contract = new ethers.Contract(tokenAddress, ERC20ABI, provider)

    // Get token details
    const name = await contract.name().catch(() => "Unknown Token")
    const symbol = await contract.symbol().catch(() => "???")
    const decimals = await contract.decimals().catch(() => 18)

    // Ensure decimals is a number
    const decimalsNumber = typeof decimals === "number" ? decimals : Number(decimals)

    console.log(`Testnet token details: ${name} (${symbol}), decimals: ${decimalsNumber}`)
    return { name, symbol, decimals: decimalsNumber }
  } catch (error) {
    console.error(`Failed to get testnet token details for ${tokenAddress}:`, error)
    return null
  }
}
