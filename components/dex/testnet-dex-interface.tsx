"use client"

import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import { Card, CardContent } from "@/components/ui/card"
import SwapInterface from "./swap-interface"
import MultiSwapInterface from "./multi-swap-interface"
import TokenList from "./token-list"
import TestnetConnectWallet from "../web3/testnet-connect-wallet"
import Image from "next/image"
import NetworkToggle from "../ui/network-toggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useTokens } from "@/lib/contexts/token-context"
import { useEffect, useRef, useState, useCallback } from "react"
import LoadingSpinner from "../ui/loading-spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { fetchTestnetBalance } from "@/lib/testnet-balance-fetcher"
import { TESTNET_FEATURED_TOKENS } from "@/lib/testnet-constants"
import { verifyAllTestnetTokens } from "@/lib/testnet-token-discovery"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TestnetDEXInterface() {
  const { isConnected, address } = useTestnetWeb3()
  const { tokens, isLoading, refreshTokens, reorderTokens, addCustomToken, updateTokenBalance } = useTokens()
  const { toast } = useToast()
  const hasInitialized = useRef(false)
  const [activeTab, setActiveTab] = useState("swap")

  // Add a state to track refresh status
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [verifiedAddresses, setVerifiedAddresses] = useState<Record<string, string>>({})

  // Function to verify token addresses
  const verifyTokenAddresses = async () => {
    console.log("Verifying testnet token addresses...")

    try {
      // Use the new verification function that includes discovery
      const verified = await verifyAllTestnetTokens(TESTNET_FEATURED_TOKENS)
      setVerifiedAddresses(verified)
      return verified
    } catch (error) {
      console.error("Error verifying token addresses:", error)
      return TESTNET_FEATURED_TOKENS
    }
  }

  // Direct balance refresh function that bypasses the token context
  const refreshBalancesDirectly = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to refresh balances.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsRefreshing(true)
      console.log("DIRECT REFRESH: Starting direct balance refresh for address:", address)

      // Verify token addresses first
      const verified = await verifyTokenAddresses()

      // Get all tokens including native token
      const allTokens = [...tokens]

      // Update each token balance directly
      for (const token of allTokens) {
        try {
          // Use verified address if available
          const tokenSymbol = token.symbol.toUpperCase()
          const tokenAddress =
            token.address === "NATIVE"
              ? "NATIVE"
              : Object.keys(verified).includes(tokenSymbol)
                ? verified[tokenSymbol]
                : token.address

          console.log(`DIRECT REFRESH: Fetching balance for ${token.symbol} (${tokenAddress})`)
          const balance = await fetchTestnetBalance(tokenAddress, address)
          console.log(`DIRECT REFRESH: Got balance for ${token.symbol}: ${balance}`)

          // Update the token balance in the context
          updateTokenBalance(token.address, balance)
        } catch (error) {
          console.error(`DIRECT REFRESH: Failed to get balance for ${token.symbol}:`, error)
        }
      }

      // Also check for any tokens in verified addresses that might not be in the current list
      for (const [symbol, tokenAddress] of Object.entries(verified)) {
        if (tokenAddress !== "NATIVE" && !allTokens.some((t) => t.symbol.toUpperCase() === symbol.toUpperCase())) {
          try {
            console.log(`DIRECT REFRESH: Fetching balance for verified token ${symbol} (${tokenAddress})`)
            const balance = await fetchTestnetBalance(tokenAddress, address)
            console.log(`DIRECT REFRESH: Got balance for ${symbol}: ${balance}`)

            // If balance is non-zero, we should add this token
            if (Number.parseFloat(balance) > 0) {
              console.log(`DIRECT REFRESH: Found non-zero balance for ${symbol}, should add to list`)
              // We would need to add this token to the list, but for now just log it
            }
          } catch (error) {
            console.error(`DIRECT REFRESH: Failed to get balance for verified token ${symbol}:`, error)
          }
        }
      }

      toast({
        title: "Balances Refreshed",
        description: "Token balances have been updated directly from the blockchain.",
      })
    } catch (error) {
      console.error("DIRECT REFRESH: Failed to refresh balances directly:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to update token balances. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

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

  // Initialize once when component mounts
  useEffect(() => {
    // Set a timeout to hide the loading spinner after a few seconds
    // even if initialization fails
    const loadingTimer = setTimeout(() => {
      setIsInitializing(false)
    }, 5000)

    return () => clearTimeout(loadingTimer)
  }, [])

  // Add an effect to refresh balances when connected
  useEffect(() => {
    let isMounted = true

    if (isConnected && address && !hasInitialized.current) {
      console.log("TestnetDEXInterface: Connected with address, initializing")
      hasInitialized.current = true

      // Use a timeout to prevent immediate execution
      const timer = setTimeout(async () => {
        if (isMounted) {
          try {
            console.log("Initializing testnet balances for address:", address)

            // Verify token addresses first
            await verifyTokenAddresses()

            // Use the direct balance refresh function
            await refreshBalancesDirectly()

            if (isMounted) {
              setIsInitializing(false)
            }
          } catch (error) {
            console.error("Failed to initialize token balances:", error)
            if (isMounted) {
              setIsInitializing(false)
            }
          }
        }
      }, 1000)

      return () => {
        clearTimeout(timer)
        isMounted = false
      }
    } else if (!isConnected) {
      // If not connected, don't show loading spinner
      setIsInitializing(false)
    }

    return () => {
      isMounted = false
    }
  }, [isConnected, address])

  // Show loading spinner during initialization
  if (isInitializing && isConnected) {
    return (
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
                PulseX TEST
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <NetworkToggle />
              <TestnetConnectWallet />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-center text-muted-foreground">Loading testnet data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

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
                PulseX TEST
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <NetworkToggle />
              <TestnetConnectWallet />
            </div>
          </div>

          {isConnected && (
            <Alert className="mb-4 bg-[#ff009922] border-[#ff0099]">
              <AlertCircle className="h-4 w-4 text-[#ff0099]" />
              <AlertTitle className="text-[#ff0099]">Testnet Mode</AlertTitle>
              <AlertDescription>
                You're connected to PulseChain Testnet. Use the refresh button to update token balances.
              </AlertDescription>
            </Alert>
          )}

          <TokenList
            tokens={tokens}
            isLoading={isLoading}
            onRefresh={refreshBalancesDirectly}
            onTokensReorder={reorderTokens}
            onAddCustomToken={addCustomToken}
            onRemoveToken={handleRemoveToken}
            isTestnet={true}
          />

          {isConnected ? (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="swap">Swap</TabsTrigger>
                  <TabsTrigger value="multi-swap">Multi-Swap</TabsTrigger>
                </TabsList>
                <TabsContent value="swap">
                  <SwapInterface isTestnet={true} />
                </TabsContent>
                <TabsContent value="multi-swap">
                  <MultiSwapInterface isTestnet={true} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="mb-4">Connect your wallet to use PulseX TEST</p>
              <p className="text-sm text-muted-foreground">
                You are connected to the PulseChain Testnet V4 (Chain ID: 943)
              </p>
              <div className="mt-4">
                <Button
                  onClick={() => (window.location.href = "/faucet")}
                  className="inline-flex items-center px-4 py-2 rounded-md bg-[#ff0099] hover:bg-[#cc0077] text-white"
                >
                  Get Test Tokens
                </Button>
              </div>
            </div>
          )}
          {isConnected && (
            <div className="mt-6 pt-4 border-t border-[#333] flex justify-center">
              <Link href="/faucet" passHref>
                <Button className="bg-[#ff0099] hover:bg-[#cc0077] text-white">Access Testnet Faucet</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
