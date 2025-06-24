import { useState } from 'react'
import { AlertTriangle, Archive, CheckSquare } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'

interface NewScanWarningModalProps {
  isOpen: boolean
  unprocessedCount: number
  onClose: () => void
  onContinue: () => Promise<void>
}

export const NewScanWarningModal = ({
  isOpen,
  unprocessedCount,
  onClose,
  onContinue
}: NewScanWarningModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleContinue = async () => {
    setIsProcessing(true)
    try {
      await onContinue()
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="p-6 max-w-md mx-4 bg-white">
        {/* כותרת עם אייקון אזהרה */}
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              סריקה חדשה
            </h2>
            <p className="text-sm text-gray-600">
              יש {unprocessedCount} התאמות שלא טופלו
            </p>
          </div>
        </div>

        {/* הודעת אזהרה */}
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800 text-sm leading-relaxed">
            <strong>שים לב:</strong> יש לך {unprocessedCount} התאמות שטרם טופלו.
            <br />
            יצירת סריקה חדשה תעביר את ההתאמות הקיימות להיסטוריה.
          </p>
        </div>

        {/* אפשרויות פעולה */}
        <div className="space-y-3">
          {/* אפשרות 1: המשך ליצירת סריקה חדשה */}
          <Button
            onClick={handleContinue}
            disabled={isProcessing}
            className="w-full flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Archive className="h-4 w-4" />
            <div className="text-right flex-1">
              <div className="font-medium">המשך ליצירת סריקה חדשה</div>
              <div className="text-xs opacity-90">ההתאמות הנוכחיות יישמרו בהיסטוריה</div>
            </div>
          </Button>

          {/* אפשרות 2: טיפול עכשיו */}
          <Button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckSquare className="h-4 w-4" />
            <div className="text-right flex-1">
              <div className="font-medium">חזור לטיפול בהתאמות</div>
              <div className="text-xs opacity-90">טפל בהתאמות הנוכחיות קודם</div>
            </div>
          </Button>
        </div>

        {/* כפתור ביטול */}
        <div className="mt-4 pt-4 border-t">
          <Button
            onClick={onClose}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            ביטול
          </Button>
        </div>

        {/* מצב טעינה */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              <span className="text-sm">מעבד...</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
} 