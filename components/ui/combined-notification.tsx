"use client"

import { useState, useEffect } from "react"
import { X, Info, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useWeb3 } from "@/hooks/use-web3"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import { cn } from "@/lib/utils"

interface CollapsibleNotificationProps {
  isTestnet?: boolean
}

export default function CollapsibleNotification({ isTestnet = false }: CollapsibleNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const mainnetWeb3 = useWeb3()
  const testnetWeb3 = useTestnetWeb3()
  const { isConnected } = isTestnet ? testnetWeb3 : mainnetWeb3

  useEffect(() => {
    // Check if the user has seen the notifications before
    const hasSeenDragDrop = localStorage.getItem("hasSeenDragDropInstructions")
    const hasAcceptedCookies = localStorage.getItem("cookieConsent")

    if (hasSeenDragDrop && hasAcceptedCookies) {
      setIsVisible(false)
    } else {
      // Show the notification after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Hide notification when wallet is connected
  useEffect(() => {
    if (isConnected) {
      setIsVisible(false)
    }
  }, [isConnected])

  const handleClose = () => {
    if (!isAcknowledged) {
      return // Don't close if not acknowledged
    }

    setIsVisible(false)
    // Mark that the user has seen the popup and accepted cookies
    localStorage.setItem("hasSeenDragDropInstructions", "true")
    localStorage.setItem("cookieConsent", "true")
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed transition-all duration-300 ease-in-out z-40",
        isCollapsed ? "bottom-0 left-0 right-0 px-4 pb-4" : "inset-0 flex items-center justify-center bg-black/50",
      )}
    >
      <Card
        className={cn(
          "w-full max-w-md bg-[#1a1a1a] border-[#333] transition-all duration-300",
          isCollapsed ? "shadow-lg" : "",
        )}
      >
        <div className="flex justify-between items-center p-3 bg-[#222] border-b border-[#333]">
          <div className="flex items-center">
            <Info className="h-4 w-4 text-[#ff0099] mr-2" />
            <h3 className="text-sm font-bold text-white">Welcome to PulseX DEX</h3>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" onClick={toggleCollapse} className="h-6 w-6 hover:bg-[#333]">
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6 hover:bg-[#333]"
              disabled={!isAcknowledged}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <CardContent className="p-4">
            <div className="space-y-4">
              <p className="text-sm">
                To populate the swap fields with your desired 'from' or 'to' tokens, use the Drag & Drop function from
                the 'Featured Tokens' ribbon. You can customize what tokens appear in the ribbon using the 'Add Token'
                button.
              </p>

              <p className="text-sm">
                We use local storage to save your token preferences and settings. This includes your custom tokens,
                token order, and other settings to improve your experience. No personal data is collected or shared with
                third parties.
              </p>

              <div className="flex items-start space-x-2 mt-4">
                <Checkbox
                  id="acknowledgment"
                  checked={isAcknowledged}
                  onCheckedChange={(checked) => setIsAcknowledged(!!checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="acknowledgment" className="text-sm font-medium">
                    I understand how to use the DEX and accept the cookie policy
                  </Label>
                </div>
              </div>

              <div className="flex justify-center">
                <Button onClick={handleClose} className="bg-[#ff0099] hover:bg-[#cc0077]" disabled={!isAcknowledged}>
                  Continue
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
