"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Check, ChevronDown, RefreshCw, Copy, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ethers } from "ethers"
import type { Token } from "@/types/token"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useTokens } from "@/lib/contexts/token-context"
import { getTokenLogoUrl, getTokenLogoWithFallback } from "@/lib/token-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TokenSelectorProps {
  selectedToken: Token | null
  onSelectToken: (token: Token) => void
  tokens: Token[] | undefined
  showCopyAddress?: boolean
  isTestnet?: boolean
}

export default function TokenSelector({
  selectedToken,
  onSelectToken,
  tokens = [],
  showCopyAddress = true,
  isTestnet = false,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [isAddressMode, setIsAddressMode] = useState(false)
  const [customAddress, setCustomAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const { addCustomToken } = useTokens()

  const selectorId = `token-selector-${selectedToken?.address || "empty"}`

  // Load token logos with fallback
  useEffect(() => {
    const loadTokenLogos = async () => {
      const newLogoUrls: Record<string, string> = {}

      // Load selected token logo if available
      if (selectedToken) {
        try {
          const logoUrl = await getTokenLogoWithFallback(selectedToken)
          newLogoUrls[selectedToken.address] = logoUrl
        } catch (error) {
          console.error(`Failed to load logo for ${selectedToken.symbol}:`, error)
        }
      }

      // Load logos for tokens in the dropdown (limit to visible ones)
      const visibleTokens = tokens.slice(0, 20)
      for (const token of visibleTokens) {
        if (!newLogoUrls[token.address]) {
          try {
            const logoUrl = await getTokenLogoWithFallback(token)
            newLogoUrls[token.address] = logoUrl
          } catch (error) {
            console.error(`Failed to load logo for ${token.symbol}:`, error)
          }
        }
      }

      setLogoUrls((prev) => ({ ...prev, ...newLogoUrls }))
    }

    loadTokenLogos()
  }, [selectedToken, tokens])

  // Setup drop zone for token drag and drop
  useEffect(() => {
    const selectorElement = document.getElementById(selectorId)

    if (selectorElement) {
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault()
        selectorElement.classList.add("border-[#ff0099]")
      }

      const handleDragLeave = () => {
        selectorElement.classList.remove("border-[#ff0099]")
      }

      const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        selectorElement.classList.remove("border-[#ff0099]")

        try {
          const data = e.dataTransfer?.getData("text/plain")
          if (data) {
            const tokenData = JSON.parse(data)
            const token = tokens.find((t) => t.address === tokenData.address)
            if (token) {
              onSelectToken(token)
            }
          }
        } catch (error) {
          console.error("Error processing dropped token:", error)
        }
      }

      selectorElement.addEventListener("dragover", handleDragOver)
      selectorElement.addEventListener("dragleave", handleDragLeave)
      selectorElement.addEventListener("drop", handleDrop)

      return () => {
        selectorElement.removeEventListener("dragover", handleDragOver)
        selectorElement.removeEventListener("dragleave", handleDragLeave)
        selectorElement.removeEventListener("drop", handleDrop)
      }
    }
  }, [selectedToken, tokens, onSelectToken, selectorId])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)

    // Check if the input looks like an Ethereum address
    if (value.startsWith("0x") && value.length >= 10) {
      setIsAddressMode(true)
      setCustomAddress(value)
    } else {
      setIsAddressMode(false)
    }
  }

  const copyToClipboard = (text: string) => {
    if (text === "NATIVE") {
      // For native token, we don't copy anything
      return
    }
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: "Address Copied",
      description: "Token address copied to clipboard",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchTokenByAddress = async () => {
    if (!ethers.isAddress(customAddress)) {
      setError("Invalid address format")
      return
    }

    // Check if token already exists in the list
    const normalizedAddress = ethers.getAddress(customAddress)
    const existingToken = tokens.find((t) => t.address.toLowerCase() === normalizedAddress.toLowerCase())

    if (existingToken) {
      onSelectToken(existingToken)
      setOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Use the context's addCustomToken function
      const newToken = await addCustomToken({
        address: normalizedAddress,
        symbol: "", // These will be filled by the context
        name: "",
        decimals: 18,
        logoURI: null,
        isTestnet,
      })

      onSelectToken(newToken)
      setOpen(false)
    } catch (error) {
      console.error("Failed to fetch token:", error)
      setError(
        `Failed to fetch token. Make sure the address is correct and exists on ${
          isTestnet ? "PulseChain Testnet" : "PulseChain"
        }.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Get logo URL with fallback
  const getLogoUrl = (token: Token) => {
    // If we have a cached URL, use it
    if (logoUrls[token.address]) {
      return logoUrls[token.address]
    }

    // Otherwise use the token's logoURI or the default URL
    return token.logoURI || getTokenLogoUrl(token.address, token.symbol)
  }

  // Handle image error
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

  // Filter tokens based on search
  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchValue.toLowerCase()) ||
      token.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (token.address !== "NATIVE" && token.address.toLowerCase().includes(searchValue.toLowerCase())),
  )

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[140px] justify-between bg-[#1a1a1a] border-[#333] hover:bg-[#333]"
            id={selectorId}
          >
            {selectedToken ? (
              <>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={getLogoUrl(selectedToken) || "/placeholder.svg"}
                      alt={selectedToken.symbol}
                      width={20}
                      height={20}
                      className="object-contain"
                      onError={(e) => handleImageError(e, selectedToken)}
                    />
                  </div>
                  <span>{selectedToken.symbol}</span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </>
            ) : (
              <>
                <span>Select token</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-[#1a1a1a] border-[#333] z-[100]">
          <div className="p-2 border-b border-[#333]">
            <Input
              placeholder="Search token or paste address..."
              value={searchValue}
              onChange={handleSearchChange}
              className="bg-[#0a0a0a] border-[#333]"
            />
          </div>

          {isAddressMode ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Token Address</Label>
                <Input
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                className="w-full bg-[#ff0099] hover:bg-[#cc0077]"
                onClick={fetchTokenByAddress}
                disabled={isLoading || !customAddress}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Import Token"
                )}
              </Button>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto py-1">
              {filteredTokens.length === 0 ? (
                <div className="py-6 text-center text-sm">No token found. Try searching by address.</div>
              ) : (
                filteredTokens.map((token) => (
                  <div
                    key={token.address}
                    className="flex items-center justify-between px-4 py-2 hover:bg-[#333] cursor-pointer"
                    onClick={() => {
                      onSelectToken(token)
                      setOpen(false)
                    }}
                  >
                    <div className="flex items-center">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={getLogoUrl(token) || "/placeholder.svg"}
                          alt={token.symbol}
                          className="h-full w-full object-cover"
                          onError={(e) => handleImageError(e, token)}
                        />
                      </div>
                      <div className="flex flex-col ml-2">
                        <span className="text-white">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">{token.name}</span>
                      </div>
                    </div>
                    {selectedToken?.address === token.address && <Check className="h-4 w-4" />}
                  </div>
                ))
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Copy Address Button - Don't show for native token */}
      {showCopyAddress && selectedToken && selectedToken.address !== "NATIVE" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-1"
                onClick={() => copyToClipboard(selectedToken.address)}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? "Copied!" : "Copy address"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
