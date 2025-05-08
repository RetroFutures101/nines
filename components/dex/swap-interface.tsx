"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowDown, RefreshCw, Settings, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import TokenSelector from "./token-selector"
import SwapStats from "./swap-stats"
import { useWeb3 } from "@/hooks/use-web3"
import { getSwapQuote } from "@/lib/get-swap-quote"
import executeSwap from "@/lib/execute-swap"
import { FEATURED_TOKENS, NATIVE_PLS } from "@/lib/constants"
import { getTokenPrice } from "@/lib/price-service"
import type { Token } from "@/types/token"
import { formatCurrency } from "@/lib/swap-utils"

export default function SwapInterface() {
  // Web3 state
  const { isConnected, address, signer, chainId } = useWeb3()

  // Token state
  const [fromToken, setFromToken] = useState<Token>({
    ...NATIVE_PLS,
    price: null,
  })
  const [toToken, setToToken] = useState<Token>({
    symbol: "PLSX",
    name: "PulseX",
    address: FEATURED_TOKENS.PLSX,
    decimals: 18,
    logoURI: null,
    price: null,
  })

  // Amount state
  const [fromAmount, setFromAmount] = useState<string>("")
  const [toAmount, setToAmount] = useState<string>("")

  // Swap state
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false)
  const [isSwapping, setIsSwapping] = useState<boolean>(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapSuccess, setSwapSuccess] = useState<boolean>(false)
  const [slippage, setSlippage] = useState<number>(1.0) // Default 1% slippage
  const [path, setPath] = useState<string[]>([])
  const [priceImpact, setPriceImpact] = useState<number | null>(null)
  const [routeDescription, setRouteDescription] = useState<string | null>(null)
  const [actualOutputAmount, setActualOutputAmount] = useState<string | null>(null)
  const [routerAddress, setRouterAddress] = useState<string | null>(null)

  // Fetch token prices on mount
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [fromPrice, toPrice] = await Promise.all([
          getTokenPrice(fromToken.address),
          getTokenPrice(toToken.address),
        ])

        setFromToken((prev) => ({ ...prev, price: fromPrice }))
        setToToken((prev) => ({ ...prev, price: toPrice }))
      } catch (error) {
        console.error("Failed to fetch token prices:", error)
      }
    }

    fetchPrices()
  }, [fromToken.address, toToken.address])

  // Get swap quote when inputs change
  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || Number.parseFloat(fromAmount) === 0) {
        setToAmount("")
        setPath([])
        setPriceImpact(null)
        setRouteDescription(null)
        setRouterAddress(null)
        return
      }

      setIsLoadingQuote(true)
      setSwapError(null)

      try {
        const quote = await getSwapQuote(fromToken, toToken, fromAmount, slippage)

        if (quote.error) {
          setSwapError(quote.error)
          setToAmount("")
        } else {
          setToAmount(quote.outputAmount)
          setPath(quote.path)
          setPriceImpact(Number.parseFloat(quote.priceImpact))
          setRouteDescription(quote.routeDescription)
          setRouterAddress(quote.routerAddress)
        }
      } catch (error) {
        console.error("Failed to get swap quote:", error)
        setSwapError("Failed to get swap quote")
        setToAmount("")
      } finally {
        setIsLoadingQuote(false)
      }
    }

    // Debounce the quote request
    const timeoutId = setTimeout(() => {
      getQuote()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [fromToken, toToken, fromAmount, slippage])

  // Handle token swap
  const handleSwap = useCallback(async () => {
    if (!isConnected || !signer || !address) {
      setSwapError("Please connect your wallet")
      return
    }

    if (!fromAmount || Number.parseFloat(fromAmount) === 0) {
      setSwapError("Please enter an amount")
      return
    }

    if (!toAmount || Number.parseFloat(toAmount) === 0) {
      setSwapError("Invalid output amount")
      return
    }

    if (!path || path.length === 0) {
      setSwapError("No valid swap path found")
      return
    }

    setIsSwapping(true)
    setSwapError(null)
    setSwapSuccess(false)
    setActualOutputAmount(null)

    try {
      // Get a fresh quote to ensure accuracy
      const quote = await getSwapQuote(fromToken, toToken, fromAmount, slippage)

      if (quote.error) {
        throw new Error(quote.error)
      }

      // Calculate minimum output amount with slippage
      const minOutputAmount = (quote.outputAmountWei * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000)

      // Execute the swap
      const result = await executeSwap(
        fromToken,
        toToken,
        fromAmount,
        minOutputAmount,
        quote.path,
        address,
        signer,
        Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes deadline
        quote.routerAddress, // Use the router from the quote
      )

      if (result.success) {
        setSwapSuccess(true)
        if (result.actualOutputAmount) {
          setActualOutputAmount(result.actualOutputAmount)
        }
      } else {
        setSwapError(result.error || "Swap failed")
      }
    } catch (error) {
      console.error("Swap failed:", error)
      setSwapError(error instanceof Error ? error.message : "Swap failed")
    } finally {
      setIsSwapping(false)
    }
  }, [isConnected, signer, address, fromToken, toToken, fromAmount, toAmount, path, slippage])

  // Swap tokens
  const switchTokens = useCallback(() => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }, [fromToken, toToken, fromAmount, toAmount])

  return (
    <Card className="w-full max-w-md mx-auto bg-[#0a0a0a] border-[#333] text-white">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Swap</span>
          <Button variant="ghost" size="icon" onClick={() => setSlippage((prev) => (prev === 1 ? 5 : 1))}>
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="from-amount">From</Label>
            {fromToken.price && (
              <span className="text-xs text-gray-400">
                ≈ ${(Number.parseFloat(fromAmount || "0") * fromToken.price).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Input
                id="from-amount"
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-[#111] border-[#333] text-white"
              />
            </div>
            <TokenSelector selectedToken={fromToken} onSelectToken={setFromToken} otherToken={toToken} />
          </div>
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" onClick={switchTokens} className="rounded-full bg-[#111] hover:bg-[#222]">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="to-amount">To</Label>
            {toToken.price && toAmount && (
              <span className="text-xs text-gray-400">
                ≈ ${(Number.parseFloat(toAmount) * toToken.price).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              {isLoadingQuote ? (
                <Skeleton className="h-10 w-full bg-[#222]" />
              ) : (
                <Input
                  id="to-amount"
                  type="text"
                  placeholder="0.0"
                  value={toAmount}
                  readOnly
                  className="bg-[#111] border-[#333] text-white"
                />
              )}
            </div>
            <TokenSelector selectedToken={toToken} onSelectToken={setToToken} otherToken={fromToken} />
          </div>
        </div>

        {/* Route description */}
        {routeDescription && (
          <div className="text-xs text-gray-400">
            <span>Route: {routeDescription}</span>
          </div>
        )}

        {/* Swap stats */}
        {fromAmount && toAmount && !isLoadingQuote && (
          <SwapStats
            fromToken={fromToken}
            toToken={toToken}
            fromAmount={fromAmount}
            toAmount={toAmount}
            priceImpact={priceImpact}
            slippage={slippage}
            onSlippageChange={setSlippage}
            routeDescription={routeDescription || undefined}
          />
        )}

        {/* Actual output amount display */}
        {actualOutputAmount && (
          <Alert className="bg-green-900/20 border-green-800">
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Actual received:</span>
                <span className="font-bold">
                  {formatCurrency(actualOutputAmount)} {toToken.symbol}
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error message */}
        {swapError && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{swapError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          disabled={
            !isConnected ||
            isSwapping ||
            isLoadingQuote ||
            !fromAmount ||
            Number.parseFloat(fromAmount) === 0 ||
            !toAmount ||
            Number.parseFloat(toAmount) === 0
          }
          onClick={handleSwap}
        >
          {isSwapping ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          {!isConnected ? "Connect Wallet" : isSwapping ? "Swapping..." : "Swap"}
        </Button>
      </CardFooter>
    </Card>
  )
}
