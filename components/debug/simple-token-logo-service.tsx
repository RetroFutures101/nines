"use client"

/**
 * Simple Token Logo Service
 * This service fetches token logos from PulseX and other reliable sources
 */

// Enable debug logging
const DEBUG = true

// Base URLs for token logos - PulseX is now the primary source
const PULSEX_LOGO_URL = "https://tokens.app.pulsex.com/images/tokens"

/**
 * Direct function to get PulseX logo URL
 * @param tokenAddress The token address
 * @returns The PulseX logo URL
 */
export function getPulseXLogoUrl(tokenAddress: string): string {
  if (tokenAddress === "NATIVE") {
    return "/tpls-logo.svg"
  }
  return `${PULSEX_LOGO_URL}/${tokenAddress.toLowerCase()}.png`
}
