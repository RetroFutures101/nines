/**
 * Utilities for handling CORS issues
 */

// Enable debug logging
const DEBUG = true

/**
 * Check if an image exists by creating an Image object
 * This avoids CORS issues that can occur with fetch
 * @param url The URL to check
 * @returns Promise that resolves to true if the image exists
 */
export function checkImageExistsCors(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      if (DEBUG) console.log(`[CORS] Image exists: ${url}`)
      resolve(true)
    }

    img.onerror = () => {
      if (DEBUG) console.log(`[CORS] Image does not exist: ${url}`)
      resolve(false)
    }

    // Add a random query parameter to bypass cache
    img.src = `${url}?_=${Date.now()}`
  })
}

/**
 * Preload an image to ensure it's in the browser cache
 * @param url The URL to preload
 * @returns Promise that resolves when the image is loaded
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      if (DEBUG) console.log(`[CORS] Preloaded image: ${url}`)
      resolve()
    }

    img.onerror = (error) => {
      if (DEBUG) console.error(`[CORS] Failed to preload image: ${url}`, error)
      reject(new Error(`Failed to preload image: ${url}`))
    }

    img.src = url
  })
}

/**
 * Preload multiple images in parallel
 * @param urls Array of URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export async function preloadImages(urls: string[]): Promise<void> {
  try {
    await Promise.all(
      urls.map((url) =>
        preloadImage(url).catch(() => {
          // Ignore individual failures
          if (DEBUG) console.warn(`[CORS] Ignoring failure to preload: ${url}`)
        }),
      ),
    )

    if (DEBUG) console.log(`[CORS] Preloaded ${urls.length} images`)
  } catch (error) {
    if (DEBUG) console.error(`[CORS] Error preloading images:`, error)
  }
}
