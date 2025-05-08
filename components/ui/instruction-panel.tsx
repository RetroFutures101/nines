"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function InstructionPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Check localStorage for user preference
  useEffect(() => {
    const savedState = localStorage.getItem("instructionPanelCollapsed")
    if (savedState) {
      setIsCollapsed(savedState === "true")
    }
  }, [])

  // Save state to localStorage when changed
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("instructionPanelCollapsed", String(newState))
  }

  return (
    <div
      className={`transition-all duration-300 ease-in-out bg-[#0a0a0a] border-r border-[#333] h-full ${
        isCollapsed ? "w-12" : "w-64"
      }`}
    >
      <div className="flex justify-end p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className="h-8 w-8 p-0"
          aria-label={isCollapsed ? "Expand instructions" : "Collapse instructions"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="p-4 pt-0">
          <h3 className="text-lg font-bold mb-4 text-[#ff0099]">HOW TO USE</h3>
          <ol className="space-y-4 text-sm">
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">1.</span>
              <span>
                Connect wallet to 'LIVE' page first to begin using protocol using the 'CONNECT WALLET' button on top
                right.
              </span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">2.</span>
              <span>
                Use 'Import token' button above featured token ribbon to import your personal favourite tokens you will
                use frequently.
              </span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">3.</span>
              <span>Your imported tokens will be saved as cookies to your local storage on your device.</span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">4.</span>
              <span>
                Your imported tokens will be used in the swap zone using the Drag & Drop feature once you have done
                this.
              </span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">5.</span>
              <span>
                Should you wish to use the 'TEST' page, you will need to have connected to the 'LIVE' page first for
                Testnet tokens to appear.
              </span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">6.</span>
              <span>Import tokens from Testnet using the same logic as has been explained for the 'LIVE' page.</span>
            </li>
            <li className="flex">
              <span className="font-bold text-[#ff0099] mr-2">7.</span>
              <span>Should you need tPLS for Testnet, a link to a Faucet has been provided on the 'TEST' page.</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
