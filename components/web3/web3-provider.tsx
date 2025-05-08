"use client"

import { type ReactNode, createContext, useState, useEffect } from "react"
import { ethers } from "ethers"
import { getRpcUrl } from "@/lib/env-config"
import { CHAIN_ID } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"

interface Web3ContextType {
  provider: ethers.BrowserProvider | null
  signer: ethers.Signer | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  preserveConnection: () => void
}

export const Web3Context = createContext<Web3ContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  preserveConnection: () => {},
})

interface Web3ProviderProps {
  children: ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          // Check if we previously stored a connection
          const shouldBeConnected = localStorage.getItem("pulseChainDexWalletConnected") === "true"

          if (shouldBeConnected) {
            // Check if accounts are still available
            const accounts = await window.ethereum.request({ method: "eth_accounts" })

            if (accounts.length > 0) {
              const provider = new ethers.BrowserProvider(window.ethereum)
              const network = await provider.getNetwork()
              const chainId = Number(network.chainId)

              // Only proceed if connected to the correct chain
              if (chainId === CHAIN_ID) {
                const signer = await provider.getSigner()
                const address = await signer.getAddress()

                console.log("Restored connection to:", address)

                setProvider(provider)
                setSigner(signer)
                setAddress(address)
                setChainId(chainId)
                setIsConnected(true)
              } else {
                console.log("Connected to wrong network. Expected:", CHAIN_ID, "Got:", chainId)
                localStorage.removeItem("pulseChainDexWalletConnected")
              }
            } else {
              // No accounts available, clear stored state
              localStorage.removeItem("pulseChainDexWalletConnected")
            }
          }
        } catch (error) {
          console.error("Failed to check wallet connection:", error)
        }
      }
    }

    checkConnection()
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()

          setProvider(provider)
          setSigner(signer)
          setAddress(address)
        } else {
          disconnect()
        }
      }

      const handleChainChanged = (chainIdHex: string) => {
        const chainId = Number.parseInt(chainIdHex, 16)
        setChainId(chainId)
        if (chainId !== CHAIN_ID) {
          disconnect()
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  // Update the connect method to properly handle MetaMask connections
  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet")
      return
    }

    setIsConnecting(true)

    try {
      // Explicitly request accounts first to trigger MetaMask popup
      console.log("Requesting accounts from MetaMask...")
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      })
      console.log("Accounts received:", accounts)

      if (!accounts || accounts.length === 0) {
        console.error("No accounts returned")
        setIsConnecting(false)
        return
      }

      // Then try to switch to PulseChain network
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
        })
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
                  rpcUrls: [getRpcUrl()],
                  blockExplorerUrls: ["https://scan.pulsechain.com"],
                },
              ],
            })
          } catch (addError) {
            console.error("Failed to add PulseChain network:", addError)
            setIsConnecting(false)
            return
          }
        } else {
          console.error("Failed to switch to PulseChain network:", switchError)
          setIsConnecting(false)
          return
        }
      }

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum, "any")
      await provider.send("eth_chainId", []) // Force connection
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      console.log("Connected to wallet with address:", address)
      console.log("Connected to network with chainId:", chainId)

      setProvider(provider)
      setSigner(signer)
      setAddress(address)
      setChainId(chainId)
      setIsConnected(true)

      // Store connection state in localStorage for persistence
      localStorage.setItem("pulseChainDexWalletConnected", "true")
      localStorage.setItem("pulseChainDexWalletAddress", address)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setProvider(null)
    setSigner(null)
    setAddress(null)
    setChainId(null)
    setIsConnected(false)
  }

  // Function to preserve connection state when switching networks
  const preserveConnection = () => {
    if (isConnected && address) {
      localStorage.setItem("lastConnectedAddress", address)
      localStorage.setItem("lastConnectedNetwork", "mainnet")
      console.log("Preserved mainnet connection for address:", address)
    }
  }

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        preserveConnection,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}
