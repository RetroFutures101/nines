"use client"

import { type ReactNode, createContext, useEffect, useState, useRef } from "react"
import { ethers } from "ethers"
import { TESTNET_CHAIN_ID } from "@/lib/testnet-constants"
import { getTestnetRpcUrl } from "@/lib/env-config"
import { useToast } from "@/hooks/use-toast"

interface TestnetWeb3ContextType {
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

export const TestnetWeb3Context = createContext<TestnetWeb3ContextType>({
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

interface TestnetWeb3ProviderProps {
  children: ReactNode
}

export function TestnetWeb3Provider({ children }: TestnetWeb3ProviderProps) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const connectionChecked = useRef(false)
  const { toast } = useToast()

  // Check if wallet is already connected
  useEffect(() => {
    if (connectionChecked.current) return
    connectionChecked.current = true

    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          // Check if we have a persisted connection state in localStorage
          const shouldBeConnected = localStorage.getItem("pulseChainTestnetDexWalletConnected") === "true"

          // Also check if we're restoring from a network switch
          const lastConnectedAddress = localStorage.getItem("lastConnectedAddress")
          const lastConnectedNetwork = localStorage.getItem("lastConnectedNetwork")

          // If we're coming from a network switch, show a toast
          if (lastConnectedAddress && lastConnectedNetwork === "mainnet") {
            toast({
              title: "Network Changed",
              description: "You've switched to Testnet. Click 'Connect Wallet' to reconnect.",
            })
            // Clear the last connected network but keep the address
            localStorage.removeItem("lastConnectedNetwork")
          }

          if (shouldBeConnected) {
            try {
              // Request accounts to check if we still have permission
              const accounts = await window.ethereum.request({ method: "eth_accounts" })

              if (accounts.length > 0) {
                const provider = new ethers.BrowserProvider(window.ethereum)
                const network = await provider.getNetwork()
                const chainId = Number(network.chainId)

                // Only proceed if connected to the correct testnet
                if (chainId === TESTNET_CHAIN_ID) {
                  const signer = await provider.getSigner()
                  const address = await signer.getAddress()

                  setProvider(provider)
                  setSigner(signer)
                  setAddress(address)
                  setChainId(chainId)
                  setIsConnected(true)

                  console.log("Connected to PulseChain Testnet with address:", address)
                } else {
                  console.log("Connected to wrong network. Expected:", TESTNET_CHAIN_ID, "Got:", chainId)
                  // Clear the persisted state if on wrong network
                  localStorage.removeItem("pulseChainTestnetDexWalletConnected")
                }
              } else {
                // No accounts available, clear persisted state
                localStorage.removeItem("pulseChainTestnetDexWalletConnected")
              }
            } catch (error) {
              console.error("Failed to get signer or address:", error)
              // Clear persisted state on error
              localStorage.removeItem("pulseChainTestnetDexWalletConnected")
            }
          }
        } catch (error) {
          console.error("Failed to check wallet connection:", error)
        }
      }
    }

    checkConnection()
  }, [toast])

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          disconnect()
        } else if (isConnected) {
          // Account changed
          try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()
            const address = await signer.getAddress()

            setProvider(provider)
            setSigner(signer)
            setAddress(address)

            // Update localStorage with new address
            localStorage.setItem("pulseChainTestnetDexWalletAddress", address)
          } catch (error) {
            console.error("Failed to update signer after account change:", error)
          }
        }
      }

      const handleChainChanged = async (chainIdHex: string) => {
        try {
          const chainId = Number.parseInt(chainIdHex, 16)
          setChainId(chainId)

          // Check if connected to the correct testnet
          if (chainId !== TESTNET_CHAIN_ID) {
            console.log("Switched to wrong network. Expected:", TESTNET_CHAIN_ID, "Got:", chainId)
            disconnect()
            return
          }

          // Refresh provider on chain change
          if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum)
            setProvider(provider)

            // Only try to get signer if we're already connected
            if (isConnected) {
              try {
                // Use a timeout to avoid race conditions with wallet UI
                setTimeout(async () => {
                  try {
                    // Check if we have permission first
                    const accounts = await window.ethereum.request({ method: "eth_accounts" })
                    if (accounts.length > 0) {
                      const signer = await provider.getSigner()
                      setSigner(signer)
                    } else {
                      console.log("No accounts available after chain change")
                      setSigner(null)
                    }
                  } catch (signerError) {
                    console.error("Failed to get signer after chain change (delayed):", signerError)
                    setSigner(null)
                  }
                }, 500)
              } catch (error) {
                console.error("Failed to get signer after chain change:", error)
                setSigner(null)
              }
            }
          }
        } catch (error) {
          console.error("Failed to handle chain change:", error)
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [isConnected])

  // Add a new useEffect to periodically check and maintain the wallet connection
  useEffect(() => {
    if (!isConnected) return

    // Set up a periodic check to maintain connection
    const connectionCheckInterval = setInterval(async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          // Check if we still have permission to the accounts
          const accounts = await window.ethereum.request({ method: "eth_accounts" })

          if (accounts.length === 0 && isConnected) {
            // We lost connection, try to reconnect silently
            console.log("Testnet connection lost, attempting to reconnect silently")

            try {
              const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" })
              if (newAccounts.length === 0) {
                // User rejected the reconnection
                console.log("User rejected testnet reconnection")
                disconnect()
              }
            } catch (reconnectError) {
              console.error("Failed to reconnect to testnet:", reconnectError)
              // Don't disconnect here, as it might be a temporary issue
            }
          } else if (accounts.length > 0 && !isConnected) {
            // We have accounts but not connected, restore connection
            console.log("Accounts available but not connected to testnet, restoring connection")
            connect()
          }
        } catch (error) {
          console.error("Error checking testnet wallet connection:", error)
        }
      }
    }, 30000) // Check every 30 seconds

    return () => {
      clearInterval(connectionCheckInterval)
    }
  }, [isConnected])

  // Update the connect method to properly handle MetaMask connections
  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet")
      return
    }

    setIsConnecting(true)

    try {
      // Explicitly request accounts first to trigger MetaMask popup
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })

      if (accounts.length === 0) {
        console.error("No accounts returned")
        setIsConnecting(false)
        return
      }

      // Check current chain ID
      const currentChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const currentChainId = Number.parseInt(currentChainIdHex, 16)

      // If not on the correct chain, switch to it
      if (currentChainId !== TESTNET_CHAIN_ID) {
        try {
          // Try to switch to the correct chain
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${TESTNET_CHAIN_ID.toString(16)}` }],
          })

          console.log("Switched to PulseChain Testnet")
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${TESTNET_CHAIN_ID.toString(16)}`,
                    chainName: "PulseChain Testnet V4",
                    nativeCurrency: {
                      name: "Test Pulse",
                      symbol: "tPLS",
                      decimals: 18,
                    },
                    rpcUrls: [getTestnetRpcUrl()],
                    blockExplorerUrls: ["https://scan.v4.testnet.pulsechain.com"],
                  },
                ],
              })

              console.log("Added PulseChain Testnet to wallet")
            } catch (addError) {
              console.error("Failed to add PulseChain Testnet network:", addError)
              setIsConnecting(false)
              return
            }
          } else {
            console.error("Failed to switch to PulseChain Testnet network:", switchError)
            setIsConnecting(false)
            return
          }
        }
      }

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      console.log("Connected to testnet with address:", address)
      console.log("Connected to testnet with chainId:", chainId)

      // Verify we're on the correct chain
      if (chainId !== TESTNET_CHAIN_ID) {
        alert(`Please switch to PulseChain Testnet V4 (Chain ID: ${TESTNET_CHAIN_ID})`)
        setIsConnecting(false)
        return
      }

      setProvider(provider)
      setSigner(signer)
      setAddress(address)
      setChainId(chainId)
      setIsConnected(true)

      // Store connection state in localStorage for persistence
      localStorage.setItem("pulseChainTestnetDexWalletConnected", "true")
      localStorage.setItem("pulseChainTestnetDexWalletAddress", address)
      localStorage.setItem("pulseChainTestnetDexWalletTimestamp", Date.now().toString())

      // Clear any previous network switch state
      localStorage.removeItem("lastConnectedNetwork")
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

    // Clear persisted connection state from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("pulseChainTestnetDexWalletConnected")
      localStorage.removeItem("pulseChainTestnetDexWalletAddress")
    }
  }

  // Function to preserve connection state when switching networks
  const preserveConnection = () => {
    if (isConnected && address) {
      localStorage.setItem("lastConnectedAddress", address)
      localStorage.setItem("lastConnectedNetwork", "testnet")
      console.log("Preserved testnet connection for address:", address)
    }
  }

  return (
    <TestnetWeb3Context.Provider
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
    </TestnetWeb3Context.Provider>
  )
}
