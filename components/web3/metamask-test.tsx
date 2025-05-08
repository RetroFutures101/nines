"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"

export default function MetamaskTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [hasMetamask, setHasMetamask] = useState<boolean | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [accounts, setAccounts] = useState<string[]>([])
  const [chainId, setChainId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    // Check if MetaMask is installed
    if (typeof window !== "undefined") {
      const hasEthereum = !!window.ethereum
      setHasMetamask(hasEthereum)
      addLog(`MetaMask detected: ${hasEthereum ? "Yes" : "No"}`)

      if (hasEthereum) {
        // Check if already connected
        window.ethereum
          .request({ method: "eth_accounts" })
          .then((accounts: string[]) => {
            if (accounts.length > 0) {
              setAccounts(accounts)
              setIsConnected(true)
              addLog(`Already connected to account: ${accounts[0]}`)
            } else {
              addLog("No accounts connected")
            }
          })
          .catch((error: any) => {
            addLog(`Error checking accounts: ${error.message}`)
          })

        // Get chain ID
        window.ethereum
          .request({ method: "eth_chainId" })
          .then((chainId: string) => {
            setChainId(chainId)
            addLog(`Connected to chain ID: ${chainId} (${Number.parseInt(chainId, 16)})`)
          })
          .catch((error: any) => {
            addLog(`Error getting chain ID: ${error.message}`)
          })

        // Set up event listeners
        const handleAccountsChanged = (accounts: string[]) => {
          setAccounts(accounts)
          setIsConnected(accounts.length > 0)
          addLog(`Accounts changed: ${accounts.join(", ") || "none"}`)
        }

        const handleChainChanged = (chainId: string) => {
          setChainId(chainId)
          addLog(`Chain changed: ${chainId} (${Number.parseInt(chainId, 16)})`)
        }

        window.ethereum.on("accountsChanged", handleAccountsChanged)
        window.ethereum.on("chainChanged", handleChainChanged)

        return () => {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [])

  const connectWithRequestAccounts = async () => {
    if (!window.ethereum) {
      addLog("MetaMask not detected")
      return
    }

    setIsConnecting(true)
    addLog("Attempting to connect with eth_requestAccounts...")

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      setAccounts(accounts)
      setIsConnected(accounts.length > 0)
      addLog(`Connected with accounts: ${accounts.join(", ")}`)
    } catch (error: any) {
      addLog(`Connection error: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const connectWithEnable = async () => {
    if (!window.ethereum) {
      addLog("MetaMask not detected")
      return
    }

    setIsConnecting(true)
    addLog("Attempting to connect with ethereum.enable()...")

    try {
      // @ts-ignore - ethereum.enable() is deprecated but sometimes works when other methods fail
      const accounts = await window.ethereum.enable()
      setAccounts(accounts)
      setIsConnected(accounts.length > 0)
      addLog(`Connected with accounts: ${accounts.join(", ")}`)
    } catch (error: any) {
      addLog(`Connection error: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const getPermissions = async () => {
    if (!window.ethereum) {
      addLog("MetaMask not detected")
      return
    }

    addLog("Getting permissions...")

    try {
      const permissions = await window.ethereum.request({ method: "wallet_getPermissions" })
      addLog(`Permissions: ${JSON.stringify(permissions)}`)
    } catch (error: any) {
      addLog(`Error getting permissions: ${error.message}`)
    }
  }

  const requestPermissions = async () => {
    if (!window.ethereum) {
      addLog("MetaMask not detected")
      return
    }

    addLog("Requesting permissions...")

    try {
      const permissions = await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      })
      addLog(`Permissions granted: ${JSON.stringify(permissions)}`)
    } catch (error: any) {
      addLog(`Error requesting permissions: ${error.message}`)
    }
  }

  const disconnect = () => {
    setIsConnected(false)
    setAccounts([])
    addLog("Disconnected (note: this is just UI state, MetaMask doesn't have a disconnect method)")
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>MetaMask Connection Test</CardTitle>
        <CardDescription>
          This page helps diagnose issues with MetaMask connections. Try the different connection methods below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-medium mb-2">Status</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="mr-2">MetaMask Detected:</span>
                {hasMetamask === null ? (
                  <span>Checking...</span>
                ) : hasMetamask ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div className="flex items-center">
                <span className="mr-2">Connected:</span>
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              {accounts.length > 0 && (
                <div>
                  <span className="font-medium">Accounts:</span>
                  <ul className="list-disc list-inside">
                    {accounts.map((account) => (
                      <li key={account} className="text-sm font-mono break-all">
                        {account}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {chainId && (
                <div>
                  <span className="font-medium">Chain ID:</span>{" "}
                  <span className="font-mono">
                    {chainId} (Decimal: {Number.parseInt(chainId, 16)})
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <Button
                onClick={connectWithRequestAccounts}
                disabled={isConnecting}
                className="w-full bg-[#ff0099] hover:bg-[#cc0077]"
              >
                Connect with eth_requestAccounts
              </Button>
              <Button
                onClick={connectWithEnable}
                disabled={isConnecting}
                className="w-full bg-[#ff0099] hover:bg-[#cc0077]"
              >
                Connect with ethereum.enable()
              </Button>
              <Button onClick={getPermissions} className="w-full">
                Get Permissions
              </Button>
              <Button onClick={requestPermissions} className="w-full">
                Request Permissions
              </Button>
              {isConnected && (
                <Button onClick={disconnect} variant="outline" className="w-full">
                  Disconnect (UI only)
                </Button>
              )}
            </div>

            {!hasMetamask && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>MetaMask Not Detected</AlertTitle>
                <AlertDescription>Please install MetaMask extension and refresh this page.</AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Connection Logs</h3>
            <div className="bg-[#0a0a0a] p-3 rounded-md h-[300px] overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No logs yet...</p>
              ) : (
                logs.map((log, index) => <div key={index}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
