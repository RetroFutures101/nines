/**
 * Debugging utilities for token prices
 */

// Enable debug logging
const DEBUG = true

/**
 * Debug token price issues
 * @param tokenSymbol The token symbol
 * @param tokenAddress The token address
 * @param price The price value
 */
export function debugTokenPrice(tokenSymbol: string, tokenAddress: string, price: number | null): void {
  if (!DEBUG) return

  console.log(`[PriceDebug] Analyzing price for ${tokenSymbol} (${tokenAddress}): ${price}`)

  if (price === null || price === undefined) {
    console.log(`[PriceDebug] ${tokenSymbol} has null/undefined price`)
    return
  }

  // Check if price is a valid number
  if (isNaN(price) || !isFinite(price)) {
    console.log(`[PriceDebug] ${tokenSymbol} has invalid price: ${price}`)
    return
  }

  // Analyze the price format
  const priceStr = price.toString()
  console.log(`[PriceDebug] ${tokenSymbol} price as string: ${priceStr}`)

  // Check if it's in scientific notation
  if (priceStr.includes("e")) {
    const [mantissa, exponent] = priceStr.split("e")
    console.log(
      `[PriceDebug] ${tokenSymbol} price is in scientific notation: mantissa=${mantissa}, exponent=${exponent}`,
    )
  }

  // Check decimal places
  if (priceStr.includes(".")) {
    const [whole, decimal] = priceStr.split(".")
    console.log(`[PriceDebug] ${tokenSymbol} price has ${decimal.length} decimal places`)

    // Count leading zeros
    let leadingZeros = 0
    for (let i = 0; i < decimal.length; i++) {
      if (decimal[i] === "0") {
        leadingZeros++
      } else {
        break
      }
    }

    console.log(`[PriceDebug] ${tokenSymbol} price has ${leadingZeros} leading zeros after decimal`)
    console.log(`[PriceDebug] ${tokenSymbol} first non-zero digit: ${decimal[leadingZeros] || "none"}`)
  }

  // Check how it would be displayed in different formats
  console.log(`[PriceDebug] ${tokenSymbol} price as fixed(4): ${price.toFixed(4)}`)
  console.log(`[PriceDebug] ${tokenSymbol} price as fixed(8): ${price.toFixed(8)}`)
  console.log(`[PriceDebug] ${tokenSymbol} price as exponential(2): ${price.toExponential(2)}`)
}

/**
 * Debug token price display
 * @param tokenSymbol The token symbol
 * @param price The price value
 * @returns The formatted price for debugging
 */
export function debugPriceDisplay(tokenSymbol: string, price: number | null): string {
  if (price === null || price === undefined) return "—"

  // Special handling for very small numbers (more than 4 decimal places)
  if (price > 0 && price < 0.0001) {
    // Count leading zeros after decimal
    const priceStr = price.toString()
    console.log(`[PriceDebug] ${tokenSymbol} small price string: ${priceStr}`)

    // Handle scientific notation
    if (priceStr.includes("e")) {
      const [mantissa, exponent] = priceStr.split("e")
      const exponentNum = Number.parseInt(exponent, 10)
      console.log(`[PriceDebug] ${tokenSymbol} scientific notation: mantissa=${mantissa}, exponent=${exponentNum}`)

      // Calculate leading zeros (absolute value of exponent minus 1)
      const leadingZeros = Math.abs(exponentNum) - 1
      console.log(`[PriceDebug] ${tokenSymbol} calculated leading zeros: ${leadingZeros}`)

      // Get first non-zero digit
      const firstNonZeroDigit = mantissa.replace(".", "")[0]
      console.log(`[PriceDebug] ${tokenSymbol} first non-zero digit: ${firstNonZeroDigit}`)

      return `$0.(0)${leadingZeros}${firstNonZeroDigit}`
    }

    // Handle decimal notation
    const decimalPart = priceStr.split(".")[1]
    let leadingZeros = 0

    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] === "0") {
        leadingZeros++
      } else {
        break
      }
    }

    const firstNonZeroDigit = decimalPart[leadingZeros]
    console.log(
      `[PriceDebug] ${tokenSymbol} decimal notation: leadingZeros=${leadingZeros}, firstNonZeroDigit=${firstNonZeroDigit}`,
    )

    return `$0.(0)${leadingZeros}${firstNonZeroDigit}`
  }

  if (price < 0.001) {
    console.log(`[PriceDebug] ${tokenSymbol} using exponential: ${price.toExponential(2)}`)
    return `$${price.toExponential(2)}`
  }

  console.log(`[PriceDebug] ${tokenSymbol} using fixed: ${price.toFixed(4)}`)
  return `$${price.toFixed(4)}`
}
