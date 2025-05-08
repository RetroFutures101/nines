"use client"

import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"
import type { TransactionQueueState, QueuedTransaction } from "@/lib/transaction-queue"

interface TransactionProgressProps {
  queue: TransactionQueueState
  onClose: () => void
  isTestnet?: boolean
}

export default function TransactionProgress({ queue, onClose, isTestnet = false }: TransactionProgressProps) {
  const [expanded, setExpanded] = useState(true)

  // Auto-close after completion with a delay
  useEffect(() => {
    if (queue.overallStatus === "completed" || queue.overallStatus === "failed") {
      const timer = setTimeout(() => {
        setExpanded(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [queue.overallStatus])

  // Get transaction status icon
  const getStatusIcon = (status: QueuedTransaction["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "processing":
        return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  // Get transaction type label
  const getTypeLabel = (tx: QueuedTransaction) => {
    if (tx.type === "approval") {
      return `Approve ${tx.token.symbol}`
    } else {
      return `Swap ${tx.amount} ${tx.token.symbol}`
    }
  }

  // Get overall status message
  const getStatusMessage = () => {
    switch (queue.overallStatus) {
      case "approving":
        return "Approving tokens..."
      case "swapping":
        return "Swapping tokens..."
      case "completed":
        return "All transactions completed!"
      case "failed":
        const successRate = queue.transactions.filter((tx) => tx.status === "success").length
        const total = queue.transactions.length
        return `Completed ${successRate}/${total} transactions`
      default:
        return "Preparing transactions..."
    }
  }

  if (!expanded) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-[#222] p-3 rounded-full shadow-lg cursor-pointer z-50"
        onClick={() => setExpanded(true)}
      >
        <div className="relative">
          <Loader2 className="h-6 w-6 text-[#ff0099]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold">{queue.progress}%</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-[#111] border border-[#333] rounded-lg shadow-xl z-50">
      <div className="p-4 border-b border-[#333]">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-white">Transaction Progress</h3>
          <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-white">
            Minimize
          </button>
        </div>
        <div className="mt-2">
          <div className="w-full bg-[#222] rounded-full h-2.5">
            <div className="bg-[#ff0099] h-2.5 rounded-full" style={{ width: `${queue.progress}%` }}></div>
          </div>
          <p className="text-sm mt-2 text-gray-300">{getStatusMessage()}</p>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto p-2">
        {queue.transactions.map((tx) => (
          <div
            key={tx.id}
            className={`p-2 mb-1 rounded flex items-center ${
              tx.status === "processing" ? "bg-[#222]" : "bg-[#1a1a1a]"
            }`}
          >
            {getStatusIcon(tx.status)}
            <div className="ml-2 flex-1">
              <div className="text-sm">{getTypeLabel(tx)}</div>
              {tx.hash && (
                <a
                  href={`${isTestnet ? "https://scan.v4.testnet.pulsechain.com/tx/" : "https://scan.pulsechain.com/tx/"}${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  View transaction
                </a>
              )}
              {tx.error && <div className="text-xs text-red-400">{tx.error}</div>}
            </div>
          </div>
        ))}
      </div>

      {(queue.overallStatus === "completed" || queue.overallStatus === "failed") && (
        <div className="p-3 border-t border-[#333] flex justify-end">
          <button onClick={onClose} className="px-4 py-1 bg-[#ff0099] hover:bg-[#cc0077] text-white rounded">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
