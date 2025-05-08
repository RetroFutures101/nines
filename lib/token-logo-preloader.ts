import type { Token } from "@/types/token"

// Enable debug logging
const DEBUG = true

/**
 * Preload logos for all tokens in batches
 */
export async function preloadTokenLogos(tokens: Token[]): Promise<void> {
  if (DEBUG) console.log(`[Preloader] Starting to preload logos for ${tokens.length} tokens`)

  // Process in batches to avoid overwhelming the network
  const batchSize = 3
  const batches = Math.ceil(tokens.length / batchSize)

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize
    const end = Math.min(start + batchSize, tokens.length)
    const batch = tokens.slice(start, end)

    if (DEBUG) console.log(`[Preloader] Processing batch ${i + 1}/${batches} (${batch.length} tokens)`)

    // Process each batch in parallel
    await Promise.all(
      batch.map(async (token) => {
        try {
          if (DEBUG) console.log(`[Preloader] Preloading logo for ${token.symbol}: ${token.address}`)

          // For native token (PLS), use WPLS logo
          if (token.address === "NATIVE" || token.symbol === "PLS" || token.symbol === "tPLS") {
            // Use WPLS logo for PLS
            const wplsAddress = process.env.NEXT_PUBLIC_WPLS_ADDRESS || "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
            if (DEBUG) console.log(`[Preloader] Using WPLS logo for ${token.symbol}`)
            return `https://tokens.app.pulsex.com/images/tokens/${wplsAddress}.png`
          }

          // Use direct PulseX URL with original capitalization
          const logoUrl = `https://tokens.app.pulsex.com/images/tokens/${token.address}.png`
          if (DEBUG) console.log(`[Preloader] Preloaded logo for ${token.symbol}: ${logoUrl}`)
          return logoUrl
        } catch (error) {
          console.error(`[Preloader] Failed to preload logo for ${token.symbol}:`, error)
          return null
        }
      }),
    )

    // Small delay between batches to avoid rate limiting
    if (i < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  if (DEBUG) console.log(`[Preloader] Finished preloading token logos`)
}

/**
 * Preload a single token logo
 */
export async function preloadTokenLogo(token: Token): Promise<string | null> {
  try {
    if (DEBUG) console.log(`[Preloader] Preloading single logo for ${token.symbol}: ${token.address}`)

    // For native token (PLS), use WPLS logo
    if (token.address === "NATIVE" || token.symbol === "PLS" || token.symbol === "tPLS") {
      // Use WPLS logo for PLS
      const wplsAddress = process.env.NEXT_PUBLIC_WPLS_ADDRESS || "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
      if (DEBUG) console.log(`[Preloader] Using WPLS logo for ${token.symbol}`)
      return `https://tokens.app.pulsex.com/images/tokens/${wplsAddress}.png`
    }

    // Use direct PulseX URL with original capitalization
    const logoUrl = `https://tokens.app.pulsex.com/images/tokens/${token.address}.png`
    if (DEBUG) console.log(`[Preloader] Preloaded logo for ${token.symbol}: ${logoUrl}`)
    return logoUrl
  } catch (error) {
    console.error(`[Preloader] Failed to preload logo for ${token.symbol}:`, error)
    return null
  }
}
