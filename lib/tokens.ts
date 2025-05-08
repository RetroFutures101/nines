import { ethers } from "ethers"
import { FEATURED_TOKENS, getRpcUrl, NATIVE_PLS } from "./constants"
import type { Token } from "@/types/token"
import ERC20ABI from "./abis/erc20.json"
import { getTokenPrice, getTokenPriceChange } from "./price-service"

// Default token logos - using direct PulseX URLs
const DEFAULT_LOGOS: Record<string, string> = {
  PLS: "/tpls-logo.svg", // Add PLS logo
}

// Token metadata fallbacks in case we can't fetch from the contract
const TOKEN_METADATA_FALLBACKS: Record<string, { name: string; decimals: number }> = {
  PLS: { name: "PulseChain", decimals: 18 }, // Add PLS metadata
  PXDC: { name: "PulseX Decentralized Currency", decimals: 18 },
  PLSX: { name: "PulseX", decimals: 18 },
  HEXDC: { name: "HEX Decentralized Currency", decimals: 8 },
  HEX: { name: "HEX", decimals: 8 },
  INCD: { name: "Inception Decentralized Currency", decimals: 18 },
  INC: { name: "Inception", decimals: 18 },
  DAI: { name: "Dai Stablecoin", decimals: 18 },
  USDC: { name: "USD Coin", decimals: 6 },
  USDT: { name: "Tether USD", decimals: 6 },
  USDL: { name: "USD Liquidity", decimals: 18 },
  WPLS: { name: "Wrapped Pulse", decimals: 18 },
  EARN: { name: "Earn", decimals: 18 },
  FLEX: { name: "Flex", decimals: 18 },
  LOAN: { name: "Loan", decimals: 18 },
  PRINT: { name: "Print", decimals: 18 },
  WATT: { name: "Watt", decimals: 18 },
}

// Update the getTokenList function to ensure we're using the correct capitalization
export async function getTokenList(): Promise<Token[]> {
  // Create provider using ethers v6 syntax and the current RPC URL
  const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
    ensAddress: null, // Disable ENS lookup
  })
  const tokens: Token[] = []

  // Add native PLS token first with the special logo
  tokens.push({
    ...NATIVE_PLS,
    logoURI: "https://s2.coinmarketcap.com/static/img/coins/64x64/11145.png", // Use the special PLS logo
    price: null, // Will be fetched later
    priceChange: null,
    balance: "0",
  })

  // Create token objects for each featured token
  for (const [symbol, address] of Object.entries(FEATURED_TOKENS)) {
    // Skip native token as it's already added
    if (address === "NATIVE" || symbol === "PLS") continue

    try {
      const contract = new ethers.Contract(address, ERC20ABI, provider)

      // Get token details with fallbacks
      let name: string
      let decimals: number

      try {
        name = await contract.name()
      } catch (error) {
        console.warn(`Failed to get name for ${symbol}, using fallback`, error)
        name = TOKEN_METADATA_FALLBACKS[symbol]?.name || symbol
      }

      try {
        decimals = await contract.decimals()
      } catch (error) {
        console.warn(`Failed to get decimals for ${symbol}, using fallback`, error)
        decimals = TOKEN_METADATA_FALLBACKS[symbol]?.decimals || 18
      }

      // Get token price and price change
      let price = null
      let priceChange = null

      try {
        // Special case for WPLS - we'll use this price for PLS too
        if (symbol === "WPLS") {
          price = await getTokenPrice(address, symbol)

          // Update PLS price to match WPLS
          if (price !== null && tokens.length > 0 && tokens[0].address === "NATIVE") {
            tokens[0].price = price
          }
        } else {
          price = await getTokenPrice(address, symbol)
        }
      } catch (priceError) {
        console.warn(`Failed to get price for ${symbol}:`, priceError)
      }

      try {
        priceChange = await getTokenPriceChange(address)
      } catch (priceChangeError) {
        console.warn(`Failed to get price change for ${symbol}:`, priceChangeError)
      }

      // Create token object with logo
      // Use the original address with its capitalization for the logo URL
      const logoURI =
        symbol === "PLS" ? DEFAULT_LOGOS.PLS : `https://tokens.app.pulsex.com/images/tokens/${address}.png`

      tokens.push({
        address, // Keep the original address with its capitalization
        symbol,
        name,
        decimals,
        logoURI,
        price,
        priceChange,
      })
    } catch (error) {
      console.error(`Failed to load token ${symbol}:`, error)

      // Add token with fallback values
      if (TOKEN_METADATA_FALLBACKS[symbol]) {
        const logoURI =
          symbol === "PLS" ? DEFAULT_LOGOS.PLS : `https://tokens.app.pulsex.com/images/tokens/${address}.png`

        tokens.push({
          address, // Keep the original address with its capitalization
          symbol,
          name: TOKEN_METADATA_FALLBACKS[symbol].name,
          decimals: TOKEN_METADATA_FALLBACKS[symbol].decimals,
          logoURI,
          price: null,
          priceChange: null,
        })
      }
    }
  }

  return tokens
}

