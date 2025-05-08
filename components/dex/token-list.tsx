"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Token } from "@/types/token"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, GripVertical, Plus, ExternalLink, HelpCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ethers } from "ethers"
import {
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useToast } from "@/hooks/use-toast"
import { useTokens } from "@/lib/contexts/token-context"
import { getTokenLogoUrl, getTokenLogoWithFallback, SPECIAL_TOKENS, SPECIAL_TOKEN_LOGOS } from "@/lib/token-icons"
// Import the direct verification function
import { directVerifyTokenOnPulseChain } from "@/lib/direct-chain-verification"

// Add this function near the top of the file, after the imports
function isInvalidToken(token: Token): boolean {
  // Check if the token has missing critical information
  const hasNoSymbol = !token.symbol || token.symbol === "Unknown" || token.symbol === "Loading..."
  const hasNoName = !token.name || token.name === "Unknown Token"
  const hasNoLogo = !token.logoURI || token.logoURI.includes("placeholder")
  const hasNoPrice = token.price === null || token.price === undefined

  // Native token is always valid
  if (token.address === "NATIVE") return false

  // Consider a token invalid if it's missing multiple critical pieces of information
  return (hasNoSymbol && hasNoLogo) || (hasNoSymbol && hasNoPrice) || (hasNoLogo && hasNoPrice)
}

interface TokenListProps {
  tokens: Token[]
  isLoading: boolean
  onRefresh?: () => Promise<void>
  onTokensReorder?: (tokens: Token[]) => void
  onAddCustomToken?: (token: Token) => void
  onRemoveToken?: (tokenAddress: string) => void // Add this prop
  isTestnet?: boolean
}

