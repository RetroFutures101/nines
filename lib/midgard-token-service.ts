/**
 * Service for fetching token data from Midgard block explorer
 */
import { fetchWithCorsProxy, checkImageExists } from "./cors-proxy"
import { extractTokenLogosFromAssets } from "./midgard-asset-parser"

// Base URL for Midgard API
const MIDGARD_API_BASE_URL = "https://midgard.wtf/api"

// URL pattern for token logos
const MIDGARD_TOKEN_LOGO_URL = "https://midgard.wtf/images/tokens"

// Enable debug logging
const DEBUG = true

// Use CORS proxy for requests
const USE_CORS_PROXY = true

/**
 * Fetch token logo URL from Midgard
 * @param tokenAddress The token contract address
 * @returns The URL to the token logo or null if not found
 */
export async function fetchTokenLogoFromMidgard(tokenAddress: string): Promise<string | null> {
  try {
    // Skip for native token
    if (tokenAddress === "NATIVE") {
      if (DEBUG) console.log(`[Midgard] Skipping native token`)
      return null
    }

    // Normalize address to lowercase
    const normalizedAddress = tokenAddress.toLowerCase()

    if (DEBUG) console.log(`[Midgard] Fetching logo for ${normalizedAddress}`)

    // First try direct logo URL (most efficient)
    const directLogoUrl = `${MIDGARD_TOKEN_LOGO_URL}/${normalizedAddress}.png`

    try {
      // Check if the logo exists
      if (DEBUG) console.log(`[Midgard] Trying direct logo URL: ${directLogoUrl}`)

      const exists = USE_CORS_PROXY
        ? await checkImageExists(directLogoUrl)
        : (await fetch(directLogoUrl, { method: "HEAD" })).ok

      if (exists) {
        if (DEBUG) console.log(`[Midgard] Found direct logo for ${tokenAddress}`)
        return directLogoUrl
      } else {
        if (DEBUG) console.log(`[Midgard] Direct logo not found`)
      }
    } catch (directError) {
      if (DEBUG) console.error(`[Midgard] Error checking direct logo:`, directError)
    }

    // Try to extract logo from Midgard assets
    try {
      if (DEBUG) console.log(`[Midgard] Trying to extract logo from assets for ${tokenAddress}`)
      const assetLogo = await extractTokenLogosFromAssets(normalizedAddress)
      if (assetLogo) {
        if (DEBUG) console.log(`[Midgard] Found logo in assets for ${tokenAddress}: ${assetLogo}`)
        return assetLogo
      }
    } catch (assetError) {
      if (DEBUG) console.error(`[Midgard] Error extracting logo from assets:`, assetError)
    }

    // If previous methods fail, try to fetch token info from API
    const apiUrl = `${MIDGARD_API_BASE_URL}/tokens/${normalizedAddress}`
    if (DEBUG) console.log(`[Midgard] Trying API: ${apiUrl}`)

    try {
      const tokenInfoResponse = USE_CORS_PROXY ? await fetchWithCorsProxy(apiUrl) : await fetch(apiUrl)

      if (tokenInfoResponse.ok) {
        // Check if the response is JSON
        const contentType = tokenInfoResponse.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          if (DEBUG) console.log(`[Midgard] API returned non-JSON response: ${contentType}`)
          return null
        }

        try {
          const tokenInfo = await tokenInfoResponse.json()

          // Check if token info contains a logo URL
          if (tokenInfo && tokenInfo.logoURI) {
            if (DEBUG) console.log(`[Midgard] Found API logo for ${tokenAddress}: ${tokenInfo.logoURI}`)
            return tokenInfo.logoURI
          } else {
            if (DEBUG) console.log(`[Midgard] API response has no logoURI:`, tokenInfo)
          }
        } catch (parseError) {
          if (DEBUG) console.error(`[Midgard] Error parsing API response:`, parseError)
          return null
        }
      } else {
        if (DEBUG) console.log(`[Midgard] API request failed: ${tokenInfoResponse.status}`)
      }
    } catch (apiError) {
      if (DEBUG) console.error(`[Midgard] Error fetching from API:`, apiError)
    }

    if (DEBUG) console.log(`[Midgard] No logo found for ${tokenAddress}`)
    return null
  } catch (error) {
    console.error(`[Midgard] Error fetching logo for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Check if Midgard has information for a token
 * @param tokenAddress The token contract address
 * @returns True if Midgard has information for this token
 */
export async function checkMidgardTokenExists(tokenAddress: string): Promise<boolean> {
  try {
    if (tokenAddress === "NATIVE") return false

    const normalizedAddress = tokenAddress.toLowerCase()
    const apiUrl = `${MIDGARD_API_BASE_URL}/tokens/${normalizedAddress}`

    if (DEBUG) console.log(`[Midgard] Checking if token exists: ${apiUrl}`)

    const response = USE_CORS_PROXY ? await fetchWithCorsProxy(apiUrl) : await fetch(apiUrl)

    const exists = response.ok

    if (DEBUG) console.log(`[Midgard] Token exists: ${exists}`)
    return exists
  } catch (error) {
    console.error(`[Midgard] Error checking token existence for ${tokenAddress}:`, error)
    return false
  }
}

/**
 * Fetch basic token information from Midgard
 * @param tokenAddress The token contract address
 * @returns Basic token information or null if not found
 */
export async function fetchTokenInfoFromMidgard(tokenAddress: string): Promise<{
  name: string
  symbol: string
  decimals: number
  logoURI: string | null
} | null> {
  try {
    if (tokenAddress === "NATIVE") return null

    const normalizedAddress = tokenAddress.toLowerCase()
    const apiUrl = `${MIDGARD_API_BASE_URL}/tokens/${normalizedAddress}`

    if (DEBUG) console.log(`[Midgard] Fetching token info: ${apiUrl}`)

    const response = USE_CORS_PROXY ? await fetchWithCorsProxy(apiUrl) : await fetch(apiUrl)

    if (response.ok) {
      // Check if the response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        if (DEBUG) console.log(`[Midgard] API returned non-JSON response: ${contentType}`)
        return null
      }

      try {
        const tokenInfo = await response.json()
        if (DEBUG) console.log(`[Midgard] Token info found:`, tokenInfo)

        return {
          name: tokenInfo.name || "",
          symbol: tokenInfo.symbol || "",
          decimals: tokenInfo.decimals || 18,
          logoURI: tokenInfo.logoURI || null,
        }
      } catch (parseError) {
        if (DEBUG) console.error(`[Midgard] Error parsing token info:`, parseError)
        return null
      }
    } else {
      if (DEBUG) console.log(`[Midgard] Token info not found: ${response.status}`)
    }

    return null
  } catch (error) {
    console.error(`[Midgard] Error fetching token info for ${tokenAddress}:`, error)
    return null
  }
}

/**
 * Alternative method to fetch token logo using direct image URL
 * This might work even if the API doesn't
 */
export async function fetchTokenLogoDirectly(tokenAddress: string): Promise<string | null> {
  try {
    if (tokenAddress === "NATIVE") return null

    // Try different possible logo URLs
    const possibleUrls = [
      `https://midgard.wtf/images/tokens/${tokenAddress.toLowerCase()}.png`,
      `https://midgard.wtf/images/tokens/${tokenAddress.toLowerCase()}.jpg`,
      `https://midgard.wtf/images/tokens/${tokenAddress}.png`,
      `https://midgard.wtf/images/tokens/${tokenAddress}.jpg`,
    ]

    if (DEBUG) console.log(`[Midgard] Trying direct logo URLs for ${tokenAddress}`)

    for (const url of possibleUrls) {
      try {
        const exists = USE_CORS_PROXY ? await checkImageExists(url) : (await fetch(url, { method: "HEAD" })).ok

        if (exists) {
          if (DEBUG) console.log(`[Midgard] Found direct logo at ${url}`)
          return url
        }
      } catch (error) {
        if (DEBUG) console.log(`[Midgard] Failed to check ${url}:`, error)
      }
    }

    return null
  } catch (error) {
    console.error(`[Midgard] Error in direct logo fetch for ${tokenAddress}:`, error)
    return null
  }
}
