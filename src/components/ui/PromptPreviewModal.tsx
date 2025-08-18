import React, { useState, useEffect, useMemo } from 'react'
import { X, Copy, Eye, Settings2, Zap, FileText, BarChart3 } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { AdvancedMatchingSettings } from '@/types'
import { getPromptStats } from '@/lib/prompt-generator'

interface PromptPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AdvancedMatchingSettings
}

export const PromptPreviewModal: React.FC<PromptPreviewModalProps> = ({
  isOpen,
  onClose,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'user' | 'stats'>('user')
  const [copied, setCopied] = useState(false)

  // חישוב הפרומפט והסטטיסטיקות
  const promptData = useMemo(() => getPromptStats(settings), [settings])

  // פונקציה להעתקה ללוח
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // הסתרת הסקרול של הגוף כשהמודל פתוח
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const tabs = [
    { id: 'user' as const, label: 'פרומפט משתמש', icon: FileText, color: 'text-blue-600' },
    { id: 'system' as const, label: 'פרומפט מערכת', icon: Settings2, color: 'text-green-600' },
    { id: 'stats' as const, label: 'סטטיסטיקות', icon: BarChart3, color: 'text-purple-600' },
  ]

  const currentTabData = activeTab === 'system' ? promptData.systemPrompt : promptData.userPrompt

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <Eye className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">תצוגה מקדימה של הפרומפט</h2>
                <p className="text-sm text-gray-600 mt-1">
                  צפה בפרומפט המדויק שיישלח ל-GPT עם ההגדרות הנוכחיות
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{promptData.estimatedTokens}</div>
              <div className="text-xs text-gray-600">טוקנים משוערים</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600">{promptData.model}</div>
              <div className="text-xs text-gray-600">מודל GPT</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-600">{promptData.temperature}</div>
              <div className="text-xs text-gray-600">טמפרטורה</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-600">{promptData.focusAreas.length}</div>
              <div className="text-xs text-gray-600">תחומי דגש</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50 px-6">
          <nav className="flex space-x-6 space-x-reverse">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 space-x-reverse transition-colors ${
                  activeTab === tab.id
                    ? `border-blue-500 ${tab.color}`
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'stats' ? (
            <div className="p-6 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* הגדרות GPT */}
                <Card className="p-4">
                  <h3 className="font-medium text-lg mb-3 flex items-center">
                    <Zap className="h-5 w-5 text-yellow-500 ml-2" />
                    הגדרות GPT
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">מודל:</span>
                      <span className="font-medium">{promptData.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">טמפרטורה:</span>
                      <span className="font-medium">{promptData.temperature}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">מקס טוקנים:</span>
                      <span className="font-medium">{promptData.maxTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">רמת ניתוח:</span>
                      <span className="font-medium">{promptData.analysisDepth}</span>
                    </div>
                  </div>
                </Card>

                {/* סטטיסטיקות פרומפט */}
                <Card className="p-4">
                  <h3 className="font-medium text-lg mb-3 flex items-center">
                    <BarChart3 className="h-5 w-5 text-blue-500 ml-2" />
                    סטטיסטיקות פרומפט
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">אורך פרומפט מערכת:</span>
                      <span className="font-medium">{promptData.systemLength} תווים</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">אורך פרומפט משתמש:</span>
                      <span className="font-medium">{promptData.userLength} תווים</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">סה"כ אורך:</span>
                      <span className="font-medium">{promptData.totalLength} תווים</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">טוקנים משוערים:</span>
                      <span className="font-medium">{promptData.estimatedTokens}</span>
                    </div>
                  </div>
                </Card>

                {/* תחומי דגש */}
                <Card className="p-4 md:col-span-2">
                  <h3 className="font-medium text-lg mb-3 flex items-center">
                    <Settings2 className="h-5 w-5 text-green-500 ml-2" />
                    תחומי דגש ({promptData.focusAreas.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {promptData.focusAreas.map((area, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                  {promptData.focusAreas.length === 0 && (
                    <p className="text-gray-500 text-sm">לא נבחרו תחומי דגש ספציפיים</p>
                  )}
                </Card>

                {/* עלות משוערת */}
                <Card className="p-4 md:col-span-2 bg-yellow-50 border-yellow-200">
                  <h3 className="font-medium text-lg mb-3 text-yellow-900">
                    💰 עלות משוערת
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-yellow-800">
                        ${(promptData.estimatedTokens * 0.00015).toFixed(6)}
                      </div>
                      <div className="text-yellow-700">לקריאה אחת</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-yellow-800">
                        ${(promptData.estimatedTokens * 0.00015 * 10).toFixed(5)}
                      </div>
                      <div className="text-yellow-700">ל-10 זוגות</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-yellow-800">
                        ${(promptData.estimatedTokens * 0.00015 * 50).toFixed(4)}
                      </div>
                      <div className="text-yellow-700">ל-50 זוגות</div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Action Bar */}
              <div className="border-b bg-gray-50 px-6 py-3 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {activeTab === 'system' ? 'פרומפט המערכת' : 'פרומפט המשתמש'} • 
                  {activeTab === 'system' ? promptData.systemLength : promptData.userLength} תווים
                </div>
                <Button
                  onClick={() => copyToClipboard(currentTabData)}
                  size="sm"
                  variant="outline"
                  className="flex items-center space-x-2 space-x-reverse"
                >
                  <Copy className="h-4 w-4" />
                  <span>{copied ? 'הועתק!' : 'העתק'}</span>
                </Button>
              </div>

              {/* Prompt Content */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-gray-50 p-4 rounded-lg border">
                  {currentTabData}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 rounded-b-lg">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 עצה: השתמש בתצוגה זו כדי לוודא שהפרומפט מותאם בדיוק לצרכיך
            </div>
            <Button onClick={onClose} variant="outline">
              סגור
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
