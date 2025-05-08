/**
 * Simplified Token Logo Service
 * Uses only direct PulseX URLs for token logos
 */

// Base URL for PulseX token logos
export const PULSEX_LOGO_URL = "https://tokens.app.pulsex.com/images/tokens"

// Enable debug logging
const DEBUG = true

/**
 * Get the direct PulseX logo URL for a token
 * @param tokenAddress The token address
 * @param tokenSymbol Optional token symbol for special handling
 * @returns The direct PulseX logo URL
 */
export function getTokenLogoUrl(tokenAddress: string, tokenSymbol?: string): string {
  // For native token (PLS), use WPLS logo
  if (tokenAddress === "NATIVE" || tokenSymbol === "PLS" || tokenSymbol === "tPLS") {
    // Use WPLS logo for PLS
    const wplsAddress = process.env.NEXT_PUBLIC_WPLS_ADDRESS || "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    if (DEBUG) console.log(`[SimpleLogoService] Using WPLS logo for ${tokenSymbol || "PLS"}`)
    return `${PULSEX_LOGO_URL}/${wplsAddress}.png`
  }

  // Use direct PulseX URL with original capitalization
  if (DEBUG) console.log(`[SimpleLogoService] Using direct logo URL for ${tokenSymbol || tokenAddress}`)
  return `${PULSEX_LOGO_URL}/${tokenAddress}.png`
}
