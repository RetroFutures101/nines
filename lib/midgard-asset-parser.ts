/**
 * Helper utility to extract token information from Midgard assets
 * This service attempts to find token logos and info by analyzing Midgard's JS assets
 */

import { fetchWithCorsProxy } from "./cors-proxy"

// URLs to Midgard assets
const MIDGARD_JS_URL = "https://midgard.wtf/assets/index-DVSDJpig.js"
const MIDGARD_CSS_URL = "https://midgard.wtf/assets/index-wPTuYFPw.css"

// Enable debug logging
const DEBUG = true

// Cache for asset content to avoid repeated fetches
let jsAssetCache: string | null = null
let cssAssetCache: string | null = null

/**
 * Fetch and cache the Midgard JS asset
 */
async function getMidgardJsAsset(): Promise<string | null> {
  if (jsAssetCache) return jsAssetCache

  try {
    if (DEBUG) console.log(`[MidgardAssets] Fetching JS asset from ${MIDGARD_JS_URL}`)
    const response = await fetchWithCorsProxy(MIDGARD_JS_URL)

    if (!response.ok) {
      if (DEBUG) console.log(`[MidgardAssets] Failed to fetch JS asset: ${response.status}`)
      return null
    }

    jsAssetCache = await response.text()
    if (DEBUG) console.log(`[MidgardAssets] Successfully fetched JS asset (${jsAssetCache.length} bytes)`)
    return jsAssetCache
  } catch (error) {
    console.error(`[MidgardAssets] Error fetching JS asset:`, error)
    return null
  }
}

/**
 * Fetch and cache the Midgard CSS asset
 */
async function getMidgardCssAsset(): Promise<string | null> {
  if (cssAssetCache) return cssAssetCache

  try {
    if (DEBUG) console.log(`[MidgardAssets] Fetching CSS asset from ${MIDGARD_CSS_URL}`)
    const response = await fetchWithCorsProxy(MIDGARD_CSS_URL)

    if (!response.ok) {
      if (DEBUG) console.log(`[MidgardAssets] Failed to fetch CSS asset: ${response.status}`)
      return null
    }

    cssAssetCache = await response.text()
    if (DEBUG) console.log(`[MidgardAssets] Successfully fetched CSS asset (${cssAssetCache.length} bytes)`)
    return cssAssetCache
  } catch (error) {
    console.error(`[MidgardAssets] Error fetching CSS asset:`, error)
    return null
  }
}

/**
 * Extract token logos from Midgard JS asset
 */
