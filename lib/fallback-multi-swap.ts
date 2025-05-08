import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { getRouterAddress, getWplsAddress } from "./env-config"

interface SwapExecutionResult {
  success: boolean
  transactionHash?: string
  error?: string
}

// Define token addresses for routing
const TOKEN_ADDRESSES = {
  // Main tokens
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
  INC: "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d",
  DAI: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",

  // Native stablecoins
  HEXDC: "0x1FE0319440A672526916C232EAEe4808254Bdb00",
  PXDC: "0xeB6b7932Da20c6D7B3a899D5887d86dfB09A6408",
  INCD: "0x144Cd22AaA2a80FEd0Bb8B1DeADDc51A53Df1d50",
  USDL: "0x0dEEd1486bc52aA0d3E6f8849cEC5adD6598A162",
  CST: "0x5e3c572a3e793a7d3b837c5df7af1be0a896c956", // CST address

  // Other common tokens
  USDC: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07",
  USDT: "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f",
}

// Define native stablecoins and their paired tokens
const NATIVE_STABLECOINS = {
  [TOKEN_ADDRESSES.HEXDC]: {
    name: "HEXDC",
    pairedToken: TOKEN_ADDRESSES.HEX,
    recommendedSlippage: 10,
  },
  [TOKEN_ADDRESSES.PXDC]: {
    name: "PXDC",
    pairedToken: TOKEN_ADDRESSES.PLSX,
    recommendedSlippage: 8,
  },
  [TOKEN_ADDRESSES.INCD]: {
    name: "INCD",
    pairedToken: TOKEN_ADDRESSES.INC,
    recommendedSlippage: 8,
  },
  [TOKEN_ADDRESSES.USDL]: {
    name: "USDL",
    pairedToken: TOKEN_ADDRESSES.WPLS, // USDL pairs directly with WPLS
    recommendedSlippage: 5,
  },
  [TOKEN_ADDRESSES.CST]: {
    name: "CST",
    pairedToken: TOKEN_ADDRESSES.DAI,
    recommendedSlippage: 5,
  },
}

/**
 * Generate optimal paths based on the comprehensive routing logic
 */
