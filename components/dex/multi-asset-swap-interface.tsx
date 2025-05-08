"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWeb3 } from "@/hooks/use-web3"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import { useToast } from "@/hooks/use-toast"
import { ArrowDown, Trash2, Plus } from "lucide-react"
import type { Token } from "@/types/token"
import { useTokens } from "@/lib/contexts/token-context"
import TokenSelector from "./token-selector"
import { getTokenLogoWithFallback } from "@/lib/token-icons"
import SwapStats from "./swap-stats"
import { calculateMultiSwapOutput, setMaxAmount } from "@/lib/multi-swap-calculator"

interface TokenInput {
  token: Token | null
  amount: string
  id: string
}

interface MultiAssetSwapInterfaceProps {
  isTestnet?: boolean
}

export default function MultiAssetSwapInterface({ isTestnet = false }: MultiAssetSwapInterfaceProps) {
  const web3 = useWeb3()
  const testnetWeb3 = useTestnetWeb3()
  const { address, signer } = isTestnet ? testnetWeb3 : web3
  const { tokens, refreshTokens, updateTokenBalance } = useTokens()
  const [inputTokens, setInputTokens] = useState<TokenInput[]>([{ token: null, amount: "", id: `input-1` }])
  const [outputToken, setOutputToken] = useState<Token | null>(null)
  const [outputAmount, setOutputAmount] = useState("")
  const [slippage, setSlippage] = useState(0.25)
  const [priceImpact, setPriceImpact] = useState<number | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)
  const [executionPrice, setExecutionPrice] = useState<number | undefined>(undefined)
  const [routeDescription, setRouteDescription] = useState<string | undefined>(undefined)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const MAX_INPUT_TOKENS = 5

  // Set initial tokens when tokens are loaded
  useEffect(() => {
    if (tokens.length > 0) {
      // Set default input token if not set
      if (!inputTokens[0].token && tokens.length >= 1) {
        const newInputTokens = [...inputTokens]
        newInputTokens[0].token = tokens[0]
        setInputTokens(newInputTokens)
      }

      // Set default output token if not set
      if (!outputToken && tokens.length >= 2) {
        setOutputToken(tokens[1])
      }
    }
  }, [tokens, inputTokens, outputToken])

  // Load token logos with fallback
  useEffect(() => {
    const loadTokenLogos = async () => {
      const newLogoUrls: Record<string, string> = {}

      // Load output token logo if available
      if (outputToken) {
        try {
          const logoUrl = await getTokenLogoWithFallback(outputToken)
          newLogoUrls[outputToken.address] = logoUrl
        } catch (error) {
          console.error(`Failed to load logo for ${outputToken.symbol}:`, error)
        }
      }

      // Load logos for input tokens
      for (const input of inputTokens) {
        if (input.token && !newLogoUrls[input.token.address]) {
          try {
            const logoUrl = await getTokenLogoWithFallback(input.token)
            newLogoUrls[input.token.address] = logoUrl
          } catch (error) {
            console.error(`Failed to load logo for ${input.token.symbol}:`, error)
          }
        }
      }

      setLogoUrls((prev) => ({ ...prev, ...newLogoUrls }))
    }

    loadTokenLogos()
  }, [outputToken, inputTokens])

  // Calculate output amount whenever inputs or output token changes
  useEffect(() => {
    calculateOutput()
  }, [inputTokens, outputToken])

  const handleSlippageChange = (value: number) => {
    setSlippage(value)
  }

  const handleInputTokenSelect = (token: Token, index: number) => {
    const newInputTokens = [...inputTokens]
    newInputTokens[index].token = token
    setInputTokens(newInputTokens)
  }

  const handleOutputTokenSelect = (token: Token) => {
    setOutputToken(token)
  }

  const handleInputAmountChange = (amount: string, index: number) => {
    const newInputTokens = [...inputTokens]
    newInputTokens[index].amount = amount
    setInputTokens(newInputTokens)
  }

  // Calculate output amount based on inputs and output token
  const calculateOutput = () => {
    if (!outputToken) return

    // Check if we have at least one valid input
    const hasValidInput = inputTokens.some(
      (input) => input.token && input.amount && Number.parseFloat(input.amount) > 0,
    )

    if (!hasValidInput) {
      setOutputAmount("")
      setPriceImpact(null)
      setExecutionPrice(undefined)
      setRouteDescription(undefined)
      return
    }

    // Calculate output using our calculator
    const result = calculateMultiSwapOutput(
      inputTokens.filter((input) => input.token) as { token: Token; amount: string }[],
      outputToken,
    )

    if (result) {
      setOutputAmount(result.outputAmount)
      setPriceImpact(result.priceImpact)
      setExecutionPrice(result.executionPrice)
      setRouteDescription(result.routeDescription)
    } else {
      setOutputAmount("")
      setPriceImpact(null)
      setExecutionPrice(undefined)
      setRouteDescription(undefined)
    }
  }

  const addInputToken = () => {
    if (inputTokens.length < MAX_INPUT_TOKENS) {
      const newId = `input-${Date.now()}`
      setInputTokens([...inputTokens, { token: null, amount: "", id: newId }])
    }
  }

  const removeInputToken = (index: number) => {
    if (inputTokens.length <= 1) return // Keep at least one input

    const newInputTokens = [...inputTokens]
    newInputTokens.splice(index, 1)
    setInputTokens(newInputTokens)
  }

  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement>, token: Token) => {
    // Remove the error handler to prevent infinite loops
    e.currentTarget.onerror = null

    // Try to get a fallback URL
    try {
      const fallbackUrl = await getTokenLogoWithFallback(token)
      setLogoUrls((prev) => ({ ...prev, [token.address]: fallbackUrl }))
    } catch (error) {
      console.error(`Failed to get fallback logo for ${token.symbol}:`, error)
    }
  }

  const getLogoUrl = (token: Token) => {
    // If we have a cached URL, use it
    if (logoUrls[token.address]) {
      return logoUrls[token.address]
    }

    // Otherwise use the token's logoURI or the default URL
    return token.logoURI || `/placeholder.svg?text=${token.symbol}`
  }

  // Handle MAX button click
  const handleMaxClick = (index: number) => {
    const input = inputTokens[index]
    if (!input.token) return

    // Set the input amount to the token's balance
    const maxAmount = setMaxAmount(input.token)

    const newInputTokens = [...inputTokens]
    newInputTokens[index].amount = maxAmount
    setInputTokens(newInputTokens)
  }

  const handleSwap = async () => {
    if (!outputToken) return

    // Filter valid inputs
    const validInputs = inputTokens.filter(
      (input) => input.token && input.amount && Number.parseFloat(input.amount) > 0,
    )

    if (validInputs.length === 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter at least one token amount",
        variant: "destructive",
      })
      return
    }

    if (!address || !signer) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to swap",
        variant: "destructive",
      })
      return
    }

    setIsSwapping(true)

    try {
      // Simulate swap process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Update token balances (simulated)
      for (const input of validInputs) {
        if (input.token) {
          const currentBalance = Number.parseFloat(input.token.balance || "0")
          const newBalance = Math.max(0, currentBalance - Number.parseFloat(input.amount)).toString()
          updateTokenBalance(input.token.address, newBalance)
        }
      }

      if (outputToken) {
        const currentBalance = Number.parseFloat(outputToken.balance || "0")
        const newBalance = (currentBalance + Number.parseFloat(outputAmount)).toString()
        updateTokenBalance(outputToken.address, newBalance)
      }

      toast({
        title: "Swap Successful",
        description: `Successfully swapped multiple tokens for ${outputAmount} ${outputToken.symbol}`,
      })

      // Reset form
      setInputTokens([{ token: tokens[0], amount: "", id: `input-${Date.now()}` }])
      setOutputAmount("")

      // Refresh token data
      refreshTokens()
    } catch (error) {
      console.error("Swap failed:", error)
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "An error occurred during the swap",
        variant: "destructive",
      })
    } finally {
      setIsSwapping(false)
    }
  }

  return (
    <div className="space-y-4 bg-[#111] p-4 rounded-lg border border-[#333]">
      {/* Input Tokens Section */}
      <div className="space-y-3">
        {inputTokens.map((input, index) => (
          <div key={input.id} className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor={`input-amount-${index}`}>{index === 0 ? "From" : `Input ${index + 1}`}</Label>
              {input.token && (
                <span className="text-sm text-muted-foreground">
                  Balance: {input.token.balance ? Number.parseFloat(input.token.balance).toFixed(6) : "0.00"}
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <div className="flex flex-1 items-center space-x-2 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2">
                <Input
                  type="number"
                  id={`input-amount-${index}`}
                  placeholder="0.00"
                  value={input.amount}
                  onChange={(e) => handleInputAmountChange(e.target.value, index)}
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {input.token && (
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={input.token ? getLogoUrl(input.token) : "/placeholder.svg"}
                        alt={input.token?.symbol || "Token"}
                        className="h-full w-full object-cover"
                        onError={(e) => input.token && handleImageError(e, input.token)}
                      />
                    </div>
                    <span className="font-medium">{input.token.symbol}</span>
                    {/* MAX button */}
                    {input.token.balance && Number.parseFloat(input.token.balance) > 0 && (
                      <button
                        onClick={() => handleMaxClick(index)}
                        className="text-xs font-medium text-green-500 hover:text-green-400"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                )}
                {!input.token && <div className="text-sm text-muted-foreground">Select token</div>}
              </div>
              <div className="flex space-x-2">
                <TokenSelector
                  selectedToken={input.token}
                  onSelectToken={(token) => handleInputTokenSelect(token, index)}
                  tokens={tokens}
                  showCopyAddress={false}
                  isTestnet={isTestnet}
                />
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInputToken(index)}
                    className="h-10 w-10 hover:bg-[#333] hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add token button - only show if less than MAX_INPUT_TOKENS */}
      {inputTokens.length < MAX_INPUT_TOKENS && (
        <Button
          variant="outline"
          size="sm"
          onClick={addInputToken}
          className="w-full mt-2 bg-[#1a1a1a] border-[#333] hover:bg-[#333]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Input Token
        </Button>
      )}

      {/* Swap Direction Button */}
      <div className="flex justify-center">
        <div className="bg-[#1a1a1a] rounded-full p-2">
          <ArrowDown className="h-4 w-4" />
        </div>
      </div>

      {/* Output Token Section */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="outputToken">To</Label>
          {outputToken && (
            <span className="text-sm text-muted-foreground">
              Balance: {outputToken.balance ? Number.parseFloat(outputToken.balance).toFixed(6) : "0.00"}
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-1 items-center space-x-2 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2">
            <Input
              type="number"
              id="outputToken"
              placeholder="0.00"
              value={outputAmount}
              className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled
            />
            {outputToken && (
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                  <img
                    src={outputToken ? getLogoUrl(outputToken) : "/placeholder.svg"}
                    alt={outputToken?.symbol || "Token"}
                    className="h-full w-full object-cover"
                    onError={(e) => outputToken && handleImageError(e, outputToken)}
                  />
                </div>
                <span className="font-medium">{outputToken.symbol}</span>
              </div>
            )}
            {!outputToken && <div className="text-sm text-muted-foreground">Select token</div>}
          </div>
          <TokenSelector
            selectedToken={outputToken}
            onSelectToken={handleOutputTokenSelect}
            tokens={tokens}
            showCopyAddress={false}
            isTestnet={isTestnet}
          />
        </div>
      </div>

      {/* Swap Stats */}
      {outputToken && outputAmount && (
        <SwapStats
          fromToken={inputTokens[0].token!}
          toToken={outputToken}
          fromAmount={inputTokens[0].amount}
          toAmount={outputAmount}
          priceImpact={priceImpact}
          slippage={slippage}
          onSlippageChange={handleSlippageChange}
          executionPrice={executionPrice}
          marketPrice={executionPrice}
          isTestnet={isTestnet}
          routeDescription={routeDescription}
          isMultiAsset={true}
        />
      )}

      {/* Swap Button */}
      <Button
        className="w-full bg-[#ff0099] hover:bg-[#cc0077]"
        onClick={handleSwap}
        disabled={
          !outputToken ||
          inputTokens.every((input) => !input.token || !input.amount || Number.parseFloat(input.amount) <= 0) ||
          !outputAmount ||
          isSwapping
        }
      >
        {isSwapping ? "Swapping..." : "Swap Multiple Tokens"}
      </Button>
    </div>
  )
}
