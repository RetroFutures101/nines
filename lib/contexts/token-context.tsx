"use client"

import type React from "react"
import { createContext, useContext, useEffect, useCallback, useReducer, useRef } from "react"
import type { Token } from "@/types/token"
import { getTokenList, getTokenBalance } from "@/lib/tokens"
import { getTokenPrice, getTokenPriceChange } from "@/lib/price-service"
import { useWeb3 } from "@/hooks/use-web3"
import { getTestnetTokenList, getTestnetTokenBalance, getTestnetTokenDetails } from "@/lib/testnet-tokens"
import { getTestnetTokenPrice, getTestnetTokenPriceChange } from "@/lib/testnet-price-service"
import { safeStringifyBigInt, safeJsonStringify } from "@/lib/bigint-utils"
import { ethers } from "ethers"
import { getWplsAddress } from "@/lib/tokens"

// Add this import at the top of the file
import { fetchTokenInfoFromMidgard } from "@/lib/midgard-token-service"
import { getTokenLogoUrl } from "@/lib/token-icons"

// Import the direct verification function - we'll implement this directly here
// instead of importing from another file
// import { directVerifyTokenOnPulseChain } from "@/lib/direct-chain-verification"

// Add these constants at the top of the file, after the imports
const PRICE_CACHE_KEY = "pulseChainDexPrices"
const PRICE_CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes

// Hardcoded RPC URLs for PulseChain
const PULSECHAIN_MAINNET_RPC = "https://rpc-pulsechain.g4mm4.io"
const PULSECHAIN_TESTNET_RPC = "https://rpc-testnet-pulsechain.g4mm4.io"

// Chain IDs for PulseChain
const PULSECHAIN_MAINNET_CHAIN_ID = 369
const PULSECHAIN_TESTNET_CHAIN_ID = 943

/**
 * Direct verification that a token exists on PulseChain
 * This function bypasses any environment variables and directly uses hardcoded values
 */
