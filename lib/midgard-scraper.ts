/**
 * Midgard Token Page Scraper
 * This service directly scrapes the Midgard token page to find token logos
 */

import { fetchWithCorsProxy } from "./cors-proxy"

// Base URL for Midgard
const MIDGARD_BASE_URL = "https://midgard.wtf"
const MIDGARD_TOKENS_URL = `${MIDGARD_BASE_URL}/tokens`
const MIDGARD_TOKEN_URL = `${MIDGARD_BASE_URL}/token`

// Enable debug logging
const DEBUG = true

/**
 * Scrape the Midgard token page for a specific token
 * @param tokenAddress The token address to search for
 * @returns The token logo URL if found, null otherwise
 */
export async function scrapeTokenLogo(tokenAddress: string): Promise<string | null> {
  try {
    if (!tokenAddress || tokenAddress === "NATIVE") {
      return null
    }

    const normalizedAddress = tokenAddress.toLowerCase()

    // First try the direct token page URL
    const tokenPageUrl = `${MIDGARD_TOKEN_URL}/${normalizedAddress}`

    if (DEBUG) console.log(`[MidgardScraper] Trying direct token page: ${tokenPageUrl}`)

    try {
      const response = await fetchWithCorsProxy(tokenPageUrl)

      if (response.ok) {
        const html = await response.text()

        // Look for the token logo in the HTML
        // The token logo is typically in an img tag with a specific class or pattern
        const logoMatch =
          html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'](?:[^"']*token-logo[^"']*)["']/i) ||
          html.match(/<img[^>]*class=["'](?:[^"']*token-logo[^"']*)["'][^>]*src=["']([^"']+)["']/i) ||
          html.match(/<img[^>]*src=["']([^"']+\/images\/tokens\/[^"']+)["']/i)

        if (logoMatch && logoMatch[1]) {
          const logoUrl = logoMatch[1].startsWith("http")
            ? logoMatch[1]
            : `${MIDGARD_BASE_URL}${logoMatch[1].startsWith("/") ? "" : "/"}${logoMatch[1]}`

          if (DEBUG) console.log(`[MidgardScraper] Found logo on token page: ${logoUrl}`)
          return logoUrl
        }
      }
    } catch (error) {
      if (DEBUG) console.error(`[MidgardScraper] Error fetching token page:`, error)
    }

    // If direct page fails, try the search page
    const searchUrl = `${MIDGARD_TOKENS_URL}?search=${normalizedAddress}`

    if (DEBUG) console.log(`[MidgardScraper] Trying search page: ${searchUrl}`)

    const searchResponse = await fetchWithCorsProxy(searchUrl)

    if (searchResponse.ok) {
      const html = await searchResponse.text()

      // Look for the token card that contains the address
      const addressPattern = new RegExp(
        `<div[^>]*class=["'][^"']*token-card[^"']*["'][^>]*data-address=["']${normalizedAddress}["'][^>]*>([\\s\\S]*?)<\\/div>`,
        "i",
      )
      const cardMatch = html.match(addressPattern)

      if (cardMatch && cardMatch[1]) {
        const cardHtml = cardMatch[1]
        const logoMatch = cardHtml.match(/<img[^>]*src=["']([^"']+)["']/i)

        if (logoMatch && logoMatch[1]) {
          const logoUrl = logoMatch[1].startsWith("http")
            ? logoMatch[1]
            : `${MIDGARD_BASE_URL}${logoMatch[1].startsWith("/") ? "" : "/"}${logoMatch[1]}`

          if (DEBUG) console.log(`[MidgardScraper] Found logo in search results: ${logoUrl}`)
          return logoUrl
        }
      }

      // If we can't find the exact card, look for any image associated with this address
      const imgNearAddressPattern = new RegExp(
        `<img[^>]*src=["']([^"']+)["'][^>]*>[\\s\\S]{0,100}${normalizedAddress}|${normalizedAddress}[\\s\\S]{0,100}<img[^>]*src=["']([^"']+)["']`,
        "i",
      )
      const imgMatch = html.match(imgNearAddressPattern)

      if (imgMatch) {
        const logoUrl = (imgMatch[1] || imgMatch[2]).startsWith("http")
          ? imgMatch[1] || imgMatch[2]
          : `${MIDGARD_BASE_URL}${(imgMatch[1] || imgMatch[2]).startsWith("/") ? "" : "/"}${imgMatch[1] || imgMatch[2]}`

        if (DEBUG) console.log(`[MidgardScraper] Found logo near address: ${logoUrl}`)
        return logoUrl
      }
    }

    if (DEBUG) console.log(`[MidgardScraper] No logo found for ${tokenAddress}`)
    return null
  } catch (error) {
    console.error(`[MidgardScraper] Error scraping token logo:`, error)
    return null
  }
}

/**
 * Get token information from Midgard
 * @param tokenAddress The token address to get information for
 * @returns The token information if found, null otherwise
 */
export async function scrapeTokenInfo(tokenAddress: string): Promise<{
  name: string
  symbol: string
  logoUrl: string | null
} | null> {
  try {
    if (!tokenAddress || tokenAddress === "NATIVE") {
      return null
    }

    const normalizedAddress = tokenAddress.toLowerCase()
    const tokenPageUrl = `${MIDGARD_TOKEN_URL}/${normalizedAddress}`

    if (DEBUG) console.log(`[MidgardScraper] Scraping token info from: ${tokenPageUrl}`)

    const response = await fetchWithCorsProxy(tokenPageUrl)

    if (response.ok) {
      const html = await response.text()

      // Extract token name
      const nameMatch =
        html.match(/<h1[^>]*class=["'][^"']*token-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title>(.*?)\s*\|\s*Midgard<\/title>/i)

      // Extract token symbol
      const symbolMatch =
        html.match(/<div[^>]*class=["'][^"']*token-symbol[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<span[^>]*class=["'][^"']*token-symbol[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)

      // Extract logo URL
      const logoMatch =
        html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'](?:[^"']*token-logo[^"']*)["']/i) ||
        html.match(/<img[^>]*class=["'](?:[^"']*token-logo[^"']*)["'][^>]*src=["']([^"']+)["']/i) ||
        html.match(/<img[^>]*src=["']([^"']+\/images\/tokens\/[^"']+)["']/i)

      const name = nameMatch ? nameMatch[1].trim() : ""
      const symbol = symbolMatch ? symbolMatch[1].trim() : ""
      const logoUrl = logoMatch
        ? logoMatch[1].startsWith("http")
          ? logoMatch[1]
          : `${MIDGARD_BASE_URL}${logoMatch[1].startsWith("/") ? "" : "/"}${logoMatch[1]}`
        : null

      if (DEBUG) {
        console.log(`[MidgardScraper] Token info:`, {
          name,
          symbol,
          logoUrl,
        })
      }

      return {
        name,
        symbol,
        logoUrl,
      }
    }

    return null
  } catch (error) {
    console.error(`[MidgardScraper] Error scraping token info:`, error)
    return null
  }
}
