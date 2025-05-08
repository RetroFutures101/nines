"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWeb3 } from "@/hooks/use-web3"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import { useToast } from "@/hooks/use-toast"
import type { Token } from "@/types/token"
import { useTokens } from "@/lib/contexts/token-context"
import { ArrowDown, Trash2, Plus, RefreshCw, AlertCircle } from "lucide-react"
import { getTokenLogoWithFallback } from "@/lib/token-icons"
import { calculateMultiSwapOutput, setMaxAmount, calculateOptimalSlippage } from "@/lib/multi-swap-calculator"
import { createTransactionQueue, updateTransactionStatus, type TransactionQueueState } from "@/lib/transaction-queue"
import { approveToken } from "@/lib/fallback-multi-swap"
import TransactionProgress from "./transaction-progress"
import TokenSelector from "./token-selector"
import { ethers } from "ethers"
import { getEnhancedSwapQuote, type RouteQuote } from "@/lib/enhanced-smart-routing"
import EnhancedRoutingDisplay from "./enhanced-routing-display"
import { executeEnhancedSwap } from "@/lib/enhanced-swap-executor"

interface MultiSwapInterfaceProps {
  isTestnet?: boolean
}

interface TokenInput {
  token: Token | null
  amount: string
  id: string
  rate?: number
  outputAmount?: string
}

