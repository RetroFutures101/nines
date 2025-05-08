import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get token logo URL
 * @param tokenAddress The token address
 * @returns The logo URL
 */
export function getTokenLogoUrl(tokenAddress: string): string {
  // For native token (PLS), use WPLS logo
  if (tokenAddress === "NATIVE") {
    // Use WPLS logo for PLS
    const wplsAddress = process.env.NEXT_PUBLIC_WPLS_ADDRESS || "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    return `https://tokens.app.pulsex.com/images/tokens/${wplsAddress}.png`
  }

  // Use direct PulseX URL with original capitalization
  return `https://tokens.app.pulsex.com/images/tokens/${tokenAddress}.png`
}
