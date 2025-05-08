/**
 * CORS Proxy utility for making cross-origin requests
 */

// Public CORS proxies that can be used
const CORS_PROXIES = [
  "https://corsproxy.io/?",
  "https://cors-anywhere.herokuapp.com/",
  "https://api.allorigins.win/raw?url=",
]

// Default proxy to use
const DEFAULT_PROXY = CORS_PROXIES[0]

// Enable debug logging
const DEBUG = true

/**
 * Fetch a URL through a CORS proxy
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns The response
 */
export async function fetchWithCorsProxy(url: string, options: RequestInit = {}): Promise<Response> {
  // Try without proxy first
  try {
    if (DEBUG) console.log(`[CORS] Trying direct fetch: ${url}`)
    const directResponse = await fetch(url, options)
    if (directResponse.ok) {
      if (DEBUG) console.log(`[CORS] Direct fetch succeeded`)
      return directResponse
    }
    if (DEBUG) console.log(`[CORS] Direct fetch failed: ${directResponse.status}`)
  } catch (directError) {
    if (DEBUG) console.log(`[CORS] Direct fetch error:`, directError)
  }

  // Try with proxy
  if (DEBUG) console.log(`[CORS] Trying with proxy: ${DEFAULT_PROXY}${url}`)

  // Add headers to ensure we get JSON if available
  const enhancedOptions = {
    ...options,
    headers: {
      ...options.headers,
      Accept: "application/json",
    },
  }

  return fetch(`${DEFAULT_PROXY}${url}`, enhancedOptions)
}

/**
 * Check if an image URL exists by making a HEAD request
 * @param url The image URL to check
 * @returns True if the image exists
 */
export async function checkImageExists(url: string): Promise<boolean> {
  try {
    // Try direct first
    try {
      if (DEBUG) console.log(`[CORS] Checking if image exists: ${url}`)
      const response = await fetch(url, { method: "HEAD" })
      if (response.ok) {
        if (DEBUG) console.log(`[CORS] Image exists`)
        return true
      }
      if (DEBUG) console.log(`[CORS] Image check failed: ${response.status}`)
    } catch (directError) {
      if (DEBUG) console.log(`[CORS] Direct image check error:`, directError)
    }

    // Try with proxy
    if (DEBUG) console.log(`[CORS] Checking image with proxy: ${DEFAULT_PROXY}${url}`)
    const proxyResponse = await fetch(`${DEFAULT_PROXY}${url}`, { method: "HEAD" })
    return proxyResponse.ok
  } catch (error) {
    if (DEBUG) console.log(`[CORS] Image check error:`, error)
    return false
  }
}

/**
 * Safely parse JSON with fallback
 * @param text The text to parse as JSON
 * @returns The parsed JSON or null if parsing fails
 */
export function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (DEBUG) console.error(`[CORS] JSON parse error:`, error)
    return null
  }
}