export async function extractTokenLogosFromAssets(tokenAddress: string): Promise<string | null> {
  const normalizedAddress = tokenAddress.toLowerCase()

  try {
    // Fetch JS asset
    const jsAsset = await getMidgardJsAsset()
    if (!jsAsset) {
      return null
    }

    if (DEBUG) console.log(`[MidgardAssets] Searching for token address ${normalizedAddress} in JS asset`)

    // Look for direct references to the token address
    // Fix: Use RegExp constructor instead of literal to avoid flag issues
    const addressRegex = new RegExp(`["']${normalizedAddress}["']`, "i")
    if (!addressRegex.test(jsAsset)) {
      if (DEBUG) console.log(`[MidgardAssets] Token address not found in JS asset`)
      return null
    }

    // Try to find image paths associated with this token
    // Common patterns in JS files for token images
    // Fix: Use RegExp constructor instead of literal for all regex patterns
    const patterns = [
      // Pattern: tokenAddress: "imageUrl" or 'imageUrl'
      new RegExp(`["']${normalizedAddress}["']\\s*:\\s*["'](https?:\\/\\/[^"']+\\.(png|jpg|jpeg|svg))["']`, "i"),
      // Pattern: token logos as part of an array or object
      new RegExp(`["']${normalizedAddress}["'][^}]*?["']logoURI["']\\s*:\\s*["'](https?:\\/\\/[^"']+)["']`, "i"),
      // Pattern: image URLs in asset paths
      new RegExp(`["']${normalizedAddress}["'][^}]*?["']image["']\\s*:\\s*["'](https?:\\/\\/[^"']+)["']`, "i"),
      // Pattern: looking for logo pattern with token address
      new RegExp(`logo[^}]*?${normalizedAddress}[^}]*?(https?:\\/\\/[^"']+\\.(png|jpg|jpeg|svg))`, "i"),
    ]

    // Try each pattern
    for (const pattern of patterns) {
      const match = jsAsset.match(pattern)
      if (match && match[1]) {
        const logoUrl = match[1]
        if (DEBUG) console.log(`[MidgardAssets] Found logo URL in JS asset: ${logoUrl}`)
        return logoUrl
      }
    }

    // If no direct match found, try to find references to this token in the tokenList
    const tokenListMatch = jsAsset.match(/tokenList\s*=\s*(\[.+?\])/s)
    if (tokenListMatch && tokenListMatch[1]) {
      const tokenListText = tokenListMatch[1]
      // Look for this token address in the token list
      // Fix: Use RegExp constructor instead of literal
      const tokenRegex = new RegExp(`\\{[^}]*?["']address["']\\s*:\\s*["']${normalizedAddress}["'][^}]*?\\}`, "i")
      const tokenMatch = tokenListText.match(tokenRegex)

      if (tokenMatch && tokenMatch[0]) {
        // Extract logoURI from the token data
        const logoMatch = tokenMatch[0].match(/["']logoURI["']\s*:\s*["']([^"']+)["']/i)
        if (logoMatch && logoMatch[1]) {
          const logoUrl = logoMatch[1]
          if (DEBUG) console.log(`[MidgardAssets] Found logo URL in tokenList: ${logoUrl}`)
          return logoUrl
        }
      }
    }

    if (DEBUG) console.log(`[MidgardAssets] No logo URL found in JS asset`)
    return null
  } catch (error) {
    console.error(`[MidgardAssets] Error extracting token logos:`, error)
    return null
  }
}

/**
 * Find all token addresses and their information in the Midgard assets
 * This is useful for debugging and discovering available tokens
 */
export async function findAllTokensInAssets(): Promise<Record<string, any>[]> {
  try {
    const jsAsset = await getMidgardJsAsset()
    if (!jsAsset) return []

    const tokens: Record<string, any>[] = []

    // Try to find the tokenList array
    const tokenListMatch = jsAsset.match(/tokenList\s*=\s*(\[.+?\])/s)
    if (tokenListMatch && tokenListMatch[1]) {
      try {
        // Extract the token list and parse it
        let tokenListText = tokenListMatch[1]

        // Clean up the text to make it valid JSON
        // Replace single quotes with double quotes
        tokenListText = tokenListText.replace(/'/g, '"')
        // Remove trailing commas
        tokenListText = tokenListText.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]")

        // Try to parse it as JSON
        const tokenList = JSON.parse(tokenListText)
        if (Array.isArray(tokenList)) {
          return tokenList
        }
      } catch (parseError) {
        console.error(`[MidgardAssets] Error parsing token list:`, parseError)
      }
    }

    // Fallback: Try to find individual token definitions
    // Fix: Use RegExp constructor instead of literal for complex regex
    const tokenRegexPattern =
      "\\{\\s*address:\\s*[\"']([^\"']+)[\"']\\s*,\\s*name:\\s*[\"']([^\"']+)[\"']\\s*,\\s*symbol:\\s*[\"']([^\"']+)[\"']\\s*.*?\\}"
    const tokenRegex = new RegExp(tokenRegexPattern, "g")

    let match
    while ((match = tokenRegex.exec(jsAsset)) !== null) {
      tokens.push({
        address: match[1],
        name: match[2],
        symbol: match[3],
      })
    }

    return tokens
  } catch (error) {
    console.error(`[MidgardAssets] Error finding all tokens:`, error)
    return []
  }
}
