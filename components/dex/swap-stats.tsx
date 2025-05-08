"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { formatCurrency, formatPercentage } from "@/lib/swap-utils"
import { InfoIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Token } from "@/types/token"
import { SwapWarning } from "./swap-warning"

interface SwapStatsProps {
  fromToken: Token
  toToken: Token
  fromAmount: string
  toAmount: string
  priceImpact: number | null
  slippage: number
  onSlippageChange?: (value: number) => void
  executionPrice?: number
  marketPrice?: number
  isTestnet?: boolean
  routeDescription?: string
  isMultiAsset?: boolean
}

export default function SwapStats({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  priceImpact,
  slippage,
  onSlippageChange,
  executionPrice,
  marketPrice,
  isTestnet = false,
  routeDescription,
  isMultiAsset = false,
}: SwapStatsProps) {
  const [customSlippage, setCustomSlippage] = useState<number>(slippage)

  // Handle slippage change
  const handleSlippageChange = (value: number[]) => {
    const newSlippage = value[0]
    setCustomSlippage(newSlippage)
    if (onSlippageChange) {
      onSlippageChange(newSlippage)
    }
  }

  // Calculate minimum received amount
  const minReceived = Number.parseFloat(toAmount) * (1 - slippage / 100)

  // Format price impact color based on severity
  const getPriceImpactColor = () => {
    if (!priceImpact) return "text-gray-500"
    if (priceImpact < 1) return "text-green-500"
    if (priceImpact < 3) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <div className="space-y-3 bg-[#0a0a0a] border border-[#333] rounded-md p-3 text-sm">
      {/* Add warning for problematic pairs */}
      <SwapWarning fromToken={fromToken} toToken={toToken} />

      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-gray-400">Price</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 ml-1 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">The current exchange rate between tokens</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-right">
          <div>
            {executionPrice
              ? `1 ${fromToken.symbol} = ${formatCurrency(executionPrice.toString())} ${toToken.symbol}`
              : "-"}
          </div>
          <div className="text-xs text-gray-500">
            {marketPrice && marketPrice !== executionPrice
              ? `Market: 1 ${fromToken.symbol} = ${formatCurrency(marketPrice.toString())} ${toToken.symbol}`
              : ""}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-gray-400">Price Impact</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 ml-1 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">The difference between the market price and estimated price due to trade size</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className={getPriceImpactColor()}>
          {priceImpact !== null ? formatPercentage(priceImpact.toString()) : "-"}
        </div>
      </div>

      {routeDescription && (
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-gray-400">Route</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-3 w-3 ml-1 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">The path your swap will take through liquidity pools</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-gray-300">{routeDescription}</div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-gray-400">Minimum Received</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 ml-1 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">The minimum amount you will receive after slippage</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div>
          {formatCurrency(minReceived.toString())} {toToken.symbol}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-gray-400">Slippage Tolerance</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 ml-1 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">The maximum price change you're willing to accept</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div>{slippage}%</div>
      </div>

      {onSlippageChange && (
        <div className="pt-2">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-400">Adjust Slippage</span>
            <span className="text-xs text-gray-400">{customSlippage}%</span>
          </div>
          <Slider
            value={[customSlippage]}
            min={0.1}
            max={5}
            step={0.1}
            onValueChange={handleSlippageChange}
            className="w-full"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>0.1%</span>
            <span>5%</span>
          </div>
        </div>
      )}
    </div>
  )
}
