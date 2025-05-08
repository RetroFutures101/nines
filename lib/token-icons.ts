/**
 * Token Icons Service
 * Provides token logos for the DEX interface
 */

// Enable debug logging
const DEBUG = true

// Base URLs for token logos
const PULSEX_LOGO_URL = "https://tokens.app.pulsex.com/images/tokens"
const MIDGARD_LOGO_URL = "https://raw.githubusercontent.com/piteasio/app-tokens/main/token-logo"

// Special token addresses that need custom handling
const SPECIAL_TOKENS: Record<string, string> = {
  // Common stablecoins
  "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07": "USDC", // USDC
  "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f": "USDT", // USDT
  "0xefD766cCb38EaF1dfd701853BFCe31359239F305": "DAI", // DAI
}

// Special token logos for tokens that need custom handling
const SPECIAL_TOKEN_LOGOS: Record<string, string> = {
  // Native PLS logo (different from WPLS)
  PLS: "https://s2.coinmarketcap.com/static/img/coins/64x64/11145.png",
  // Stablecoins
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  DAI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
}

/**
 * Get token logo URL with fallbacks
 * @param tokenAddress The token address
 * @param tokenSymbol Optional token symbol for special handling
 * @returns The logo URL
 */
export function getTokenLogoUrl(tokenAddress: string, tokenSymbol?: string): string {
  // For native token (PLS), use the special PLS logo
  if (tokenAddress === "NATIVE" || tokenSymbol === "PLS") {
    if (DEBUG) console.log(`[TokenIcons] Using special PLS logo for ${tokenSymbol || "PLS"}`)
    return SPECIAL_TOKEN_LOGOS.PLS
  }

  // For testnet PLS, use the special PLS logo too
  if (tokenSymbol === "tPLS") {
    if (DEBUG) console.log(`[TokenIcons] Using special PLS logo for tPLS`)
    return SPECIAL_TOKEN_LOGOS.PLS
  }

  // Check for special tokens that need custom handling
  const normalizedAddress = tokenAddress.toLowerCase()
  if (SPECIAL_TOKENS[normalizedAddress]) {
    const symbol = SPECIAL_TOKENS[normalizedAddress]
    if (SPECIAL_TOKEN_LOGOS[symbol]) {
      if (DEBUG) console.log(`[TokenIcons] Using special logo for ${symbol}`)
      return SPECIAL_TOKEN_LOGOS[symbol]
    }
  }

  // Use direct PulseX URL with original capitalization
  if (DEBUG) console.log(`[TokenIcons] Using direct logo URL for ${tokenSymbol || tokenAddress}`)
  return `${PULSEX_LOGO_URL}/${tokenAddress}.png`
}

/**
 * Get Midgard fallback logo URL
 * @param tokenAddress The token address
 * @returns The Midgard logo URL
 */
export function getMidgardLogoUrl(tokenAddress: string): string {
  if (tokenAddress === "NATIVE") {
    // For native token, use the special PLS logo
    return SPECIAL_TOKEN_LOGOS.PLS
  }

  // Check for special tokens that need custom handling
  const normalizedAddress = tokenAddress.toLowerCase()
  if (SPECIAL_TOKENS[normalizedAddress]) {
    const symbol = SPECIAL_TOKENS[normalizedAddress]
    if (SPECIAL_TOKEN_LOGOS[symbol]) {
      if (DEBUG) console.log(`[TokenIcons] Using special logo for ${symbol}`)
      return SPECIAL_TOKEN_LOGOS[symbol]
    }
  }

  // Use Midgard GitHub repository URL with original capitalization
  return `${MIDGARD_LOGO_URL}/${tokenAddress}.png`
}

/**
 * Check if an image URL exists
 * @param url The URL to check
 * @returns Promise that resolves to true if the image exists
 */
export async function checkImageExists(url: string): Promise<boolean> {
  // For special token logos, assume they exist
  if (Object.values(SPECIAL_TOKEN_LOGOS).includes(url)) {
    return true
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

/**
 * Get token logo URL with automatic fallback
 * Tries PulseX first, then Midgard, then falls back to a placeholder
 * @param token The token object or address
 * @returns Promise that resolves to the best available logo URL
 */
export async function getTokenLogoWithFallback(token: { address: string; symbol?: string } | string): Promise<string> {
  const tokenAddress = typeof token === "string" ? token : token.address
  const tokenSymbol = typeof token === "string" ? undefined : token.symbol

  // For native token (PLS), use the special PLS logo
  if (tokenAddress === "NATIVE" || tokenSymbol === "PLS" || tokenSymbol === "tPLS") {
    if (DEBUG) console.log(`[TokenIcons] Using special PLS logo for ${tokenSymbol || "PLS"}`)
    return SPECIAL_TOKEN_LOGOS.PLS
  }

  // Check for special tokens that need custom handling
  const normalizedAddress = tokenAddress.toLowerCase()
  if (SPECIAL_TOKENS[normalizedAddress] || (tokenSymbol && SPECIAL_TOKEN_LOGOS[tokenSymbol])) {
    const symbol = SPECIAL_TOKENS[normalizedAddress] || tokenSymbol
    if (symbol && SPECIAL_TOKEN_LOGOS[symbol]) {
      if (DEBUG) console.log(`[TokenIcons] Using special logo for ${symbol}`)
      return SPECIAL_TOKEN_LOGOS[symbol]
    }
  }

  // Try PulseX first
  const pulseXUrl = getTokenLogoUrl(tokenAddress, tokenSymbol)
  try {
    const pulseXExists = await checkImageExists(pulseXUrl)
    if (pulseXExists) {
      if (DEBUG) console.log(`[TokenIcons] Found logo at PulseX: ${pulseXUrl}`)
      return pulseXUrl
    }
  } catch (error) {
    if (DEBUG) console.error(`[TokenIcons] Error checking PulseX logo:`, error)
  }

  // Try Midgard as fallback
  const midgardUrl = getMidgardLogoUrl(tokenAddress)
  try {
    const midgardExists = await checkImageExists(midgardUrl)
    if (midgardExists) {
      if (DEBUG) console.log(`[TokenIcons] Found logo at Midgard: ${midgardUrl}`)
      return midgardUrl
    }
  } catch (error) {
    if (DEBUG) console.error(`[TokenIcons] Error checking Midgard logo:`, error)
  }

  // Fall back to placeholder
  if (DEBUG) console.log(`[TokenIcons] No logo found, using placeholder for ${tokenSymbol || tokenAddress}`)
  return `/placeholder.svg?text=${tokenSymbol || tokenAddress.substring(0, 4)}`
}

/**
 * Asynchronously get token logo URL
 * @param token The token object
 * @returns The logo URL
 */
export async function getTokenLogoAsync(token: {
  address: string
  symbol: string
  logoURI?: string | null
}): Promise<string> {
  // If token already has a logo, use it
  if (token.logoURI) return token.logoURI

  // Use the fallback mechanism
  return getTokenLogoWithFallback(token)
}

// Export the special token mappings
export { SPECIAL_TOKENS, SPECIAL_TOKEN_LOGOS }
