import type { Token } from "@/types/token"

export interface QueuedTransaction {
  id: string
  type: "approval" | "swap"
  token: Token
  amount: string
  status: "pending" | "processing" | "success" | "failed"
  error?: string
  hash?: string
}

export interface TransactionQueueState {
  transactions: QueuedTransaction[]
  currentIndex: number
  overallStatus: "idle" | "approving" | "swapping" | "completed" | "failed"
  progress: number // 0-100
}

// Create initial queue state
export function createTransactionQueue(inputTokens: { token: Token; amount: string }[]): TransactionQueueState {
  // Filter out tokens with zero amounts
  const validInputs = inputTokens.filter((input) => input.token && input.amount && Number.parseFloat(input.amount) > 0)

  // Create approval transactions first, then swap transactions
  const transactions: QueuedTransaction[] = []

  // Add approval transactions
  validInputs.forEach((input, index) => {
    // Skip approval for native token
    if (input.token.address !== "NATIVE") {
      transactions.push({
        id: `approval-${index}-${input.token.address}`,
        type: "approval",
        token: input.token,
        amount: input.amount,
        status: "pending",
      })
    }
  })

  // Add swap transactions
  validInputs.forEach((input, index) => {
    transactions.push({
      id: `swap-${index}-${input.token.address}`,
      type: "swap",
      token: input.token,
      amount: input.amount,
      status: "pending",
    })
  })

  return {
    transactions,
    currentIndex: 0,
    overallStatus: "idle",
    progress: 0,
  }
}

// Update transaction status
export function updateTransactionStatus(
  queue: TransactionQueueState,
  transactionId: string,
  status: "pending" | "processing" | "success" | "failed",
  details?: { error?: string; hash?: string },
): TransactionQueueState {
  const newQueue = { ...queue }

  // Find and update the transaction
  const txIndex = newQueue.transactions.findIndex((tx) => tx.id === transactionId)
  if (txIndex >= 0) {
    newQueue.transactions[txIndex] = {
      ...newQueue.transactions[txIndex],
      status,
      ...(details || {}),
    }
  }

  // Calculate new progress
  const completed = newQueue.transactions.filter((tx) => tx.status === "success" || tx.status === "failed").length

  newQueue.progress = Math.floor((completed / newQueue.transactions.length) * 100)

  // Update overall status
  if (newQueue.progress === 100) {
    const allSuccess = newQueue.transactions.every((tx) => tx.status === "success")
    newQueue.overallStatus = allSuccess ? "completed" : "failed"
  }

  return newQueue
}

// Get next pending transaction
export function getNextPendingTransaction(queue: TransactionQueueState): QueuedTransaction | null {
  return queue.transactions.find((tx) => tx.status === "pending") || null
}

// Check if all approvals are completed
export function areAllApprovalsComplete(queue: TransactionQueueState): boolean {
  return queue.transactions
    .filter((tx) => tx.type === "approval")
    .every((tx) => tx.status === "success" || tx.status === "failed")
}

// Calculate success rate
export function getSuccessRate(queue: TransactionQueueState): number {
  const total = queue.transactions.length
  if (total === 0) return 0

  const successful = queue.transactions.filter((tx) => tx.status === "success").length
  return Math.floor((successful / total) * 100)
}