function generateOptimalPaths(
  fromToken: string,
  toToken: string,
  wplsAddress: string,
): { path: string[]; description: string }[] {
  const paths: { path: string[]; description: string }[] = []

  // Handle native token (PLS)
  const actualFromToken = fromToken === "NATIVE" ? wplsAddress : fromToken
  const actualToToken = toToken === "NATIVE" ? wplsAddress : toToken

  // Direct path (always include unless it's the same token)
  if (actualFromToken.toLowerCase() !== actualToToken.toLowerCase()) {
    paths.push({
      path: [actualFromToken, actualToToken],
      description: "direct path",
    })
  }

  // Check if output token is a native stablecoin
  if (NATIVE_STABLECOINS[actualToToken]) {
    const stablecoin = NATIVE_STABLECOINS[actualToToken]

    // Apply specific routing for native stablecoins as output
    if (stablecoin.name === "HEXDC") {
      // {tokenComingFrom} > WPLS > HEX > HEXDC
      paths.push({
        path: [actualFromToken, wplsAddress, TOKEN_ADDRESSES.HEX, actualToToken],
        description: `${stablecoin.name} output via WPLS and HEX`,
      })
    } else if (stablecoin.name === "PXDC") {
      // {tokenComingFrom} > WPLS > PLSX > PXDC
      paths.push({
        path: [actualFromToken, wplsAddress, TOKEN_ADDRESSES.PLSX, actualToToken],
        description: `${stablecoin.name} output via WPLS and PLSX`,
      })
    } else if (stablecoin.name === "INCD") {
      // {tokenComingFrom} > WPLS > INC > INCD
      paths.push({
        path: [actualFromToken, wplsAddress, TOKEN_ADDRESSES.INC, actualToToken],
        description: `${stablecoin.name} output via WPLS and INC`,
      })
    } else if (stablecoin.name === "USDL") {
      // {tokenComingFrom} > WPLS > USDL
      paths.push({
        path: [actualFromToken, wplsAddress, actualToToken],
        description: `${stablecoin.name} output via WPLS`,
      })
    } else if (stablecoin.name === "CST") {
      // {tokenComingFrom} > WPLS > DAI > CST
      paths.push({
        path: [actualFromToken, wplsAddress, TOKEN_ADDRESSES.DAI, actualToToken],
        description: `${stablecoin.name} output via WPLS and DAI`,
      })
    }

    // Also add path through paired token if not already coming from WPLS
    if (actualFromToken !== wplsAddress) {
      paths.push({
        path: [actualFromToken, stablecoin.pairedToken, actualToToken],
        description: `${stablecoin.name} output via paired token`,
      })
    }
  }

  // Check if input token is a native stablecoin
  if (NATIVE_STABLECOINS[actualFromToken]) {
    const stablecoin = NATIVE_STABLECOINS[actualFromToken]

    // Apply specific routing for native stablecoins as input
    if (stablecoin.name === "HEXDC") {
      // HEXDC > HEX > WPLS > {tokenGoingTo}
      paths.push({
        path: [actualFromToken, TOKEN_ADDRESSES.HEX, wplsAddress, actualToToken],
        description: `${stablecoin.name} input via HEX and WPLS`,
      })
    } else if (stablecoin.name === "PXDC") {
      // PXDC > PLSX > WPLS > {tokenGoingTo}
      paths.push({
        path: [actualFromToken, TOKEN_ADDRESSES.PLSX, wplsAddress, actualToToken],
        description: `${stablecoin.name} input via PLSX and WPLS`,
      })
    } else if (stablecoin.name === "INCD") {
      // INCD > INC > WPLS > {tokenGoingTo}
      paths.push({
        path: [actualFromToken, TOKEN_ADDRESSES.INC, wplsAddress, actualToToken],
        description: `${stablecoin.name} input via INC and WPLS`,
      })
    } else if (stablecoin.name === "USDL") {
      // USDL > WPLS > {tokenGoingTo}
      paths.push({
        path: [actualFromToken, wplsAddress, actualToToken],
        description: `${stablecoin.name} input via WPLS`,
      })
    } else if (stablecoin.name === "CST") {
      // CST > DAI > {tokenGoingTo}
      paths.push({
        path: [actualFromToken, TOKEN_ADDRESSES.DAI, actualToToken],
        description: `${stablecoin.name} input via DAI`,
      })
    }

    // Also add path through paired token if not going to WPLS
    if (actualToToken !== wplsAddress) {
      paths.push({
        path: [actualFromToken, stablecoin.pairedToken, actualToToken],
        description: `${stablecoin.name} input via paired token`,
      })
    }
  }

  // For other tokens, add standard routing paths
  if (!NATIVE_STABLECOINS[actualFromToken] && !NATIVE_STABLECOINS[actualToToken]) {
    // Primary logic: {tokenComingFrom} > WPLS > DAI > {tokenGoingTo}
    paths.push({
      path: [actualFromToken, wplsAddress, TOKEN_ADDRESSES.DAI, actualToToken],
      description: "via WPLS and DAI (primary)",
    })

    // Secondary logic: {tokenComingFrom} > DAI > WPLS > {tokenGoingTo}
    paths.push({
      path: [actualFromToken, TOKEN_ADDRESSES.DAI, wplsAddress, actualToToken],
      description: "via DAI and WPLS (secondary)",
    })
  }

  // Add additional common intermediary paths
  // Via WPLS
  if (actualFromToken !== wplsAddress && actualToToken !== wplsAddress) {
    paths.push({
      path: [actualFromToken, wplsAddress, actualToToken],
      description: "via WPLS",
    })
  }

  // Via HEX
  if (actualFromToken !== TOKEN_ADDRESSES.HEX && actualToToken !== TOKEN_ADDRESSES.HEX) {
    paths.push({
      path: [actualFromToken, TOKEN_ADDRESSES.HEX, actualToToken],
      description: "via HEX",
    })
  }

  // Via PLSX
  if (actualFromToken !== TOKEN_ADDRESSES.PLSX && actualToToken !== TOKEN_ADDRESSES.PLSX) {
    paths.push({
      path: [actualFromToken, TOKEN_ADDRESSES.PLSX, actualToToken],
      description: "via PLSX",
    })
  }

  // Via INC
  if (actualFromToken !== TOKEN_ADDRESSES.INC && actualToToken !== TOKEN_ADDRESSES.INC) {
    paths.push({
      path: [actualFromToken, TOKEN_ADDRESSES.INC, actualToToken],
      description: "via INC",
    })
  }

  // Filter out paths where elements are the same
  return paths.filter(({ path }) => {
    // Check if any adjacent elements are the same
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i].toLowerCase() === path[i + 1].toLowerCase()) {
        return false
      }
    }
    return true
  })
}

