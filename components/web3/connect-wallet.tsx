"use client"

import { Button } from "@/components/ui/button"
import { useWeb3 } from "@/hooks/use-web3"
import { Loader2, Wallet } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { CHAIN_ID } from "@/lib/constants"

export default function ConnectWallet() {
  const { isConnected, isConnecting, connect, disconnect, address } = useWeb3()
  const [isDirectConnecting, setIsDirectConnecting] = useState(false)
  const { toast } = useToast()

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // Direct connection to MetaMask bypassing the context
  const handleDirectConnect = async () => {
    try {
      setIsDirectConnecting(true)

      // Check if MetaMask is installed
      if (!window.ethereum) {
        toast({
          title: "MetaMask Not Detected",
          description: "Please install MetaMask extension and refresh the page.",
          variant: "destructive",
        })
        return
      }

      console.log("Directly requesting accounts from MetaMask...")

      // This should trigger the MetaMask popup
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available")
      }

      console.log("Connected accounts:", accounts)

      // Check if we need to switch networks
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const chainId = Number.parseInt(chainIdHex, 16)

      console.log("Current chain ID:", chainId, "Expected:", CHAIN_ID)

      if (chainId !== CHAIN_ID) {
        try {
          // Try to switch to PulseChain
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          })
          console.log("Switched to PulseChain")
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${CHAIN_ID.toString(16)}`,
                    chainName: "PulseChain",
                    nativeCurrency: {
                      name: "Pulse",
                      symbol: "PLS",
                      decimals: 18,
                    },
                    rpcUrls: ["https://rpc-pulsechain.g4mm4.io"],
                    blockExplorerUrls: ["https://scan.pulsechain.com"],
                  },
                ],
              })
              console.log("Added PulseChain to MetaMask")
            } catch (addError) {
              console.error("Failed to add PulseChain network:", addError)
              throw new Error("Failed to add PulseChain network. Please add it manually in MetaMask.")
            }
          } else {
            console.error("Failed to switch to PulseChain network:", switchError)
            throw new Error("Failed to switch to PulseChain network. Please switch manually in MetaMask.")
          }
        }
      }

      // Now call the regular connect function to update the context
      await connect()

      toast({
        title: "Wallet Connected",
        description: `Connected to account ${formatAddress(accounts[0])}`,
      })
    } catch (error) {
      console.error("Direct connection failed:", error)
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      })
    } finally {
      setIsDirectConnecting(false)
    }
  }

  return (
    <>
      {isConnected ? (
        <Button
          variant="outline"
          onClick={disconnect}
          className="bg-[#1a1a1a] border-[#333] hover:bg-[#333] hover:text-white"
        >
          {formatAddress(address || "")}
        </Button>
      ) : (
        <Button
          onClick={handleDirectConnect}
          disabled={isDirectConnecting || isConnecting}
          className="bg-[#ff0099] hover:bg-[#cc0077] text-white border-none"
        >
          {isDirectConnecting || isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </Button>
      )}
    </>
  )
}
