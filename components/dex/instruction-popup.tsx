"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function InstructionPopup() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if the user has seen the popup before
    const hasSeenPopup = localStorage.getItem("hasSeenDragDropInstructions")
    if (!hasSeenPopup) {
      // Show the popup after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    // Mark that the user has seen the popup
    localStorage.setItem("hasSeenDragDropInstructions", "true")
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <Card className="w-full max-w-md bg-[#1a1a1a] border-[#333]">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#ff0099]">Tip: Drag & Drop Tokens</h3>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-4">
            To populate the swap fields with your desired 'from' or 'to' tokens, use the Drag & Drop function from the
            'Featured Tokens' ribbon. Users can customise what tokens they wish to have in the ribbon using the 'Add
            Token' button.
          </p>
          <div className="flex justify-center">
            <Button onClick={handleClose} className="bg-[#ff0099] hover:bg-[#cc0077]">
              Got it!
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