// Modify the SortableTokenItem component to handle invalid tokens
function SortableTokenItem({
  token,
  isTestnet = false,
  onRemoveToken,
}: {
  token: Token
  isTestnet?: boolean
  onRemoveToken?: (address: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: token.address })
  const [showTooltip, setShowTooltip] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string>(token.logoURI || getTokenLogoUrl(token.address, token.symbol))
  const [isInvalid, setIsInvalid] = useState(isInvalidToken(token))
  const { toast } = useToast()

  // Check if token is invalid after a short delay to allow for data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      const invalid = isInvalidToken(token)
      setIsInvalid(invalid)

      // Auto-remove invalid tokens after a delay
      if (invalid && onRemoveToken) {
        toast({
          title: "Invalid Token Detected",
          description: `The token ${token.symbol || token.address.substring(0, 8)} appears to be invalid and will be removed.`,
          variant: "destructive",
        })

        // Remove after showing the toast
        setTimeout(() => {
          onRemoveToken(token.address)
        }, 3000)
      }
    }, 5000) // Give it 5 seconds to load data

    return () => clearTimeout(timer)
  }, [token, onRemoveToken, toast])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : isInvalid ? 0.4 : 1,
  }

  // Load logo with fallback on mount
  useEffect(() => {
    const loadLogoWithFallback = async () => {
      try {
        const url = await getTokenLogoWithFallback(token)
        setLogoUrl(url)
      } catch (error) {
        console.error(`Failed to load logo for ${token.symbol}:`, error)
      }
    }

    loadLogoWithFallback()
  }, [token])

  // Format price for display with smaller font for zero count
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return "—"

    // Special handling for very small numbers (more than 4 decimal places)
    if (price > 0 && price < 0.0001) {
      // Count leading zeros after decimal
      const priceStr = price.toString()

      // Handle scientific notation (like 3.00e-4)
      if (priceStr.includes("e")) {
        const [mantissa, exponent] = priceStr.split("e")
        const exponentNum = Number.parseInt(exponent, 10)
        const leadingZeros = Math.abs(exponentNum) - 1

        // Get first significant digit
        const firstDigit = mantissa.replace(".", "")[0]
        const secondDigit = mantissa.replace(".", "")[1] || "0"
        const thirdDigit = mantissa.replace(".", "")[2] || "0"

        return (
          <span>
            ${`0.(0`}
            <span style={{ fontSize: "0.7em" }}>{leadingZeros}</span>
            {`${firstDigit}${secondDigit}${thirdDigit}`}
          </span>
        )
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

      // Format with smaller font for zero count
      const firstNonZeroDigit = decimalPart[leadingZeros]
      const secondDigit = decimalPart[leadingZeros + 1] || "0"
      const thirdDigit = decimalPart[leadingZeros + 2] || "0"

      return (
        <span>
          ${`0.(0`}
          <span style={{ fontSize: "0.7em" }}>{leadingZeros}</span>
          {`${firstNonZeroDigit}${secondDigit}${thirdDigit}`}
        </span>
      )
    }

    if (price < 0.001) return `$${price.toFixed(6)}`
    if (price < 0.01) return `$${price.toFixed(5)}`
    if (price < 0.1) return `$${price.toFixed(4)}`
    if (price < 1) return `$${price.toFixed(3)}`
    if (price < 10) return `$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
  }

  // Format balance for display
  const formatBalance = (balance: string | undefined) => {
    if (!balance) return "0.00"

    // Convert to number for comparison
    const balanceNum = Number.parseFloat(balance)

    // Handle zero balance
    if (balanceNum === 0) return "0.00"

    // Handle very small balances (show them as non-zero)
    if (balanceNum < 0.0001) {
      return "<0.0001"
    }

    // Format with appropriate precision
    return balanceNum.toFixed(4)
  }

  // Get the actual price for tooltip display
  const getFullPrice = (price: number | null) => {
    if (price === null || price === undefined) return "No price data available"
    return `$${price.toFixed(8)}`
  }

  // Get the full balance for tooltip display
  const getFullBalance = (balance: string | undefined) => {
    if (!balance) return "0"
    const balanceNum = Number.parseFloat(balance)
    if (balanceNum === 0) return "0"
    return balance
  }

  // Add a detected badge if token has been detected in wallet
  const detectedBadge = token.detected && (
    <div className="absolute -top-1 -left-1 bg-green-500 rounded-full w-3 h-3"></div>
  )

  // Handle image error
  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Remove the error handler to prevent infinite loops
    e.currentTarget.onerror = null

    // Check if this is a special token by address
    const normalizedAddress = token.address.toLowerCase()
    const specialTokenSymbol = Object.entries(SPECIAL_TOKENS).find(
      ([addr]) => addr.toLowerCase() === normalizedAddress,
    )?.[1]

    if (specialTokenSymbol && SPECIAL_TOKEN_LOGOS[specialTokenSymbol]) {
      // Use the special token logo directly
      setLogoUrl(SPECIAL_TOKEN_LOGOS[specialTokenSymbol])
      return
    }

    // Try to get a fallback URL
    try {
      const fallbackUrl = await getTokenLogoWithFallback(token)
      setLogoUrl(fallbackUrl)
    } catch (error) {
      console.error(`Failed to get fallback logo for ${token.symbol}:`, error)
      // Set to placeholder as last resort
      setLogoUrl(`/placeholder.svg?text=${token.symbol}`)
    }
  }

  const hasBalance = token.balance && Number.parseFloat(token.balance) > 0
  const isDraggable = !isTestnet || hasBalance // Only allow dragging tokens with balance in live mode

  // Add a warning badge for invalid tokens
  const invalidBadge = isInvalid && (
    <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center z-10">
      <AlertTriangle className="h-3 w-3 text-white" />
    </div>
  )

  // Add a remove button for invalid tokens in the tooltip
  const removeButton = isInvalid && onRemoveToken && (
    <Button
      variant="destructive"
      size="sm"
      className="mt-2 w-full"
      onClick={(e) => {
        e.stopPropagation()
        onRemoveToken(token.address)
        toast({
          title: "Token Removed",
          description: `The invalid token has been removed from your list.`,
        })
      }}
    >
      Remove Invalid Token
    </Button>
  )

  // Modify the return JSX to include the invalid badge and warning
  return (
    <TooltipProvider>
      <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            className={`flex flex-col items-center space-y-1 relative border border-transparent hover:border-[#333] p-2 rounded-lg transition-colors ${
              !isDraggable ? "opacity-50 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
            } ${isInvalid ? "border-red-500/30 bg-red-500/5" : ""}`}
            {...(isDraggable ? attributes : {})}
            data-token-address={token.address}
            data-token-symbol={token.symbol}
            data-token-decimals={token.decimals}
            data-token-balance={token.balance}
            data-draggable={isDraggable ? "true" : "false"}
            onClick={(e) => {
              // Prevent event propagation to avoid interference with drag handlers
              e.stopPropagation()
            }}
          >
            {/* Add the invalid badge */}
            {invalidBadge}

            {/* No balance indicator remains the same */}
            {!hasBalance && !isTestnet && (
              <div className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-white rotate-45 absolute"></div>
                  <div className="w-2 h-0.5 bg-white -rotate-45 absolute"></div>
                </div>
              </div>
            )}

            <div className="relative group">
              {detectedBadge}
              <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={logoUrl || "/placeholder.svg"}
                  alt={token.symbol}
                  width={48}
                  height={48}
                  className="object-contain"
                  onError={handleImageError}
                />
              </div>
              <div
                className="absolute -top-1 -right-1 bg-[#ff0099] rounded-full p-1 opacity-50 group-hover:opacity-100 transition-opacity cursor-grab"
                {...listeners}
              >
                <GripVertical className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="text-sm font-medium">{token.symbol || "Unknown"}</div>
            <div className="text-xs flex flex-col items-center">
              {/* Show price on mainnet, not on testnet */}
              {!isTestnet && <span className="text-muted-foreground">{formatPrice(token.price)}</span>}
              {/* Always show balance with better visibility */}
              <span className={`${Number(token.balance) > 0 ? "text-green-500 font-medium" : "text-muted-foreground"}`}>
                {formatBalance(token.balance)}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-[#333] border-[#555] text-white p-3 max-w-[250px] rounded-md shadow-lg"
        >
          <div className="space-y-1">
            <p className="font-medium">{token.name}</p>
            <p className="text-xs text-muted-foreground">
              {token.address === "NATIVE" ? "Native Token" : token.address}
            </p>
            {!isTestnet && token.price !== null && token.price !== undefined && (
              <p className="text-xs">Price: {getFullPrice(token.price)}</p>
            )}
            {token.balance && (
              <p className="text-xs">
                Balance:{" "}
                <span className={Number(token.balance) > 0 ? "text-green-500 font-medium" : ""}>
                  {getFullBalance(token.balance)}
                </span>
              </p>
            )}
            {token.address !== "NATIVE" && (
              <a
                href={`${
                  token.address.startsWith("0x")
                    ? (
                        token.isTestnet
                          ? "https://scan.v4.testnet.pulsechain.com/token/"
                          : "https://scan.pulsechain.com/token/"
                      ) + token.address
                    : "#"
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}

            {/* Add warning for invalid tokens */}
            {isInvalid && (
              <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30 text-xs">
                <p className="font-medium text-red-400">Invalid Token Detected</p>
                <p className="mt-1">This token appears to be invalid or from a different blockchain.</p>
              </div>
            )}

            {/* Add the remove button */}
            {removeButton}
          </div>
          <img
            src={logoUrl || "/placeholder.svg"}
            alt={token.symbol}
            width={64}
            height={64}
            className="object-contain mt-2"
            onError={handleImageError}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Improved AddTokenDialog Component
function AddTokenDialog({
  onAddToken,
  isTestnet = false,
}: { onAddToken: (token: Token) => void; isTestnet?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tokenAddress, setTokenAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { addCustomToken } = useTokens()

  const handleAddToken = async () => {
    if (!ethers.isAddress(tokenAddress)) {
      setError("Please enter a valid token address")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Normalize the address to checksum format
      const checksumAddress = ethers.getAddress(tokenAddress)

      // Use our direct verification to ensure the token exists on PulseChain
      const { success, error: verificationError } = await directVerifyTokenOnPulseChain(checksumAddress, isTestnet)

      if (!success) {
        setError(verificationError || `Contract not found on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}.`)
        setIsLoading(false)
        return
      }

      // Use the context's addCustomToken function
      const newToken = await addCustomToken({
        address: checksumAddress,
        symbol: "", // These will be filled by the context
        name: "",
        decimals: 18,
        logoURI: null,
        isTestnet,
      })

      toast({
        title: "Token Added",
        description: `${newToken.symbol} has been added to your featured tokens.`,
      })

      // Call the callback if provided
      if (onAddToken) {
        onAddToken(newToken)
      }

      setOpen(false)
      setTokenAddress("")
    } catch (error) {
      console.error("Failed to add token:", error)
      setError(
        error instanceof Error
          ? error.message
          : `Failed to add token. Make sure the address is correct and the token exists on ${isTestnet ? "PulseChain Testnet" : "PulseChain"}.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 bg-[#1a1a1a] border-[#333] hover:bg-[#333]"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Token
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle>Add Custom Token</DialogTitle>
            <DialogDescription>
              Enter the token contract address to add it to your featured tokens list.
              {isTestnet && " This token will be available for swapping on the testnet."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tokenAddress">Token Address</Label>
              <Input
                id="tokenAddress"
                placeholder="0x..."
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddToken}
              disabled={isLoading || !tokenAddress}
              className="bg-[#ff0099] hover:bg-[#cc0077]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Add Token"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Add the removeToken function to the TokenList component
export default function TokenList({
  tokens,
  isLoading,
  onRefresh,
  onTokensReorder,
  onAddCustomToken,
  onRemoveToken, // Add this prop
  isTestnet = false,
}: TokenListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [featuredTokens, setFeaturedTokens] = useState<Token[]>([])
  const [showDetectedOnly, setShowDetectedOnly] = useState(false)
  const { toast } = useToast()
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialRefreshDoneRef = useRef(false)
  const { detectWalletTokens } = useTokens()

  // Add cleanup in a useEffect to clear the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current)
      }
    }
  }, [])

  // Update featured tokens when tokens change
  useEffect(() => {
    if (tokens.length > 0) {
      let tokensToShow = tokens

      // Filter tokens if showing detected only
      if (showDetectedOnly) {
        tokensToShow = tokens.filter((t) => t.detected || t.address === "NATIVE")
      }

      setFeaturedTokens(tokensToShow)
    }
  }, [tokens, showDetectedOnly])

  // Setup drag and drop for tokens to swap fields
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const draggable = target.closest('[data-draggable="true"]')

      if (draggable) {
        const tokenAddress = draggable.getAttribute("data-token-address")
        const tokenSymbol = draggable.getAttribute("data-token-symbol")
        const tokenDecimals = draggable.getAttribute("data-token-decimals")

        if (tokenAddress && tokenSymbol) {
          e.dataTransfer?.setData(
            "text/plain",
            JSON.stringify({
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: tokenDecimals,
            }),
          )

          // Create a custom drag image
          const dragImage = document.createElement("div")
          dragImage.className = "bg-[#1a1a1a] border border-[#333] rounded-md p-2 text-white"
          dragImage.textContent = tokenSymbol
          document.body.appendChild(dragImage)
          dragImage.style.position = "absolute"
          dragImage.style.top = "-1000px"

          e.dataTransfer?.setDragImage(dragImage, 0, 0)

          setTimeout(() => {
            document.body.removeChild(dragImage)
          }, 0)
        }
      }
    }

    // Add event listeners for drag and drop
    document.addEventListener("dragstart", handleDragStart)

    return () => {
      document.removeEventListener("dragstart", handleDragStart)
    }
  }, [])

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return

    setIsRefreshing(true)
    try {
      // First detect wallet tokens to find which ones we have
      try {
        await detectWalletTokens()
      } catch (error) {
        console.error("Failed to detect wallet tokens:", error)
      }

      // Then do the regular refresh
      await onRefresh()

      toast({
        title: "Tokens Refreshed",
        description: "Token balances and prices have been updated.",
      })
    } catch (error) {
      console.error("Failed to refresh tokens:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to update token information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setFeaturedTokens((items) => {
        const oldIndex = items.findIndex((item) => item.address === active.id)
        const newIndex = items.findIndex((item) => item.address === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Notify parent component if callback provided, but debounce to prevent rapid updates
        if (onTokensReorder) {
          // Clear any existing timeout
          if (reorderTimeoutRef.current) {
            clearTimeout(reorderTimeoutRef.current)
          }

          // Set a new timeout to call onTokensReorder after a delay
          reorderTimeoutRef.current = setTimeout(() => {
            onTokensReorder(newItems)
          }, 500) // 500ms debounce
        }

        return newItems
      })
    }
  }

  // Handle adding a custom token
  const handleAddCustomToken = (newToken: Token) => {
    if (onAddCustomToken) {
      onAddCustomToken(newToken)
    }
  }

  // Add a function to handle token removal
  const handleRemoveToken = useCallback(
    (tokenAddress: string) => {
      if (onRemoveToken) {
        onRemoveToken(tokenAddress)
      } else if (onTokensReorder) {
        // If no specific removal function is provided, use reordering to filter out the token
        const updatedTokens = tokens.filter((token) => token.address !== tokenAddress)
        onTokensReorder(updatedTokens)
      }
    },
    [onRemoveToken, onTokensReorder, tokens],
  )

  // Toggle between showing all tokens and only detected tokens
  const toggleDetectedOnly = () => {
    setShowDetectedOnly(!showDetectedOnly)
  }

  if (isLoading) {
    return (
      <div className="py-2">
        <ScrollArea className="whitespace-nowrap rounded-md border border-[#333]">
          <div className="flex w-max space-x-4 p-4">
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex flex-col items-center space-y-1">
                  <Skeleton className="h-12 w-12 rounded-full bg-[#333]" />
                  <Skeleton className="h-4 w-20 bg-[#333]" />
                  <Skeleton className="h-4 w-16 bg-[#333]" />
                </div>
              ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    )
  }

  // Update the SortableTokenItem rendering to pass the removal function
  return (
    <div className="py-2">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="flex items-center">
          <h3 className="text-sm font-medium">
            Featured Tokens
            {isTestnet && <span className="text-xs text-muted-foreground ml-1">(drag to reorder)</span>}
          </h3>
          <div className="relative inline-block">
            <button
              className="h-5 w-5 ml-1 p-0 rounded-full hover:bg-muted flex items-center justify-center"
              onMouseEnter={() => (document.getElementById("custom-tooltip")!.style.display = "block")}
              onMouseLeave={() => (document.getElementById("custom-tooltip")!.style.display = "none")}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div
              id="custom-tooltip"
              className="absolute left-0 top-6 z-50 w-64 p-2 bg-[#333] border border-[#555] rounded text-white text-xs shadow-lg"
              style={{ display: "none" }}
            >
              Import tokens to personalise your featured tokens list. You can drag and drop tokens from here to the swap
              fields for the most up-to-date balances.
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <AddTokenDialog onAddToken={handleAddCustomToken} isTestnet={isTestnet} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-2 bg-[#1a1a1a] border-[#333] hover:bg-[#333]"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>
      <div className="text-xs text-center text-muted-foreground mb-2">
        Drag tokens from here to the swap fields below
      </div>
      <ScrollArea className="whitespace-nowrap rounded-md border border-[#333]">
        <div className="flex w-max space-x-4 p-4">
          {featuredTokens.length === 0 && !isTestnet ? (
            <div className="flex items-center justify-center w-full py-4 text-muted-foreground">
              <p>No tokens added yet. Click "Add Token" to get started.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={featuredTokens.map((token) => token.address)}
                strategy={horizontalListSortingStrategy}
              >
                {featuredTokens.map((token) => (
                  <SortableTokenItem
                    key={token.address}
                    token={token}
                    isTestnet={isTestnet}
                    onRemoveToken={handleRemoveToken}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