// Update the getTokenBalance function to add more logging and error handling
export async function getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
  if (!userAddress || !tokenAddress) {
    console.log("Missing address parameters for getTokenBalance")
    return "0"
  }

  console.log(`Getting mainnet balance for token ${tokenAddress} and address ${userAddress}`)

  try {
    // Handle native PLS
    if (tokenAddress === "NATIVE") {
      const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
        ensAddress: null, // Disable ENS lookup
      })

      try {
        console.log("Fetching native PLS balance")
        const balance = await provider.getBalance(userAddress)
        const formattedBalance = ethers.formatEther(balance)
        console.log(`Native PLS balance: ${formattedBalance}`)
        return formattedBalance
      } catch (nativeError) {
        console.error("Error getting native PLS balance:", nativeError)
        return "0"
      }
    }

    // Create provider using ethers v6 syntax and the current RPC URL
    const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, {
      ensAddress: null, // Disable ENS lookup
    })

    // Normalize addresses to checksum format
    try {
      const normalizedTokenAddress = ethers.getAddress(tokenAddress)
      const normalizedUserAddress = ethers.getAddress(userAddress)

      console.log(`Normalized addresses: token=${normalizedTokenAddress}, user=${normalizedUserAddress}`)

      // Find the symbol for this address to use fallback if needed
      const symbol = Object.entries(FEATURED_TOKENS).find(
        ([_, addr]) => addr.toLowerCase() === normalizedTokenAddress.toLowerCase(),
      )?.[0]

      // Get decimals from fallback if available
      const fallbackDecimals = symbol ? TOKEN_METADATA_FALLBACKS[symbol]?.decimals || 18 : 18

      // Simplified ABI with just the functions we need
      const minimalABI = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
      ]

      try {
        const contract = new ethers.Contract(normalizedTokenAddress, minimalABI, provider)

        // Try to get balance with error handling
        let balance
        try {
          console.log(`Calling balanceOf for ${normalizedTokenAddress}`)
          balance = await contract.balanceOf(normalizedUserAddress)
          console.log(`Raw balance result: ${balance.toString()}`)
        } catch (balanceError) {
          console.error(`Failed to get balance for token ${normalizedTokenAddress}:`, balanceError)
          return "0"
        }

        // Try to get decimals with fallback
        let decimals
        try {
          decimals = await contract.decimals()
          console.log(`Decimals for ${normalizedTokenAddress}: ${decimals}`)
        } catch (decimalsError) {
          console.error(`Failed to get decimals for token ${normalizedTokenAddress}, using fallback:`, decimalsError)
          decimals = fallbackDecimals
        }

        const formattedBalance = ethers.formatUnits(balance, decimals)
        console.log(`Formatted balance for ${normalizedTokenAddress}: ${formattedBalance}`)
        return formattedBalance
      } catch (contractError) {
        console.error(`Failed to create contract for token ${normalizedTokenAddress}:`, contractError)
        return "0"
      }
    } catch (addressError) {
      console.error(`Invalid address format: ${tokenAddress} or ${userAddress}`, addressError)
      return "0"
    }
  } catch (error) {
    console.error(`Failed to get token balance for ${tokenAddress}:`, error)
    return "0"
  }
}

import { getWplsAddress as getEnvWplsAddress } from "./env-config"

// WPLS address for price calculations - using environment variable with fallback
export const getWplsAddress = getEnvWplsAddress
