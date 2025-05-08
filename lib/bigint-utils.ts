/**
 * Utility functions for safely handling BigInt values
 */

/**
 * Safely converts any value that might be a BigInt to a string
 * @param value Any value that might be a BigInt
 * @returns The value as a string if it's a BigInt, otherwise the original value
 */
export function safeStringifyBigInt(value: any): any {
  if (typeof value === "bigint") {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(safeStringifyBigInt)
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, any> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = safeStringifyBigInt(value[key])
      }
    }
    return result
  }

  return value
}

/**
 * Custom JSON replacer function to handle BigInt values
 */
export function bigintReplacer(_key: string, value: any): any {
  if (typeof value === "bigint") {
    return value.toString()
  }
  return value
}

/**
 * Safely stringify an object that might contain BigInt values
 */
export function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, bigintReplacer)
}