// Function to prompt user for approval of higher slippage
async function promptForHigherSlippage(
  currentSlippage: number,
  nextSlippage: number,
  tokenSymbol: string,
): Promise<boolean> {
  // In a real implementation, this would show a modal or confirmation dialog
  // For now, we'll use the browser's confirm dialog
  return window.confirm(
    `The swap for ${tokenSymbol} requires higher slippage. Would you like to increase slippage from ${currentSlippage}% to ${nextSlippage}%?`,
  )
}

/**
 * Execute a sequential multi-swap transaction
 * This is a fallback approach when the batched approach fails
 */
export async function executeSequentialMultiSwap(
  inputTokens: { token: Token; amount: string }[],
  outputToken: Token,
  slippage: number,
  userAddress: string,
): Promise<SwapExecutionResult> {
  try {
    console.log("Executing sequential multi-swap with:", {
      inputTokens: inputTokens.map((i) => `${i.token.symbol}: ${i.amount}`),
      outputToken: outputToken.symbol,
      slippage,
      userAddress,
    })

    // Ensure we have window.ethereum
    if (!window.ethereum) {
      throw new Error("MetaMask not detected")
    }

    // Force request accounts to ensure MetaMask is connected
    console.log("Directly requesting accounts from MetaMask...")
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
      params: [],
    })
    console.log("Accounts received for sequential swap:", accounts)

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts available. Please unlock your MetaMask wallet.")
    }

    // Create provider and signer with explicit connection
    const provider = new ethers.BrowserProvider(window.ethereum, "any")
    await provider.send("eth_chainId", []) // Force connection
    const currentSigner = await provider.getSigner()
    const currentAddress = await currentSigner.getAddress()
    console.log("Using signer with address for sequential swap:", currentAddress)

    // Get router and WPLS addresses
    const routerAddress = getRouterAddress()
    const wplsAddress = getWplsAddress()

    console.log("Router address:", routerAddress)
    console.log("WPLS address:", wplsAddress)

    // Router ABI - minimal version with just the functions we need
    const routerAbi = [
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    ]

    // Create router contract instance - use the signer directly, don't try to reconnect it
    const router = new ethers.Contract(routerAddress, routerAbi, currentSigner)

    // Set deadline for all swaps
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now

    // Execute swaps sequentially
    let successfulSwaps = 0
    let lastTxHash = ""

    // Process one token at a time
    for (const input of inputTokens) {
      try {
        console.log(`Processing swap for ${input.token.symbol}...`)

        // Skip tokens with zero amount
        if (!input.amount || Number.parseFloat(input.amount) <= 0) {
          console.log(`Skipping ${input.token.symbol} due to zero amount`)
          continue
        }

        // Parse amount
        const decimals = typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)
        const parsedAmount = ethers.parseUnits(input.amount, decimals)

        // Check if we're dealing with native token (PLS)
        const isFromNative = input.token.address === "NATIVE"
        const isToNative = outputToken.address === "NATIVE"

        // Always use the user-defined slippage as the starting point
        const startingSlippage = slippage
        console.log(`Using user-defined starting slippage: ${startingSlippage}%`)

        // Generate optimal paths based on the comprehensive routing logic
        const possiblePaths = generateOptimalPaths(
          isFromNative ? "NATIVE" : input.token.address,
          isToNative ? "NATIVE" : outputToken.address,
          wplsAddress,
        )

        console.log(
          `Generated ${possiblePaths.length} possible paths for ${input.token.symbol} to ${outputToken.symbol}`,
        )
        possiblePaths.forEach((pathInfo, i) => {
          console.log(`Path ${i + 1}: ${pathInfo.description} - ${pathInfo.path.join(" -> ")}`)
        })

        // Try each path with increasing slippage until success
        let swapSuccess = false
        let swapTx
        const maxRetries = 5 // Maximum number of retry attempts

        // Try each path
        for (const { path, description } of possiblePaths) {
          if (swapSuccess) break // Skip if we already succeeded with a previous path

          let currentSlippage = startingSlippage

          // Try the swap with increasing slippage until success or max retries
          for (let attempt = 0; attempt < maxRetries && !swapSuccess; attempt++) {
            try {
              // Calculate minimum output amount based on input value and token prices
              const outputDecimals =
                typeof outputToken.decimals === "number" ? outputToken.decimals : Number(outputToken.decimals)

              // Calculate based on token prices if available
              let minOutputAmount: bigint

              if (input.token.price && outputToken.price && input.token.price > 0 && outputToken.price > 0) {
                // Calculate expected output based on token prices
                const inputValue = Number(input.amount) * input.token.price
                const expectedOutput = inputValue / outputToken.price

                // Apply slippage
                const minOutput = expectedOutput * (1 - currentSlippage / 100)
                minOutputAmount = ethers.parseUnits(minOutput.toFixed(outputDecimals), outputDecimals)

                console.log(
                  `Path ${description}, Attempt ${attempt + 1}: Calculated min output from prices: ${ethers.formatUnits(minOutputAmount, outputDecimals)} ${outputToken.symbol} (slippage: ${currentSlippage}%)`,
                )
              } else {
                // If prices are not available, use a very small minimum amount
                // This essentially allows any output amount, relying on the router's path finding
                minOutputAmount = ethers.parseUnits("0.000000001", outputDecimals)
                console.log(
                  `Path ${description}, Attempt ${attempt + 1}: Using minimal output amount: ${ethers.formatUnits(minOutputAmount, outputDecimals)} ${outputToken.symbol}`,
                )
              }

              console.log(
                `Executing swap for ${input.token.symbol} with path ${description} and slippage ${currentSlippage}%...`,
              )

              // Approve token if not native
              if (!isFromNative) {
                await approveToken(input.token.address, routerAddress, parsedAmount, currentSigner)
              }

              // Execute the swap based on token types - Let MetaMask handle gas estimation
              if (isFromNative && !isToNative) {
                // Swap PLS -> Token
                console.log(`Executing PLS -> Token swap with value: ${ethers.formatEther(parsedAmount)} PLS`)
                swapTx = await router.swapExactETHForTokens(minOutputAmount, path, userAddress, deadline, {
                  value: parsedAmount,
                })
              } else if (!isFromNative && isToNative) {
                // Swap Token -> PLS
                console.log(`Executing Token -> PLS swap with amount: ${input.amount} ${input.token.symbol}`)
                swapTx = await router.swapExactTokensForETH(parsedAmount, minOutputAmount, path, userAddress, deadline)
              } else if (!isFromNative && !isToNative) {
                // Swap Token -> Token
                console.log(`Executing Token -> Token swap with amount: ${input.amount} ${input.token.symbol}`)
                swapTx = await router.swapExactTokensForTokens(
                  parsedAmount,
                  minOutputAmount,
                  path,
                  userAddress,
                  deadline,
                )
              } else {
                // PLS -> PLS (shouldn't happen, but just in case)
                console.log(`Skipping PLS -> PLS swap (invalid)`)
                break
              }

              console.log(`Swap transaction submitted: ${swapTx.hash}`)

              // Wait for transaction to be mined
              console.log(`Waiting for transaction confirmation...`)
              const receipt = await swapTx.wait()
              console.log(`Swap transaction confirmed: ${receipt.hash}`)

              lastTxHash = receipt.hash
              successfulSwaps++
              swapSuccess = true

              // Break out of the retry loop since we succeeded
              break
            } catch (swapError: any) {
              console.error(
                `Error swapping ${input.token.symbol} with path ${description} (attempt ${attempt + 1}):`,
                swapError,
              )

              // Check for user rejected transaction
              if (swapError.message && swapError.message.includes("user rejected")) {
                console.error(`User rejected the transaction for ${input.token.symbol}`)
                throw new Error(`Transaction rejected in wallet for ${input.token.symbol}`)
              }

              // Calculate next slippage based on the new incremental logic
              let nextSlippage: number

              // If current slippage is less than 2%, use the gradual increments
              if (currentSlippage < 2) {
                nextSlippage = currentSlippage + 0.25 // Increment by 0.25%
              } else {
                // For slippage >= 2%, require user approval for larger increments
                if (currentSlippage === 2) {
                  nextSlippage = 3
                  // Ask for user approval before increasing to 3%
                  const approved = await promptForHigherSlippage(currentSlippage, nextSlippage, input.token.symbol)
                  if (!approved) {
                    console.log(`User declined to increase slippage to ${nextSlippage}%. Trying next path.`)
                    break // Try next path
                  }
                } else if (currentSlippage === 3) {
                  nextSlippage = 4
                  // Ask for user approval before increasing to 4%
                  const approved = await promptForHigherSlippage(currentSlippage, nextSlippage, input.token.symbol)
                  if (!approved) {
                    console.log(`User declined to increase slippage to ${nextSlippage}%. Trying next path.`)
                    break // Try next path
                  }
                } else if (currentSlippage === 4) {
                  nextSlippage = 5
                  // Ask for user approval before increasing to 5%
                  const approved = await promptForHigherSlippage(currentSlippage, nextSlippage, input.token.symbol)
                  if (!approved) {
                    console.log(`User declined to increase slippage to ${nextSlippage}%. Trying next path.`)
                    break // Try next path
                  }
                } else {
                  // If we're already at 5%, don't increase further
                  console.log(`Maximum slippage of 5% reached. Trying next path.`)
                  break // Try next path
                }
              }

              console.warn(
                `Error for ${input.token.symbol} with path ${description}. Increasing slippage from ${currentSlippage}% to ${nextSlippage}%`,
              )

              currentSlippage = nextSlippage

              // If we've reached maximum slippage of 5%, try next path
              if (currentSlippage > 5) {
                console.error(
                  `Maximum slippage reached for ${input.token.symbol} with path ${description}. Trying next path.`,
                )
                break
              }

              // Continue to next attempt
              continue
            }
          }
        }

        // If we didn't succeed after all retries and paths, log and continue to next token
        if (!swapSuccess) {
          console.error(`Failed to swap ${input.token.symbol} after trying all paths and slippage values`)
        }
      } catch (error) {
        console.error(`Error processing ${input.token.symbol}:`, error)
        // Continue with next token even if this one fails
      }
    }

    if (successfulSwaps > 0) {
      return {
        success: true,
        transactionHash: lastTxHash,
      }
    } else {
      throw new Error("All swaps failed. Please try again with higher slippage or different tokens.")
    }
  } catch (error) {
    console.error("Sequential multi-swap execution failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during sequential multi-swap",
    }
  }
}

/**
 * Helper function to approve a token for spending by the router
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: ethers.BigNumberish,
  signer: ethers.Signer,
): Promise<string> {
  try {
    const tokenAbi = [
      "function approve(address spender, uint256 amount) public returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ]

    // Create token contract with the signer directly, don't try to reconnect it
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer)
    const signerAddress = await signer.getAddress()

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signerAddress, spenderAddress)
    const parsedAmount = ethers.getBigInt(amount.toString())

    // If allowance is less than amount, approve
    if (currentAllowance < parsedAmount) {
      console.log(`Approving ${tokenAddress} for spending...`)
      const approveTx = await tokenContract.approve(spenderAddress, ethers.MaxUint256)
      console.log(`Approval transaction sent: ${approveTx.hash}`)

      // Wait for transaction to be mined
      const receipt = await approveTx.wait()
      console.log(`Approval transaction confirmed: ${receipt.hash}`)
      return receipt.hash
    } else {
      console.log(`${tokenAddress} already approved for spending`)
      return "already-approved"
    }
  } catch (error) {
    console.error(`Error approving token ${tokenAddress}:`, error)
    throw error
  }
}
