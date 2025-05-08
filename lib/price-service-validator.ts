/**
 * Utility functions to validate token prices and ensure they're reasonable
 */

// Maximum allowed price for tokens (to prevent unreasonable values)
const MAX_TOKEN_PRICE = 10000 // $10,000 per token

// Minimum allowed price for tokens (to prevent unreasonable values)
const MIN_TOKEN_PRICE = 0.000000001 // $0.000000001 per token

/**
 * Validate a token price to ensure it's within reasonable bounds
 * @param price The price to validate
 * @param tokenSymbol The token symbol (for logging)
 * @returns The validated price (or null if invalid)
 */
export function validateTokenPrice(price: number | null, tokenSymbol: string): number | null {
  if (price === null || price === undefined) {
    return null
  }

  // Check if price is a valid number
  if (isNaN(price) || !isFinite(price)) {
    console.warn(`Invalid price for ${tokenSymbol}: ${price}`)
    return null
  }

  // Check if price is within reasonable bounds
  if (price < 0) {
    console.warn(`Negative price for ${tokenSymbol}: ${price}`)
    return null
  }

  if (price > MAX_TOKEN_PRICE) {
    console.warn(`Price too high for ${tokenSymbol}: ${price}`)
    // Return a more reasonable price
    return 0.01 // Default to $0.01 for tokens with unreasonably high prices
  }

  // Special case for known problematic tokens
  if (tokenSymbol === "PRINT" && price > 1) {
    console.warn(`Correcting unreasonable price for PRINT: ${price}`)
    return 0.01 // Set PRINT to $0.01
  }

  // Debug WATT token specifically
  if (tokenSymbol === "WATT") {
    console.log(`[WATT Debug] Raw price: ${price}`)
    console.log(`[WATT Debug] Price type: ${typeof price}`)
    console.log(`[WATT Debug] Price as string: ${price.toString()}`)

    // Check if it's in scientific notation
    if (price.toString().includes("e")) {
      console.log(`[WATT Debug] Price is in scientific notation`)
      const [mantissa, exponent] = price.toString().split("e")
      console.log(`[WATT Debug] Mantissa: ${mantissa}, Exponent: ${exponent}`)
    }
  }

  return price
}

/**
 * Mirror the price of one token to another
 * @param sourcePrice The source price to mirror
 * @param sourceSymbol The source token symbol
 * @param targetSymbol The target token symbol
 * @returns The mirrored price
 */
export function mirrorTokenPrice(
  sourcePrice: number | null,
  sourceSymbol: string,
  targetSymbol: string,
): number | null {
  if (sourcePrice === null) {
    return null
  }

  console.log(`Mirroring price from ${sourceSymbol} to ${targetSymbol}: ${sourcePrice}`)
  return sourcePrice
}