export default function MultiSwapInterface({ isTestnet = false }: MultiSwapInterfaceProps) {
  const web3 = useWeb3()
  const testnetWeb3 = useTestnetWeb3()
  const { address, signer } = isTestnet ? testnetWeb3 : web3
  const { tokens, updateTokenBalance, refreshTokens } = useTokens()
  const [inputTokens, setInputTokens] = useState<TokenInput[]>([{ token: null, amount: "", id: `input-${Date.now()}` }])
  const [outputToken, setOutputToken] = useState<Token | null>(null)
  const [outputAmount, setOutputAmount] = useState("")
  const [slippage, setSlippage] = useState(0.25)
  const [priceImpact, setPriceImpact] = useState<number | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)
  const [transactionQueue, setTransactionQueue] = useState<TransactionQueueState | null>(null)
  const [executionPrice, setExecutionPrice] = useState<number | undefined>(undefined)
  const [marketPrice, setMarketPrice] = useState<number | undefined>(undefined)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const [routeDescription, setRouteDescription] = useState<string | undefined>(undefined)
  const [quote, setQuote] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const MAX_INPUT_TOKENS = 5
  const [enhancedRoutes, setEnhancedRoutes] = useState<RouteQuote[]>([])
  const [minOutputAmount, setMinOutputAmount] = useState("")
  const [maxOutputAmount, setMaxOutputAmount] = useState("")

  // Refs for the drop zones
  const toDropRef = useRef<HTMLDivElement>(null)
  const inputDropRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Set initial tokens when tokens are loaded
  useEffect(() => {
    if (tokens && tokens.length > 0) {
      // Set default input token if not set - only use tokens with balance in live mode
      if (!inputTokens[0].token) {
        const newInputTokens = [...inputTokens]

        // Find a token with balance in live mode, or any token in testnet
        const defaultToken = isTestnet
          ? tokens[0]
          : tokens.find((t) => t.balance && Number.parseFloat(t.balance) > 0) || tokens[0]

        newInputTokens[0].token = defaultToken
        setInputTokens(newInputTokens)
      }

      // Set default output token if not set
      if (!outputToken && tokens.length > 1) {
        // Find a different token than the input token
        const inputToken = inputTokens[0].token
        const outputTokenCandidate = tokens.find((t) => t.address !== (inputToken?.address || ""))
        if (outputTokenCandidate) {
          setOutputToken(outputTokenCandidate)
        }
      }
    }
  }, [tokens, inputTokens, outputToken, isTestnet])

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

  // Setup drop zones for token drag and drop
  useEffect(() => {
    // Setup drop zones for each input field
    inputTokens.forEach((input, index) => {
      const dropZoneId = `input-drop-${input.id}`
      const dropZone = document.getElementById(dropZoneId)

      if (dropZone) {
        const handleDragOver = (e: DragEvent) => {
          e.preventDefault()

          // Check if the dragged token has balance (in live mode)
          const data = e.dataTransfer?.getData("text/plain")
          if (data && !isTestnet) {
            try {
              const tokenData = JSON.parse(data)
              const tokenBalance = tokenData.balance

              // Only highlight drop zone if token has balance or we're in testnet
              if (tokenBalance && Number.parseFloat(tokenBalance) > 0) {
                dropZone.classList.add("border-[#ff0099]", "bg-[#ff009911]")
              } else {
                // Show "not allowed" styling
                dropZone.classList.add("border-red-500", "bg-red-500/10")
              }
              return
            } catch (error) {
              console.error("Error parsing dragged token data:", error)
            }
          }

          // Default behavior for testnet or if parsing fails
          dropZone.classList.add("border-[#ff0099]", "bg-[#ff009911]")
        }

        const handleDragLeave = () => {
          dropZone.classList.remove("border-[#ff0099]", "bg-[#ff009911]", "border-red-500", "bg-red-500/10")
        }

        const handleDrop = (e: DragEvent) => {
          e.preventDefault()
          dropZone.classList.remove("border-[#ff0099]", "bg-[#ff009911]", "border-red-500", "bg-red-500/10")

          try {
            const data = e.dataTransfer?.getData("text/plain")
            if (data) {
              const tokenData = JSON.parse(data)
              const token = tokens.find((t) => t.address === tokenData.address)

              // Check if token has balance in live mode
              if (token) {
                const hasBalance = token.balance && Number.parseFloat(token.balance) > 0

                // Only allow tokens with balance in live mode
                if (hasBalance || isTestnet) {
                  // Update the token at this index
                  handleInputTokenSelect(token, index)

                  // If this is the last input field and we haven't reached the max,
                  // add a new empty input field
                  if (index === inputTokens.length - 1 && inputTokens.length < MAX_INPUT_TOKENS) {
                    addInputToken()
                  }
                } else {
                  // Show error toast for zero balance tokens
                  toast({
                    title: "Zero Balance",
                    description: `You don't have any ${token.symbol} in your wallet.`,
                    variant: "destructive",
                  })
                }
              }
            }
          } catch (error) {
            console.error("Error processing dropped token:", error)
          }
        }

        dropZone.addEventListener("dragover", handleDragOver)
        dropZone.addEventListener("dragleave", handleDragLeave)
        dropZone.addEventListener("drop", handleDrop)

        return () => {
          dropZone.removeEventListener("dragover", handleDragOver)
          dropZone.removeEventListener("dragleave", handleDragLeave)
          dropZone.removeEventListener("drop", handleDrop)
        }
      }
    })

    // Setup drop zone for output token
    const outputDropZoneId = "output-drop-zone"
    const outputDropZone = document.getElementById(outputDropZoneId)

    if (outputDropZone) {
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault()
        outputDropZone.classList.add("border-[#ff0099]", "bg-[#ff009911]")
      }

      const handleDragLeave = () => {
        outputDropZone.classList.remove("border-[#ff0099]", "bg-[#ff009911]")
      }

      const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        outputDropZone.classList.remove("border-[#ff0099]", "bg-[#ff009911]")

        try {
          const data = e.dataTransfer?.getData("text/plain")
          if (data) {
            const tokenData = JSON.parse(data)
            const token = tokens.find((t) => t.address === tokenData.address)
            if (token) {
              setOutputToken(token)
            }
          }
        } catch (error) {
          console.error("Error processing dropped token:", error)
        }
      }

      outputDropZone.addEventListener("dragover", handleDragOver)
      outputDropZone.addEventListener("dragleave", handleDragLeave)
      outputDropZone.addEventListener("drop", handleDrop)

      return () => {
        outputDropZone.removeEventListener("dragover", handleDragOver)
        outputDropZone.removeEventListener("dragleave", handleDragLeave)
        outputDropZone.removeEventListener("drop", handleDrop)
      }
    }
  }, [inputTokens, tokens, isTestnet, toast])

  const handleSlippageChange = (value: number) => {
    setSlippage(value)
  }

  const handleInputTokenSelect = (token: Token, index: number) => {
    // Check if token has balance in live mode
    const hasBalance = token.balance && Number.parseFloat(token.balance) > 0

    // Only allow tokens with balance in live mode
    if (!hasBalance && !isTestnet) {
      toast({
        title: "Zero Balance",
        description: `You don't have any ${token.symbol} in your wallet.`,
        variant: "destructive",
      })
      return
    }

    const newInputTokens = [...inputTokens]
    newInputTokens[index].token = token
    setInputTokens(newInputTokens)

    // If this is the last input and we haven't reached the max, add a new empty input
    if (index === inputTokens.length - 1 && inputTokens.length < MAX_INPUT_TOKENS) {
      addInputToken()
    }

    // Recalculate output
    if (outputToken) {
      calculateOutputAmount(newInputTokens)
    }
  }

  const handleInputAmountChange = (amount: string, index: number) => {
    const newInputTokens = [...inputTokens]
    newInputTokens[index].amount = amount
    setInputTokens(newInputTokens)

    // Calculate output amount if we have valid inputs and an output token
    if (outputToken) {
      console.log(`Calculating output for ${amount} at index ${index}`)
      calculateOutputAmount(newInputTokens)
    } else {
      console.log("No output token selected yet")
      setOutputAmount("")
      setPriceImpact(null)
    }
  }

  // Update the calculateOutputAmount function to use our new calculator and store individual rates
  const calculateOutputAmount = async (inputs: TokenInput[]) => {
    if (!outputToken) return

    setIsCalculating(true)

    // Filter inputs with tokens and amounts
    const validInputs = inputs.filter(
      (input) =>
        input.token &&
        input.amount &&
        Number.parseFloat(input.amount) > 0 &&
        (isTestnet || (input.token.balance && Number.parseFloat(input.token.balance) > 0)),
    )

    if (validInputs.length === 0) {
      setOutputAmount("")
      setPriceImpact(null)
      setExecutionPrice(undefined)
      setMarketPrice(undefined)
      setRouteDescription(undefined)
      setEnhancedRoutes([])
      setMinOutputAmount("")
      setMaxOutputAmount("")

      // Reset all rates
      const resetInputs = [...inputs]
      resetInputs.forEach((input) => {
        input.rate = undefined
        input.outputAmount = undefined
      })
      setInputTokens(resetInputs)

      setIsCalculating(false)
      return
    }

    // For single input token, use enhanced routing
    if (validInputs.length === 1 && validInputs[0].token && outputToken) {
      try {
        const enhancedQuote = await getEnhancedSwapQuote(
          validInputs[0].token,
          outputToken,
          validInputs[0].amount,
          slippage,
        )

        setOutputAmount(ethers.formatUnits(enhancedQuote.totalOutputAmount, outputToken.decimals))
        setMaxOutputAmount(ethers.formatUnits(enhancedQuote.totalOutputAmount, outputToken.decimals))
        setMinOutputAmount(ethers.formatUnits(enhancedQuote.minOutputAmount, outputToken.decimals))
        setPriceImpact(enhancedQuote.priceImpact)
        setExecutionPrice(enhancedQuote.executionPrice)
        setMarketPrice(enhancedQuote.executionPrice)
        setEnhancedRoutes(enhancedQuote.routes)
        setRouteDescription(enhancedQuote.routes.length > 1 ? "Split routing" : enhancedQuote.routes[0].pathDescription)

        // Update individual rates
        const updatedInputs = [...inputs]
        updatedInputs[0].rate = enhancedQuote.executionPrice
        updatedInputs[0].outputAmount = ethers.formatUnits(enhancedQuote.totalOutputAmount, outputToken.decimals)
        setInputTokens(updatedInputs)

        setIsCalculating(false)
        return
      } catch (error) {
        console.error("Enhanced routing error:", error)
        // Fall back to regular calculation
      }
    }

    // Use our regular multi-swap calculator for multiple inputs
    const result = calculateMultiSwapOutput(validInputs as { token: Token; amount: string }[], outputToken)

    if (result) {
      setOutputAmount(result.outputAmount)
      setMaxOutputAmount(result.outputAmount)
      // Calculate minimum amount based on slippage
      const minAmount = Number(result.outputAmount) * (1 - slippage / 100)
      setMinOutputAmount(minAmount.toString())
      setPriceImpact(result.priceImpact)
      setExecutionPrice(result.executionPrice)
      setMarketPrice(result.executionPrice) // Use execution price as market price
      setRouteDescription(result.routeDescription)
      setQuote({ path: result.path })

      // Update individual rates for each input token
      const updatedInputs = [...inputs]

      // Reset all rates first
      updatedInputs.forEach((input) => {
        input.rate = undefined
        input.outputAmount = undefined
      })

      // Then set rates for valid inputs
      result.individualRates.forEach((rateInfo) => {
        const inputIndex = updatedInputs.findIndex(
          (input) => input.token && input.token.address === rateInfo.token.address,
        )

        if (inputIndex >= 0) {
          updatedInputs[inputIndex].rate = rateInfo.rate
          updatedInputs[inputIndex].outputAmount = rateInfo.outputAmount
        }
      })

      setInputTokens(updatedInputs)
    } else {
      setOutputAmount("")
      setMaxOutputAmount("")
      setMinOutputAmount("")
      setPriceImpact(null)
      setExecutionPrice(undefined)
      setMarketPrice(undefined)
      setRouteDescription(undefined)
      setQuote(null)
      setEnhancedRoutes([])

      // Reset all rates
      const resetInputs = [...inputs]
      resetInputs.forEach((input) => {
        input.rate = undefined
        input.outputAmount = undefined
      })
      setInputTokens(resetInputs)
    }

    setIsCalculating(false)
  }

  const addInputToken = () => {
    if (inputTokens.length < MAX_INPUT_TOKENS) {
      setInputTokens([...inputTokens, { token: null, amount: "", id: `input-${Date.now()}` }])
    }
  }

  const removeInputToken = (index: number) => {
    if (inputTokens.length <= 1) return // Keep at least one input

    const newInputTokens = [...inputTokens]
    newInputTokens.splice(index, 1)
    setInputTokens(newInputTokens)

    // Recalculate output
    calculateOutputAmount(newInputTokens)
  }

  const swapTokenPositions = () => {
    // For multi-swap, we don't swap positions
    // This is just a placeholder for the button
  }

  // Reset swap form
  const resetSwapForm = useCallback(() => {
    setInputTokens([{ token: null, amount: "", id: "input-0" }])
    setOutputAmount("")
    setPriceImpact(null)
    setExecutionPrice(undefined)
    setMarketPrice(undefined)
  }, [])

  // Update the handleMaxClick function to use our new setMaxAmount function
  const handleMaxClick = (index: number) => {
    const input = inputTokens[index]
    if (!input.token || !input.token.balance) return

    // Set the input amount to the token's balance using our utility function
    const newInputTokens = [...inputTokens]
    newInputTokens[index].amount = setMaxAmount(input.token)
    setInputTokens(newInputTokens)

    // Recalculate output
    calculateOutputAmount(newInputTokens)
  }

  // Format rate for display
  const formatRate = (rate: number | undefined, token: Token | null) => {
    if (rate === undefined || !token || !outputToken) return null

    return (
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        1 {token.symbol} = {rate.toFixed(2)} {outputToken.symbol}
      </div>
    )
  }

  // Check if token has balance
  const hasBalance = (token: Token | null): boolean => {
    if (!token) return false
    return token.balance !== undefined && Number.parseFloat(token.balance) > 0
  }

  // Replace the handleSwap function with this implementation
  const handleSwap = async () => {
    if (!outputToken) return

    // Filter valid inputs
    const validInputs = inputTokens.filter(
      (input) =>
        input.token && input.amount && Number.parseFloat(input.amount) > 0 && (isTestnet || hasBalance(input.token)),
    )

    if (validInputs.length === 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter at least one token amount",
        variant: "destructive",
      })
      return
    }

    if (!address) {
      toast({
        title: "Wallet Connection Issue",
        description: "Please ensure your wallet is properly connected.",
        variant: "destructive",
      })
      return
    }

    // Initialize transaction queue
    const queue = createTransactionQueue(validInputs as { token: Token; amount: string }[])
    setTransactionQueue(queue)
    setIsSwapping(true)

    try {
      // DIRECT METAMASK INTERACTION
      if (!window.ethereum) {
        throw new Error("MetaMask not detected")
      }

      // Force request accounts to ensure MetaMask popup appears
      console.log("Directly requesting accounts from MetaMask...")
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      console.log("Accounts received:", accounts)

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available. Please unlock your MetaMask wallet.")
      }

      // For testnet, simulate the swap
      if (isTestnet) {
        await processTestnetSwaps(validInputs, queue)
        return
      }

      // For mainnet, process real transactions
      await processMainnetSwaps(validInputs, queue)
    } catch (error) {
      console.error("Multi-asset swap failed:", error)

      // Update queue status to failed
      if (transactionQueue) {
        setTransactionQueue({
          ...transactionQueue,
          overallStatus: "failed",
        })
      }

      toast({
        title: "Swap Failed",
        description:
          error instanceof Error
            ? error.message.length > 100
              ? error.message.substring(0, 100) + "..."
              : error.message
            : "Failed to execute swap",
        variant: "destructive",
      })
    } finally {
      setIsSwapping(false)
    }
  }

  // Add these new helper functions inside the component
  const processTestnetSwaps = async (validInputs: TokenInput[], queue: TransactionQueueState) => {
    // Update queue status
    setTransactionQueue({
      ...queue,
      overallStatus: "approving",
    })

    // Process approvals first (simulated)
    for (let i = 0; i < queue.transactions.length; i++) {
      const tx = queue.transactions[i]
      if (tx.type === "approval") {
        // Update status to processing
        setTransactionQueue((prevQueue) => updateTransactionStatus(prevQueue!, tx.id, "processing"))

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Update status to success
        setTransactionQueue((prevQueue) =>
          updateTransactionStatus(prevQueue!, tx.id, "success", {
            hash: `0x${Math.random().toString(16).substring(2)}`,
          }),
        )
      }
    }

    // Update queue status to swapping
    setTransactionQueue((prevQueue) => ({
      ...prevQueue!,
      overallStatus: "swapping",
    }))

    // Process swaps (simulated)
    for (let i = 0; i < queue.transactions.length; i++) {
      const tx = queue.transactions[i]
      if (tx.type === "swap") {
        // Update status to processing
        setTransactionQueue((prevQueue) => updateTransactionStatus(prevQueue!, tx.id, "processing"))

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Update status to success
        setTransactionQueue((prevQueue) =>
          updateTransactionStatus(prevQueue!, tx.id, "success", {
            hash: `0x${Math.random().toString(16).substring(2)}`,
          }),
        )

        // Update token balances (simulated)
        if (tx.token) {
          const currentBalance = Number.parseFloat(tx.token.balance || "0")
          const newBalance = Math.max(0, currentBalance - Number.parseFloat(tx.amount)).toString()
          updateTokenBalance(tx.token.address, newBalance)
        }
      }
    }

    // Update output token balance
    if (outputToken) {
      const currentBalance = Number.parseFloat(outputToken.balance || "0")
      const newBalance = (currentBalance + Number.parseFloat(outputAmount)).toString()
      updateTokenBalance(outputToken.address, newBalance)
    }

    // Update queue status to completed
    setTransactionQueue((prevQueue) => ({
      ...prevQueue!,
      overallStatus: "completed",
    }))

    toast({
      title: "Testnet Swap Simulated",
      description: `Successfully swapped multiple tokens for ${outputAmount} ${outputToken.symbol}`,
    })

    // Reset form after a delay
    setTimeout(() => {
      setInputTokens([{ token: tokens[0], amount: "", id: `input-${Date.now()}` }])
      setOutputAmount("")
      refreshTokens()
      setIsSwapping(false)
      // Don't clear the transaction queue yet - let the user see the results
    }, 3000)
  }

  // Completely rewritten processMainnetSwaps function to fix the MetaMask connection issues
  const processMainnetSwaps = async (validInputs: TokenInput[], queue: TransactionQueueState) => {
    try {
      // Force MetaMask connection
      if (!window.ethereum) {
        throw new Error("MetaMask not detected")
      }

      // Force request accounts to ensure MetaMask popup appears
      console.log("Directly requesting accounts from MetaMask...")
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      })
      console.log("Accounts received:", accounts)

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available. Please unlock your MetaMask wallet.")
      }

      // Create a fresh provider and signer with explicit connection
      const provider = new ethers.BrowserProvider(window.ethereum, "any")
      await provider.send("eth_chainId", []) // Force connection
      const currentSigner = await provider.getSigner()
      const currentAddress = await currentSigner.getAddress()
      console.log("Using address for multi-swap:", currentAddress)

      // Update queue status to approving
      setTransactionQueue((prevQueue) => ({
        ...prevQueue!,
        overallStatus: "approving",
      }))

      // Process all approvals first - one at a time to ensure MetaMask handles them properly
      for (const tx of queue.transactions) {
        if (tx.type === "approval") {
          try {
            // Update status to processing
            setTransactionQueue((prevQueue) => updateTransactionStatus(prevQueue!, tx.id, "processing"))

            const input = validInputs.find((input) => input.token?.address === tx.token.address)
            if (!input || !input.token) continue

            // Skip approval for native token
            if (input.token.address === "NATIVE") {
              setTransactionQueue((prevQueue) => updateTransactionStatus(prevQueue!, tx.id, "success"))
              continue
            }

            // Parse amount
            const decimals =
              typeof input.token.decimals === "number" ? input.token.decimals : Number(input.token.decimals)

            if (isNaN(decimals)) {
              throw new Error(`Invalid decimals for ${input.token.symbol}`)
            }

            const parsedAmount = ethers.parseUnits(input.amount, decimals)

            // Use our helper function to approve the token
            try {
              const txHash = await approveToken(
                input.token.address,
                "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02",
                parsedAmount,
                currentSigner,
              )

              // Update status to success
              setTransactionQueue((prevQueue) =>
                updateTransactionStatus(prevQueue!, tx.id, "success", {
                  hash: txHash === "already-approved" ? `0x${Math.random().toString(16).substring(2)}` : txHash,
                }),
              )
            } catch (approvalError) {
              console.error(`Failed to approve ${input.token.symbol}:`, approvalError)

              // Update status to failed
              setTransactionQueue((prevQueue) =>
                updateTransactionStatus(prevQueue!, tx.id, "failed", {
                  error: approvalError instanceof Error ? approvalError.message : "Approval failed",
                }),
              )
            }
          } catch (approvalError) {
            console.error(`Error processing approval for ${tx.token.symbol}:`, approvalError)

            // Update status to failed
            setTransactionQueue((prevQueue) =>
              updateTransactionStatus(prevQueue!, tx.id, "failed", {
                error: approvalError instanceof Error ? approvalError.message : "Approval failed",
              }),
            )
          }
        }
      }

      // Update queue status to swapping
      setTransactionQueue((prevQueue) => ({
        ...prevQueue!,
        overallStatus: "swapping",
      }))

      // Process each input token separately using enhanced swap
      for (const input of validInputs) {
        if (!input.token) continue

        // Find the corresponding transaction in the queue
        const tx = queue.transactions.find((t) => t.type === "swap" && t.token.address === input.token!.address)
        if (!tx) continue

        // Update status to processing
        setTransactionQueue((prevQueue) => updateTransactionStatus(prevQueue!, tx.id, "processing"))

        try {
          // Execute enhanced swap for this input
          const result = await executeEnhancedSwap(
            input.token,
            outputToken!,
            input.amount,
            slippage,
            currentAddress,
            currentSigner,
          )

          if (result.success) {
            // Update status to success
            setTransactionQueue((prevQueue) =>
              updateTransactionStatus(prevQueue!, tx.id, "success", {
                hash: result.transactionHash,
              }),
            )
          } else {
            throw new Error(result.error || "Swap failed")
          }
        } catch (error) {
          console.error(`Error swapping ${input.token.symbol}:`, error)

          // Update status to failed
          setTransactionQueue((prevQueue) =>
            updateTransactionStatus(prevQueue!, tx.id, "failed", {
              error: error instanceof Error ? error.message : "Swap failed",
            }),
          )
        }
      }

      // Check if all swaps were successful
      const allSwapsSuccessful = queue.transactions
        .filter((tx) => tx.type === "swap")
        .every((tx) => tx.status === "success")

      // Update queue status
      setTransactionQueue((prevQueue) => ({
        ...prevQueue!,
        overallStatus: allSwapsSuccessful ? "completed" : "failed",
      }))

      if (allSwapsSuccessful) {
        toast({
          title: "Multi-Swap Completed",
          description: `Successfully swapped tokens for ${outputAmount} ${outputToken!.symbol}`,
        })

        // Refresh token data
        refreshTokens()
      } else {
        throw new Error("Some swaps failed")
      }
    } catch (error) {
      console.error("Multi-asset swap failed:", error)

      // Update queue status to failed
      setTransactionQueue((prevQueue) => ({
        ...prevQueue!,
        overallStatus: "failed",
      }))

      toast({
        title: "Swap Failed",
        description:
          error instanceof Error
            ? error.message.length > 100
              ? error.message.substring(0, 100) + "..."
              : error.message
            : "Failed to execute swap",
        variant: "destructive",
      })
    }
  }

  // Add a function to reset the transaction queue
  const resetTransactionQueue = () => {
    setTransactionQueue(null)
    setIsSwapping(false)
    setInputTokens([{ token: null, amount: "", id: `input-${Date.now()}` }])
    setOutputAmount("")
  }

  // Helper function to get token logo URL
  const getLogoUrl = (token: Token): string => {
    return logoUrls[token.address] || "/placeholder.svg"
  }

  // Add this function inside the component, before the return statement
  const getOptimalSlippage = (input: TokenInput): number => {
    if (!input.token || !input.amount) return slippage

    // Calculate optimal slippage based on token characteristics
    return calculateOptimalSlippage(input.token, input.amount, slippage)
  }

  return (
    <div className="space-y-4 bg-[#111] p-4 rounded-lg border border-[#333]">
      {/* Input Tokens Section */}
      <div className="space-y-3">
        {inputTokens.map((input, index) => {
          // Check if token has balance (for live mode)
          const tokenHasBalance = isTestnet || hasBalance(input.token)
          const showZeroBalanceWarning = !isTestnet && input.token && !tokenHasBalance

          return (
            <div key={input.id} className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor={`input-amount-${index}`}>{index === 0 ? "From" : `Input ${index + 1}`}</Label>
                {input.token && (
                  <span className="text-sm text-muted-foreground">
                    Balance: {input.token.balance ? Number.parseFloat(input.token.balance).toFixed(6) : "0.00"}
                  </span>
                )}
              </div>
              <div className="flex">
                <div
                  id={`input-drop-${input.id}`}
                  className={`flex flex-1 items-center space-x-2 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 transition-colors ${
                    showZeroBalanceWarning ? "border-red-500/50" : ""
                  }`}
                >
                  <Input
                    type="number"
                    id={`input-amount-${index}`}
                    placeholder="0.00"
                    value={input.amount}
                    onChange={(e) => handleInputAmountChange(e.target.value, index)}
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={showZeroBalanceWarning}
                  />
                  {input.token && (
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={input.token ? getLogoUrl(input.token) : "/placeholder.svg"}
                          alt={input.token?.symbol || "Token"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="font-medium">{input.token.symbol}</span>
                      {/* MAX button - only show if token has balance */}
                      {tokenHasBalance && input.token.balance && Number.parseFloat(input.token.balance) > 0 && (
                        <button
                          onClick={() => handleMaxClick(index)}
                          className="text-xs font-medium text-green-500 hover:text-green-400"
                        >
                          MAX
                        </button>
                      )}

                      {/* Zero balance warning */}
                      {showZeroBalanceWarning && (
                        <div className="flex items-center text-red-500">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">No balance</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!input.token && <div className="text-sm text-muted-foreground">Drag token here</div>}
                </div>

                {/* Individual rate display */}
                <div className="flex items-center ml-2 min-w-[120px]">
                  {isCalculating ? (
                    <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    input.token && input.rate !== undefined && tokenHasBalance && formatRate(input.rate, input.token)
                  )}
                </div>

                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInputToken(index)}
                    className="h-10 w-10 ml-2 hover:bg-[#333] hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add token button - only show if less than 5 inputs */}
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
        <Button
          variant="ghost"
          size="icon"
          onClick={swapTokenPositions}
          className="bg-[#1a1a1a] hover:bg-[#333] rounded-full h-8 w-8"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
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
        <div className="flex">
          <div
            id="output-drop-zone"
            className="flex flex-1 items-center space-x-2 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 transition-colors"
          >
            <Input
              type="number"
              id="outputToken"
              placeholder="0.00"
              value={maxOutputAmount || outputAmount}
              onChange={(e) => {}}
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
                  />
                </div>
                <span className="font-medium">{outputToken.symbol}</span>
              </div>
            )}
            {!outputToken && <div className="text-sm text-muted-foreground">Drag token here</div>}
          </div>
          <TokenSelector selectedToken={outputToken} onSelectToken={setOutputToken} tokens={tokens} />
        </div>

        {/* Minimum received info */}
        {minOutputAmount && outputToken && (
          <div className="text-xs text-muted-foreground">
            Minimum received: {Number(minOutputAmount).toFixed(6)} {outputToken.symbol}
          </div>
        )}
      </div>

      {/* Slippage Section */}
      <div className="space-y-2">
        <Label>Slippage Tolerance</Label>
        <div className="flex space-x-2">
          {[0.25, 0.5, 1, 2].map((value) => (
            <Button
              key={value}
              variant={slippage === value ? "default" : "outline"}
              onClick={() => handleSlippageChange(value)}
              className="w-auto px-3 bg-[#1a1a1a] border-[#333] hover:bg-[#333]"
            >
              {value}%
            </Button>
          ))}
        </div>
      </div>

      {/* Enhanced Routing Display */}
      {enhancedRoutes.length > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Route</span>
          <EnhancedRoutingDisplay routes={enhancedRoutes} />
        </div>
      )}

      {/* Price Impact Section */}
      {priceImpact !== null && (
        <div className="text-sm text-muted-foreground">Price Impact: {priceImpact.toFixed(2)}%</div>
      )}

      {/* Route Description Section */}
      {routeDescription && !enhancedRoutes.length && (
        <div className="text-sm text-muted-foreground">Route: {routeDescription}</div>
      )}

      {/* Execution Price Section */}
      {executionPrice && marketPrice && (
        <div className="text-sm text-muted-foreground">Execution Price: {executionPrice.toFixed(6)}</div>
      )}

      {/* Swap Button */}
      <Button
        className="w-full bg-[#ff0099] text-white hover:bg-[#d6007a] font-medium"
        onClick={handleSwap}
        disabled={isSwapping || isCalculating}
      >
        {isCalculating ? (
          <>
            Calculating...
            <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
          </>
        ) : isSwapping ? (
          "Swapping..."
        ) : (
          "Swap"
        )}
      </Button>
      {transactionQueue && <TransactionProgress queue={transactionQueue} onClose={resetSwapForm} />}
    </div>
  )
}
