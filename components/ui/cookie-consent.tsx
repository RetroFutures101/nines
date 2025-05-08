"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false)

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem("cookieConsent")
    if (!hasConsented) {
      setShowConsent(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "true")
    setShowConsent(false)
  }

  if (!showConsent) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-[#1a1a1a] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle>Cookie Notice</CardTitle>
          <CardDescription>We use local storage to save your token preferences and settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This includes your custom tokens, token order, and other settings to improve your experience. No personal
            data is collected or shared with third parties.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleAccept}>
            Accept
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
