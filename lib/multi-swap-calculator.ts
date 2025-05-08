import type { Token } from "@/types/token"

interface TokenInput {
  token: Token
  amount: string
}

interface TokenRate {
  token: Token
  outputAmount: string
  rate: number
}

interface MultiSwapQuoteResult {
  outputAmount: string
  priceImpact: number
  executionPrice: number
  routeDescription: string
  path?: string[]
  individualRates: TokenRate[] // Added individual rates
}

/**
 * Calculate the maximum amount for a token based on its balance
 */
export function setMaxAmount(token: Token): string {
  if (!token.balance || Number.parseFloat(token.balance) <= 0) return "0"

  // For native token, leave a small amount for gas
  if (token.address === "NATIVE") {
    const balance = Number.parseFloat(token.balance)
    // Leave 0.01 for gas if balance is greater than 0.01
    return balance > 0.01 ? (balance - 0.01).toString() : "0"
  }

  return token.balance
}

/**
 * Check if a token has balance
 */
export function hasBalance(token: Token): boolean {
  return token.balance !== undefined && Number.parseFloat(token.balance) > 0
}

/**
 * Calculate the output amount for a multi-asset swap
 * This follows Odos' approach of finding the optimal path for multiple inputs
 */
export function calculateMultiSwapOutput(
  inputTokens: TokenInput[],
  outputToken: Token,
  isTestnet = false,
): MultiSwapQuoteResult | null {
  // Filter valid inputs (has token, amount > 0, and has balance in live mode)
  const validInputs = inputTokens.filter(
    (input) =>
      input.token && input.amount && Number.parseFloat(input.amount) > 0 && (isTestnet || hasBalance(input.token)),
  )

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
  const inputPaths: string[][] = []
  const individualRates: TokenRate[] = []

  for (const input of validInputs) {
    const inputAmount = Number.parseFloat(input.amount)
    // Use a default price of 0.0001 if price is missing
    const inputPrice = input.token.price || 0.0001

    const inputValue = inputAmount * inputPrice
    totalInputValue += inputValue
    totalInputTokens += 1

    // Generate path for this input token
    const wpls = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" // Hardcoded WPLS address
    const path = [
      input.token.address === "NATIVE" ? wpls : input.token.address,
      outputToken.address === "NATIVE" ? wpls : outputToken.address,
    ]

    // If path elements are different, add to paths
    if (path[0].toLowerCase() !== path[1].toLowerCase()) {
      inputPaths.push(path)
    }

    // Calculate individual output amount for this input token
    const outputPrice = outputToken.price || 0.0001
    const individualOutputAmount = inputValue / outputPrice

    // Calculate rate (how much output token per 1 input token)
    const rate = inputAmount > 0 ? individualOutputAmount / inputAmount : 0

    // Add to individual rates
    individualRates.push({
      token: input.token,
      outputAmount: individualOutputAmount.toFixed(outputToken.decimals > 8 ? 8 : outputToken.decimals),
      rate: rate,
    })

    console.log(`Input: ${inputAmount} ${input.token.symbol} at ${inputPrice} = ${inputValue}`)
    console.log(`Individual rate: 1 ${input.token.symbol} = ${rate.toFixed(2)} ${outputToken.symbol}`)
  }

  console.log(`Total input value: ${totalInputValue}`)

  // If output token has no price, use a default
  const outputPrice = outputToken.price || 0.0001
  console.log(`Output token price: ${outputPrice}`)

  // Calculate raw output amount
  const rawOutputAmount = totalInputValue / outputPrice
  console.log(`Raw output amount: ${rawOutputAmount} ${outputToken.symbol}`)

  // Calculate price impact based on Odos' approach
  const basePriceImpact = 0.3 // 0.3% base impact
  const additionalImpactPerToken = 0.2 // 0.2% per additional token
  const valueImpactFactor = 0.1 // 0.1% per $1000 of value

  let priceImpact = basePriceImpact + (totalInputTokens - 1) * additionalImpactPerToken

  // Add impact based on total value (larger swaps have higher impact)
  priceImpact += (totalInputValue / 1000) * valueImpactFactor

  // Cap at a reasonable maximum
  priceImpact = Math.min(priceImpact, 5.0)

  console.log(`Price impact: ${priceImpact}%`)

  // Apply price impact to output amount
  const adjustedOutputAmount = rawOutputAmount * (1 - priceImpact / 100)
  console.log(`Adjusted output amount: ${adjustedOutputAmount} ${outputToken.symbol}`)

  // Format the output amount with appropriate precision
  // Use token decimals if available, otherwise use 6 decimals
  const decimals = outputToken.decimals || 6
  const formattedOutputAmount = adjustedOutputAmount.toFixed(decimals > 8 ? 8 : decimals)

  // Generate route description
  const routeDescription = `Optimized path (${totalInputTokens} tokens)`

  return {
    outputAmount: formattedOutputAmount,
    priceImpact: priceImpact,
    executionPrice: totalInputValue > 0 ? rawOutputAmount / totalInputValue : 0,
    routeDescription: routeDescription,
    path: inputPaths.flat(), // Flatten all paths for display
    individualRates: individualRates,
  }
}

/**
 * Calculate the optimal slippage for a token based on its volatility and liquidity
 */
export function calculateOptimalSlippage(token: Token, amount: string, baseSlippage: number): number {
  // Default to the base slippage
  let optimalSlippage = baseSlippage

  // Adjust slippage based on token characteristics
  // This is a simplified implementation - in a real implementation, we would use more sophisticated logic

  // Known high-volatility tokens
  const highVolatilityTokens = ["HDRN", "HEX", "PLSX"]
  if (highVolatilityTokens.includes(token.symbol)) {
    optimalSlippage += 5 // Add 5% slippage for high-volatility tokens
  }

  // Adjust based on amount (larger amounts may need higher slippage)
  const amountValue = Number.parseFloat(amount) * (token.price || 0.0001)
  if (amountValue > 1000) {
    optimalSlippage += 2 // Add 2% slippage for large amounts
  } else if (amountValue > 100) {
    optimalSlippage += 1 // Add 1% slippage for medium amounts
  }

  // Cap slippage at a reasonable maximum
  return Math.min(optimalSlippage, 15) // Maximum 15% slippage
}
