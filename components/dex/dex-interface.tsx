"use client"
import { useWeb3 } from "@/hooks/use-web3"
import { Card, CardContent } from "@/components/ui/card"
import MultiSwapInterface from "./multi-swap-interface"
import TokenList from "./token-list"
import ConnectWallet from "../web3/connect-wallet"
import Image from "next/image"
import NetworkToggle from "../ui/network-toggle"
import { useToast } from "@/hooks/use-toast"
import { useTokens } from "@/lib/contexts/token-context"
import { useRef, useEffect, useState, useCallback } from "react"
import { preloadTokenLogos } from "@/lib/token-logo-preloader"

// Enable debug logging
const DEBUG = true

// Update the DEXInterface component to ensure it's properly refreshing token balances
export default function DEXInterface() {
  const { isConnected, address } = useWeb3()
  const { tokens, isLoading, refreshTokens, reorderTokens, addCustomToken, updateAllTokenBalances } = useTokens()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("swap")

  // This will ensure we don't auto-refresh on the LIVE page
  const hasInitializedRef = useRef(false)
  const logosPreloadedRef = useRef(false)

  // Add a function to force refresh balances
  const forceRefreshBalances = async () => {
    if (!address || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to refresh balances.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Forcing balance refresh for address:", address)
      await updateAllTokenBalances()
      toast({
        title: "Balances Refreshed",
        description: "Token balances have been updated.",
      })
    } catch (error) {
      console.error("Failed to refresh balances:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to update token balances. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRefreshTokens = async () => {
    try {
      // First refresh balances
      if (address && isConnected) {
        await updateAllTokenBalances()
      }

      // Then refresh token prices
      await refreshTokens()

      toast({
        title: "Tokens Refreshed",
        description: "Token prices and balances have been updated.",
      })

      // Preload logos after refresh
      preloadTokenLogos(tokens).catch(console.error)
    } catch (error) {
      console.error("Failed to refresh token data:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to update token information. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Add an effect to refresh balances when the component mounts or when the wallet connects
  useEffect(() => {
    if (isConnected && address && !hasInitializedRef.current) {
      console.log("DEXInterface: Connected with address, initializing")
      hasInitializedRef.current = true

      // Use a timeout to prevent immediate execution
      const timer = setTimeout(() => {
        console.log("Performing initial balance refresh for mainnet")
        updateAllTokenBalances()
          .then(() => {
            console.log("Initial balance update completed")
            toast({
              title: "Balances Updated",
              description: "Your token balances have been refreshed.",
            })
            return refreshTokens()
          })
          .then(() => {
            console.log("Initial token refresh completed")
          })
          .catch(console.error)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isConnected, address, updateAllTokenBalances, refreshTokens, toast])

  useEffect(() => {
    // Preload logos for tokens when they're loaded
    if (tokens.length > 0 && !isLoading && !logosPreloadedRef.current) {
      console.log(`[DEXInterface] Tokens loaded, preloading logos for ${tokens.length} tokens`)
      logosPreloadedRef.current = true
      preloadTokenLogos(tokens).catch(console.error)
    }
  }, [tokens, isLoading])

  // Add a function to remove tokens
  const handleRemoveToken = useCallback(
    (tokenAddress: string) => {
      const updatedTokens = tokens.filter((token) => token.address !== tokenAddress)
      reorderTokens(updatedTokens)

      toast({
        title: "Token Removed",
        description: "The invalid token has been removed from your list.",
      })
    },
    [tokens, reorderTokens, toast],
  )

  return (
    <>
      <Card className="w-full max-w-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-[#333]">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="mr-3">
                <Image
                  src="https://img.cryptorank.io/coins/pulse_x1684486367385.png"
                  alt="PulseX Logo"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#ff0099] to-[#ff66cc] text-transparent bg-clip-text">
                PulseX LIVE
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <NetworkToggle />
              <ConnectWallet />
            </div>
          </div>

          <TokenList
            tokens={tokens}
            isLoading={isLoading}
            onRefresh={handleRefreshTokens}
            onTokensReorder={reorderTokens}
            onAddCustomToken={addCustomToken}
            onRemoveToken={handleRemoveToken}
          />

          {isConnected ? (
            <div className="mt-6">
              <MultiSwapInterface />
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="mb-4">Connect your wallet to use PulseX LIVE</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