async function directVerifyTokenOnPulseChain(
  address: string,
  isTestnet = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip verification for native token
    if (address === "NATIVE") return { success: true }

    // Use hardcoded RPC URL based on network
    const rpcUrl = isTestnet ? PULSECHAIN_TESTNET_RPC : PULSECHAIN_MAINNET_RPC
    const expectedChainId = isTestnet ? PULSECHAIN_TESTNET_CHAIN_ID : PULSECHAIN_MAINNET_CHAIN_ID

    // Create provider with the hardcoded RPC URL
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Verify we're on the correct chain
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    if (chainId !== expectedChainId) {
      return {
        success: false,
        error: `Connected to wrong network. Expected chain ID: ${expectedChainId}, got: ${chainId}`,
      }
    }

    // Check if the contract exists on this chain
    const code = await provider.getCode(address)
    if (code === "0x" || code === "") {
      return {
        success: false,
        error: `Contract not found on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}. The token may exist on a different blockchain.`,
      }
    }

    // Verify it's an ERC20 token
    const minimalABI = [
      "function balanceOf(address) view returns (uint256)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function name() view returns (string)",
    ]

    const contract = new ethers.Contract(address, minimalABI, provider)

    try {
      // Try to call multiple ERC20 methods to verify it's a valid token
      const [symbol, decimals, name] = await Promise.all([
        contract.symbol(),
        contract.decimals(),
        contract.name().catch(() => "Unknown Token"),
      ])

      console.log(`Verified token on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}: ${symbol} (${name})`)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Address exists but is not a valid ERC20 token on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}.`,
      }
    }
  } catch (error) {
    console.error(`Error verifying token on chain:`, error)
    return {
      success: false,
      error: `Failed to verify token. Please check the address and try again.`,
    }
  }
}

// Define the context state and actions
type TokenContextType = {
  tokens: Token[]
  isLoading: boolean
  refreshTokens: () => Promise<void>
  addCustomToken: (token: Token) => Promise<Token>
  reorderTokens: (reorderedTokens: Token[]) => void
  updateTokenBalance: (tokenAddress: string, balance: string) => void
  updateAllTokenBalances: () => Promise<void>
  isTestnet?: boolean
  detectWalletTokens: () => Promise<void>
}

// Create the context
const TokenContext = createContext<TokenContextType | undefined>(undefined)

// Token reducer to handle all token state changes
function tokenReducer(state: { tokens: Token[]; isLoading: boolean }, action: any) {
  switch (action.type) {
    case "SET_TOKENS":
      return { ...state, tokens: action.payload }
    case "SET_LOADING":
      return { ...state, isLoading: action.payload }
    case "UPDATE_TOKEN":
      return {
        ...state,
        tokens: state.tokens.map((token) =>
          token.address.toLowerCase() === action.payload.address.toLowerCase()
            ? { ...token, ...action.payload }
            : token,
        ),
      }
    case "UPDATE_TOKEN_BALANCE":
      return {
        ...state,
        tokens: state.tokens.map((token) =>
          token.address.toLowerCase() === action.payload.address.toLowerCase()
            ? { ...token, balance: action.payload.balance }
            : token,
        ),
      }
    case "UPDATE_TOKEN_PRICES":
      return {
        ...state,
        tokens: state.tokens.map((token) => {
          const updatedPrice = action.payload.find(
            (p: { address: string; price: number }) => p.address.toLowerCase() === token.address.toLowerCase(),
          )
          if (updatedPrice) {
            return { ...token, price: updatedPrice.price }
          }
          return token
        }),
      }
    case "ADD_TOKEN":
      // Check if token already exists
      const existingIndex = state.tokens.findIndex(
        (t) => t.address.toLowerCase() === action.payload.address.toLowerCase(),
      )

      if (existingIndex !== -1) {
        // Update existing token
        return {
          ...state,
          tokens: state.tokens.map((token, index) =>
            index === existingIndex ? { ...token, ...action.payload } : token,
          ),
        }
      }

      // Add new token at the beginning
      return { ...state, tokens: [action.payload, ...state.tokens] }
    case "REORDER_TOKENS":
      return { ...state, tokens: action.payload }
    default:
      return state
  }
}

// Add this function to load cached prices from localStorage
const loadCachedPrices = () => {
  try {
    const cachedPricesJson = localStorage.getItem(PRICE_CACHE_KEY)
    if (cachedPricesJson) {
      const cachedPrices = JSON.parse(cachedPricesJson)
      if (cachedPrices.timestamp && Date.now() - cachedPrices.timestamp < PRICE_CACHE_EXPIRY) {
        return cachedPrices.prices
      }
    }
  } catch (error) {
    console.error("Failed to load cached prices:", error)
  }
  return null
}

// Add this function to save prices to localStorage
const savePricesToCache = (prices: any[]) => {
  try {
    const pricesCache = {
      timestamp: Date.now(),
      prices: prices,
    }
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(pricesCache))
  } catch (error) {
    console.error("Failed to save prices to cache:", error)
  }
}

// Provider component
export function TokenProvider({
  children,
  isTestnet = false,
}: {
  children: React.ReactNode
  isTestnet?: boolean
}) {
  const { address, provider, isConnected } = useWeb3()
  const [state, dispatch] = useReducer(tokenReducer, {
    tokens: [],
    isLoading: true,
  })

  // Add this near the top of the TokenProvider component, after the state declaration
  const isUpdatingBalances = useRef(false)
  const hasInitialized = useRef(false)

  // Save tokens to localStorage with debouncing
  const saveTokensToLocalStorage = useCallback(
    (tokenList: Token[]) => {
      try {
        // Filter out standard tokens to only save custom ones
        const storageKey = isTestnet ? "testnetCustomTokens" : "customTokens"
        const orderKey = isTestnet ? "testnetTokenOrder" : "tokenOrder"

        // Create a safe-to-serialize version of the tokens
        const serializableTokens = tokenList.map(safeStringifyBigInt)

        // Save the tokens using our safe JSON stringify function
        localStorage.setItem(storageKey, safeJsonStringify(serializableTokens))

        // Save the complete order of all tokens
        const tokenOrder = tokenList.map((token) => token.address.toLowerCase())
        localStorage.setItem(orderKey, JSON.stringify(tokenOrder))

        console.log(`Saved ${serializableTokens.length} tokens to localStorage with order preservation`)
      } catch (error) {
        console.error("Failed to save tokens to localStorage:", error)
      }
    },
    [isTestnet],
  )

  // Function to detect tokens in the connected wallet
  const detectWalletTokens = useCallback(async () => {
    if (!isConnected || !address || !provider) {
      console.log("Cannot detect wallet tokens: wallet not connected")
      return
    }

    console.log(`Detecting tokens in wallet for address: ${address}`)
    dispatch({ type: "SET_LOADING", payload: true })

    try {
      // Get network type
      const network = isTestnet ? "testnet" : "mainnet"
      console.log(`Detecting tokens on ${network}`)

      // Get initial token list (default tokens)
      const tokenList = isTestnet ? await getTestnetTokenList() : await getTokenList()
      console.log(`Loaded ${tokenList.length} standard tokens from default list`)

      // Update tokens with balances
      const tokensWithBalances = await Promise.all(
        tokenList.map(async (token) => {
          try {
            let balance
            if (isTestnet) {
              balance = await getTestnetTokenBalance(token.address, address)
            } else {
              balance = await getTokenBalance(token.address, address)
            }

            // Convert balance to number for comparison
            const balanceNum = Number.parseFloat(balance)

            // Add detected flag if the token has a balance
            return {
              ...token,
              balance,
              detected: balanceNum > 0,
            }
          } catch (error) {
            console.error(`Failed to get balance for ${token.symbol}:`, error)
            return {
              ...token,
              balance: "0",
              detected: false,
            }
          }
        }),
      )

      // Filter tokens - show native token always plus tokens with balances
      const tokensToShow = tokensWithBalances.filter((token) => token.address === "NATIVE" || token.detected)

      // If no tokens detected (except native), show a few default ones
      if (tokensToShow.length <= 1) {
        // Just add a few popular ones as defaults
        const defaultTokens = tokensWithBalances.slice(0, 5)
        tokensToShow.push(...defaultTokens.filter((t) => t.address !== "NATIVE"))
      }

      console.log(`Detected ${tokensToShow.length} tokens in wallet`)

      // Ensure all BigInt values are converted to strings
      const safeTokens = safeStringifyBigInt(tokensToShow)

      dispatch({ type: "SET_TOKENS", payload: safeTokens })
      dispatch({ type: "SET_LOADING", payload: false })

      // Save detected tokens to localStorage
      saveTokensToLocalStorage(safeTokens)

      return safeTokens
    } catch (error) {
      console.error("Failed to detect wallet tokens:", error)
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }, [address, provider, isConnected, isTestnet, saveTokensToLocalStorage, dispatch])

  // Refresh token data
  const refreshTokens = useCallback(async () => {
    if (state.tokens.length === 0) return

    try {
      console.log(`Refreshing ${isTestnet ? "testnet" : "mainnet"} tokens...`)
      dispatch({ type: "SET_LOADING", payload: true })

      const updatedTokens = await Promise.all(
        state.tokens.map(async (token) => {
          try {
            let price, priceChange, balance

            if (isTestnet) {
              console.log(`Refreshing testnet token: ${token.symbol} (${token.address})`)
              price = await getTestnetTokenPrice(token.address)
              priceChange = await getTestnetTokenPriceChange(token.address)

              if (address) {
                console.log(`Getting balance for testnet token: ${token.symbol} (${token.address})`)
                balance = await getTestnetTokenBalance(token.address, address)
                console.log(`Balance for ${token.symbol}: ${balance}`)
              } else {
                balance = token.balance
              }
            } else {
              // Special case for PLS - use WPLS price
              if (token.address === "NATIVE") {
                const wplsToken = state.tokens.find((t) => t.symbol === "WPLS")
                if (wplsToken && wplsToken.price) {
                  price = wplsToken.price
                } else {
                  price = await getTokenPrice(getWplsAddress())
                }
              } else {
                price = await getTokenPrice(token.address)
              }
              priceChange = await getTokenPriceChange(token.address)
              balance = address ? await getTokenBalance(token.address, address) : token.balance
            }

            // Convert balance to number for comparison
            const balanceNum = Number.parseFloat(balance || "0")

            return {
              ...token,
              price,
              priceChange,
              balance: address ? balance : token.balance,
              detected: balanceNum > 0,
            }
          } catch (error) {
            console.warn(`Failed to refresh data for token ${token.symbol}:`, error)
            return token
          }
        }),
      )

      // Ensure all BigInt values are converted to strings
      const safeTokens = safeStringifyBigInt(updatedTokens)

      // Save prices to localStorage
      const prices = safeTokens.map((token) => ({
        address: token.address,
        price: token.price,
      }))
      savePricesToCache(prices)

      dispatch({ type: "SET_TOKENS", payload: safeTokens })
      dispatch({ type: "SET_LOADING", payload: false })
      console.log(`Refreshed ${safeTokens.length} tokens`)

      // Save updated tokens to localStorage
      saveTokensToLocalStorage(safeTokens)

      return safeTokens
    } catch (error) {
      console.error("Failed to refresh token data:", error)
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }, [state.tokens, address, isTestnet, saveTokensToLocalStorage, dispatch])

  // Load initial tokens
  useEffect(() => {
    let isMounted = true

    if (hasInitialized.current) return
    hasInitialized.current = true

    async function loadTokens() {
      dispatch({ type: "SET_LOADING", payload: true })
      try {
        console.log(`Loading initial ${isTestnet ? "testnet" : "mainnet"} tokens...`)

        // Get tokens based on network type
        let tokenList: Token[] = []
        try {
          tokenList = isTestnet ? await getTestnetTokenList() : await getTokenList()
          console.log(`Loaded ${tokenList.length} standard tokens`)
        } catch (tokenListError) {
          console.error("Failed to load standard tokens:", tokenListError)
          // Provide fallback tokens if standard list fails
          tokenList = isTestnet
            ? [
                {
                  address: "NATIVE",
                  symbol: "tPLS",
                  name: "Test PulseChain",
                  decimals: 18,
                  logoURI: "/tpls-logo.svg",
                  isNative: true,
                  isTestnet: true,
                },
              ]
            : [
                {
                  address: "NATIVE",
                  symbol: "PLS",
                  name: "PulseChain",
                  decimals: 18,
                  logoURI: "/tpls-logo.svg",
                  isNative: true,
                },
              ]
        }

        // Try to load custom tokens from localStorage
        let customTokens: Token[] = []
        try {
          const storageKey = isTestnet ? "testnetCustomTokens" : "customTokens"
          const savedTokens = localStorage.getItem(storageKey)
          if (savedTokens) {
            customTokens = JSON.parse(savedTokens)
            console.log(`Loaded ${customTokens.length} custom tokens from localStorage`)
          }
        } catch (storageError) {
          console.error("Failed to load custom tokens from localStorage:", storageError)
        }

        // Try to load token order from localStorage
        let savedOrder: string[] = []
        try {
          const orderKey = isTestnet ? "testnetTokenOrder" : "tokenOrder"
          const orderData = localStorage.getItem(orderKey)
          if (orderData) {
            savedOrder = JSON.parse(orderData)
            console.log(`Loaded token order from localStorage`)
          }
        } catch (orderError) {
          console.error("Failed to load token order from localStorage:", orderError)
        }

        // Combine standard and custom tokens, avoiding duplicates
        let combinedTokens: Token[] = []

        // First add all standard tokens that aren't duplicated in custom tokens
        tokenList.forEach((standardToken) => {
          if (!customTokens.some((ct) => ct.address.toLowerCase() === standardToken.address.toLowerCase())) {
            combinedTokens.push(standardToken)
          }
        })

        // Then add all custom tokens
        combinedTokens = [...combinedTokens, ...customTokens]

        // If we have a saved order, sort the tokens according to it
        if (savedOrder.length > 0) {
          combinedTokens.sort((a, b) => {
            const indexA = savedOrder.indexOf(a.address.toLowerCase())
            const indexB = savedOrder.indexOf(b.address.toLowerCase())

            // If both tokens are in the saved order, sort by their positions
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB
            }

            // If only one token is in the saved order, prioritize it
            if (indexA !== -1) return -1
            if (indexB !== -1) return 1

            // If neither token is in the saved order, maintain their current order
            return 0
          })
        }

        // Apply cached prices if available
        const cachedPrices = loadCachedPrices()
        if (cachedPrices) {
          combinedTokens = combinedTokens.map((token) => {
            const cachedPrice = cachedPrices.find(
              (p: { address: string; price: number }) => p.address.toLowerCase() === token.address.toLowerCase(),
            )

            if (cachedPrice) {
              return { ...token, price: cachedPrice.price }
            }

            // Special case for PLS - use WPLS price
            if (token.address === "NATIVE") {
              const wplsPrice = cachedPrices.find(
                (p: { address: string; price: number }) => p.address.toLowerCase() === getWplsAddress().toLowerCase(),
              )
              if (wplsPrice) {
                return { ...token, price: wplsPrice.price }
              }
            }

            return token
          })
        }

        // Instead of loading all balances, get the active tokens from the wallet
        if (address && isConnected && isMounted) {
          console.log(`Loading balances for ${isTestnet ? "testnet" : "mainnet"} tokens...`)

          // Only get balances for first few tokens and native token to reduce network load
          const initialTokensToCheck = [
            ...combinedTokens.filter((t) => t.address === "NATIVE"),
            ...combinedTokens.slice(0, 5).filter((t) => t.address !== "NATIVE"),
          ]

          for (let i = 0; i < initialTokensToCheck.length; i++) {
            try {
              console.log(`Getting balance for ${initialTokensToCheck[i].symbol} (${initialTokensToCheck[i].address})`)
              initialTokensToCheck[i].balance = isTestnet
                ? await getTestnetTokenBalance(initialTokensToCheck[i].address, address)
                : await getTokenBalance(initialTokensToCheck[i].address, address)
              console.log(`Balance for ${initialTokensToCheck[i].symbol}: ${initialTokensToCheck[i].balance}`)

              // Update in the combined tokens array
              const index = combinedTokens.findIndex(
                (t) => t.address.toLowerCase() === initialTokensToCheck[i].address.toLowerCase(),
              )
              if (index !== -1) {
                combinedTokens[index].balance = initialTokensToCheck[i].balance

                // Mark as detected if has balance
                const balanceNum = Number.parseFloat(initialTokensToCheck[i].balance)
                combinedTokens[index].detected = balanceNum > 0
              }
            } catch (error) {
              console.error(`Failed to get balance for ${initialTokensToCheck[i].symbol}:`, error)
            }
          }
        }

        // Ensure all BigInt values are converted to strings
        const safeTokens = safeStringifyBigInt(combinedTokens)

        if (isMounted) {
          dispatch({ type: "SET_TOKENS", payload: safeTokens })
          dispatch({ type: "SET_LOADING", payload: false })
          console.log(`Initialized ${safeTokens.length} tokens`)

          // If wallet is connected, run token detection after initial load
          if (address && isConnected) {
            // Run token detection in the background
            setTimeout(() => {
              detectWalletTokens().catch(console.error)
            }, 2000)
          }
        }
      } catch (error) {
        console.error("Failed to load tokens:", error)
        if (isMounted) {
          // Provide at least the native token on error
          const fallbackToken = isTestnet
            ? {
                address: "NATIVE",
                symbol: "tPLS",
                name: "Test PulseChain",
                decimals: 18,
                logoURI: "/tpls-logo.svg",
                isNative: true,
                isTestnet: true,
                balance: "0",
                price: null,
                priceChange: null,
              }
            : {
                address: "NATIVE",
                symbol: "PLS",
                name: "PulseChain",
                decimals: 18,
                logoURI: "/tpls-logo.svg",
                isNative: true,
                balance: "0",
                price: null,
                priceChange: null,
              }

          dispatch({ type: "SET_TOKENS", payload: [fallbackToken] })
          dispatch({ type: "SET_LOADING", payload: false })
        }
      }
    }

    loadTokens()

    return () => {
      isMounted = false
    }
  }, [isTestnet, saveTokensToLocalStorage, address, isConnected, detectWalletTokens, dispatch])

  // Add custom token
  const addCustomToken = useCallback(
    async (newToken: Token): Promise<Token> => {
      let tokenWithBalance = { ...newToken }
      try {
        // Skip verification for native token
        if (newToken.address === "NATIVE") {
          return newToken
        }

        // Use our direct verification to ensure the token exists on PulseChain
        const { success, error: verificationError } = await directVerifyTokenOnPulseChain(newToken.address, isTestnet)

        if (!success) {
          throw new Error(
            verificationError || `Contract not found on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}.`,
          )
        }

        // Ensure we have a symbol, even if it's temporary
        if (!tokenWithBalance.symbol || tokenWithBalance.symbol === "") {
          tokenWithBalance.symbol = "Loading..."
        }

        // Try to fetch token details from Midgard first
        try {
          console.log(`Trying to fetch token details from Midgard for ${newToken.address}`)
          const midgardTokenInfo = await fetchTokenInfoFromMidgard(newToken.address)

          if (midgardTokenInfo) {
            console.log(`Found token details on Midgard: ${JSON.stringify(midgardTokenInfo)}`)
            tokenWithBalance = {
              ...tokenWithBalance,
              name: midgardTokenInfo.name || tokenWithBalance.name,
              symbol: midgardTokenInfo.symbol || tokenWithBalance.symbol,
              decimals: midgardTokenInfo.decimals || tokenWithBalance.decimals,
              logoURI: midgardTokenInfo.logoURI || tokenWithBalance.logoURI,
            }
          }
        } catch (midgardError) {
          console.error("Failed to fetch token details from Midgard:", midgardError)
        }

        // If we couldn't get details from Midgard, try blockchain
        if (!tokenWithBalance.name || tokenWithBalance.name === "" || tokenWithBalance.symbol === "Loading...") {
          // Fetch token details (name, symbol, decimals) from the blockchain
          if (isTestnet) {
            try {
              console.log(`Fetching testnet token details for ${newToken.address}`)
              const tokenDetails = await getTestnetTokenDetails(newToken.address)
              if (tokenDetails) {
                tokenWithBalance = {
                  ...tokenWithBalance,
                  ...tokenDetails,
                }
              }
            } catch (detailsError) {
              console.error("Failed to fetch testnet token details:", detailsError)
            }
          } else {
            // For mainnet, try to get token details from the contract
            try {
              // Use hardcoded RPC URL
              const provider = new ethers.JsonRpcProvider(PULSECHAIN_MAINNET_RPC)
              const abi = [
                "function name() view returns (string)",
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
              ]
              const tokenContract = new ethers.Contract(newToken.address, abi, provider)

              const [name, symbol, decimals] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals(),
              ])

              tokenWithBalance = {
                ...tokenWithBalance,
                name,
                symbol,
                decimals: Number(decimals),
              }
            } catch (contractError) {
              console.error("Failed to fetch token details from contract:", contractError)
            }
          }
        }
      } catch (error) {
        console.error("Failed to verify token:", error)
        throw error
      }

      // Try to get logo from PulseX
      tokenWithBalance.logoURI = getTokenLogoUrl(newToken.address)

      if (address) {
        console.log(`Getting balance for custom token ${tokenWithBalance.symbol || "unknown"} (${newToken.address})`)
        tokenWithBalance.balance = isTestnet
          ? await getTestnetTokenBalance(newToken.address, address)
          : await getTokenBalance(newToken.address, address)
        console.log(`Balance: ${tokenWithBalance.balance}`)

        // Mark as detected if it has a balance
        const balanceNum = Number.parseFloat(tokenWithBalance.balance || "0")
        tokenWithBalance.detected = balanceNum > 0
      }

      // Get price data
      let price, priceChange

      if (isTestnet) {
        price = await getTestnetTokenPrice(newToken.address)
        priceChange = await getTestnetTokenPriceChange(newToken.address)
      } else {
        price = await getTokenPrice(newToken.address)
        priceChange = await getTokenPriceChange(newToken.address)
      }

      tokenWithBalance = {
        ...tokenWithBalance,
        price,
        priceChange,
        isTestnet,
      }

      // Ensure all BigInt values are converted to strings
      const safeToken = safeStringifyBigInt(tokenWithBalance)
      dispatch({ type: "ADD_TOKEN", payload: safeToken })

      // Save to localStorage
      const updatedTokens = [
        safeToken,
        ...state.tokens.filter((t) => t.address.toLowerCase() !== safeToken.address.toLowerCase()),
      ]
      saveTokensToLocalStorage(updatedTokens)

      return safeToken
    },
    [address, state.tokens, saveTokensToLocalStorage, isTestnet, dispatch],
  )

  // Reorder tokens
  const reorderTokens = useCallback(
    (reorderedTokens: Token[]) => {
      // Ensure all BigInt values are converted to strings
      const safeTokens = safeStringifyBigInt(reorderedTokens)
      dispatch({ type: "REORDER_TOKENS", payload: safeTokens })
      saveTokensToLocalStorage(safeTokens)
    },
    [saveTokensToLocalStorage, dispatch],
  )

  // Update token balance
  const updateTokenBalance = useCallback(
    (tokenAddress: string, balance: string) => {
      dispatch({
        type: "UPDATE_TOKEN_BALANCE",
        payload: { address: tokenAddress, balance },
      })
    },
    [dispatch],
  )

  // Update all token balances function with improved logging and error handling
  const updateAllTokenBalances = useCallback(async () => {
    if (!address || state.tokens.length === 0) {
      console.log("Cannot update balances: no address or no tokens")
      return
    }

    // Add a guard to prevent concurrent calls
    if (isUpdatingBalances.current) {
      console.log("Already updating balances, skipping")
      return
    }

    isUpdatingBalances.current = true

    try {
      console.log(`Updating all token balances for ${isTestnet ? "testnet" : "mainnet"} address: ${address}`)
      console.log(`Total tokens to check: ${state.tokens.length}`)

      // Create a copy of the tokens array to track track updates
      const updatedTokens = [...state.tokens]
      let hasUpdates = false
      let successCount = 0
      let errorCount = 0

      // Process tokens one by one to better identify issues
      for (let i = 0; i < updatedTokens.length; i++) {
        const token = updatedTokens[i]
        try {
          console.log(`Fetching balance for token: ${token.symbol} (${token.address})`)

          let balance
          if (isTestnet) {
            // For testnet tokens, use the testnet balance function
            balance = await getTestnetTokenBalance(token.address, address)
            console.log(`Testnet balance for ${token.symbol}: ${balance}`)
          } else {
            // For mainnet tokens, use the mainnet balance function
            balance = await getTokenBalance(token.address, address)
            console.log(`Mainnet balance for ${token.symbol}: ${balance}`)
          }

          // Convert balance to number for comparison
          const balanceNum = Number.parseFloat(balance)

          // Only update if the balance has changed
          if (balance !== token.balance) {
            updatedTokens[i] = {
              ...token,
              balance,
              detected: balanceNum > 0,
            }
            hasUpdates = true
            console.log(`Updated balance for ${token.symbol}: ${balance} (was: ${token.balance || "0"})`)
          }
          successCount++
        } catch (error) {
          console.error(`Failed to update balance for ${token.symbol}:`, error)
          errorCount++
        }
      }

      console.log(`Balance update complete: ${successCount} successful, ${errorCount} failed`)

      // Update all tokens at once if there were changes
      if (hasUpdates) {
        console.log("Updating token state with new balances")
        dispatch({ type: "SET_TOKENS", payload: updatedTokens })

        // Save updated tokens
        saveTokensToLocalStorage(updatedTokens)
      } else {
        console.log("No balance changes detected")
      }

      return updatedTokens
    } catch (error) {
      console.error("Failed to update token balances:", error)
    } finally {
      isUpdatingBalances.current = false
    }
  }, [address, state.tokens, isTestnet, dispatch, saveTokensToLocalStorage])

  // Add this useEffect to update balances when address changes
  useEffect(() => {
    let isMounted = true

    if (address && isConnected && state.tokens.length > 0) {
      // Use a timeout to prevent immediate execution which could cause loops
      const timer = setTimeout(() => {
        if (isMounted) {
          console.log(`Address changed or connected, updating token balances for ${isTestnet ? "testnet" : "mainnet"}`)
          updateAllTokenBalances()
            .then(() => {
              console.log("Token balances updated after address change")
            })
            .catch(console.error)
        }
      }, 1000)

      return () => {
        clearTimeout(timer)
        isMounted = false
      }
    }

    return () => {
      isMounted = false
    }
  }, [address, isConnected, updateAllTokenBalances, isTestnet, state.tokens])

  return (
    <TokenContext.Provider
      value={{
        tokens: state.tokens,
        isLoading: state.isLoading,
        refreshTokens,
        addCustomToken,
        reorderTokens,
        updateTokenBalance,
        updateAllTokenBalances,
        isTestnet,
        detectWalletTokens,
      }}
    >
      {children}
    </TokenContext.Provider>
  )
}

// Custom hook to use the token context
export function useTokens() {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error("useTokens must be used within a TokenProvider")
  }
  return context
}
