import type { Token } from "@/types/token"

interface TokenInput {
  token: Token
  amount: string
}

export interface MultiSwapQuoteResult {
  outputAmount: string
  priceImpact: number
  executionPrice: number
  marketPrice: number
  routeDescription: string
}

/**
 * Calculate a multi-swap quote based on input tokens and output token
 */
export function calculateMultiSwapQuote(inputTokens: TokenInput[], outputToken: Token): MultiSwapQuoteResult | null {
  // Filter valid inputs (has token, amount > 0)
  const validInputs = inputTokens.filter((input) => input.token && input.amount && Number.parseFloat(input.amount) > 0)

  if (validInputs.length === 0 || !outputToken) {
    console.log("No valid inputs or output token")
    return null
  }

  // Log the inputs for debugging
  console.log(
    "Calculating multi-swap quote with inputs:",
    validInputs.map((i) => `${i.amount} ${i.token.symbol} (price: ${i.token.price})`),
  )
  console.log("Output token:", outputToken.symbol, "price:", outputToken.price)

  // Calculate total input value in USD
  let totalInputValue = 0
  let totalInputTokens = 0

  for (const input of validInputs) {
    const inputAmount = Number.parseFloat(input.amount)
    // Use a default price of 0.0001 if price is missing
    const inputPrice = input.token.price || 0.0001

    const inputValue = inputAmount * inputPrice
    totalInputValue += inputValue
    totalInputTokens += 1

    console.log(`Input: ${inputAmount} ${input.token.symbol} at $${inputPrice} = $${inputValue}`)
  }

  console.log(`Total input value: $${totalInputValue}`)

  // If output token has no price, use a default
  const outputPrice = outputToken.price || 0.0001
  console.log(`Output token price: $${outputPrice}`)

  // Calculate raw output amount
  const rawOutputAmount = totalInputValue / outputPrice
  console.log(`Raw output amount: ${rawOutputAmount} ${outputToken.symbol}`)

  // Calculate price impact based on number of input tokens
  // More tokens = higher impact
  const basePriceImpact = 0.5 // 0.5% base impact
  const additionalImpactPerToken = 0.3 // 0.3% per additional token
  const priceImpact = basePriceImpact + (totalInputTokens - 1) * additionalImpactPerToken
  console.log(`Price impact: ${priceImpact}%`)

  // Apply price impact to output amount
  const adjustedOutputAmount = rawOutputAmount * (1 - priceImpact / 100)
  console.log(`Adjusted output amount: ${adjustedOutputAmount} ${outputToken.symbol}`)

  // Format the output amount with appropriate precision
  // Use token decimals if available, otherwise use 6 decimals
  const decimals = outputToken.decimals || 6
  const formattedOutputAmount = adjustedOutputAmount.toFixed(decimals > 8 ? 8 : decimals)

  return {
    outputAmount: formattedOutputAmount,
    priceImpact: priceImpact,
    executionPrice: totalInputValue > 0 ? rawOutputAmount / totalInputValue : 0,
    marketPrice: totalInputValue > 0 ? rawOutputAmount / totalInputValue : 0,
    routeDescription: `Multi-asset swap via aggregation (${totalInputTokens} tokens)`,
  }
}
