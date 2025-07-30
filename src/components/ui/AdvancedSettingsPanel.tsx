import React, { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { AdvancedMatchingSettings, getDefaultAdvancedMatchingSettings } from '@/types'

interface AdvancedSettingsPanelProps {
  currentSettings?: AdvancedMatchingSettings
  onSave: (settings: AdvancedMatchingSettings) => Promise<void>
  isLoading?: boolean
}

export const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
  currentSettings,
  onSave,
  isLoading = false
}) => {
  const [settings, setSettings] = useState<AdvancedMatchingSettings>(
    currentSettings || getDefaultAdvancedMatchingSettings()
  )
  const [activeTab, setActiveTab] = useState<'basic' | 'weights' | 'filters' | 'gpt' | 'profiles'>('basic')
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings)
    }
  }, [currentSettings])

  useEffect(() => {
    if (currentSettings) {
      setHasChanges(JSON.stringify(settings) !== JSON.stringify(currentSettings))
    }
  }, [settings, currentSettings])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await onSave(settings)
      setSaveStatus('success')
      setHasChanges(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleReset = () => {
    setSettings(getDefaultAdvancedMatchingSettings())
    setHasChanges(true)
  }

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev }
      const keys = path.split('.')
      let current: any = newSettings
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      
      return newSettings
    })
  }

  const renderBasicSettings = () => (
    <div className="space-y-6">
      {/* הערה: הסף הלוגי קבוע כעת במערכת (6/10) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>שינוי חדש:</strong> הסף הלוגי קבוע כעת ב-5/10 לאיזון בין איכות לכמות.
              מקסימום 20 זוגות ישלחו לניתוח GPT לחיסכון בעלות וזמן.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* מקסימום התאמות */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            מקסימום התאמות לחזרה
          </label>
          <input
            type="range"
            min="5"
            max="50"
            value={settings.maxMatches}
            onChange={(e) => updateSettings('maxMatches', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5</span>
            <span className="font-medium">נוכחי: {settings.maxMatches}</span>
            <span>50</span>
          </div>
        </div>

        {/* פער גיל מקסימלי */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            פער גיל מקסימלי (שנים)
          </label>
          <input
            type="range"
            min="1"
            max="15"
            value={settings.hardFilters.maxAgeDifference}
            onChange={(e) => updateSettings('hardFilters.maxAgeDifference', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span className="font-medium">נוכחי: {settings.hardFilters.maxAgeDifference}</span>
            <span>15</span>
          </div>
        </div>

        {/* מרחק מקסימלי */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            מרחק מקסימלי (ק"מ)
          </label>
          <input
            type="range"
            min="5"
            max="200"
            step="5"
            value={settings.advancedFilters.maxDistanceKm}
            onChange={(e) => updateSettings('advancedFilters.maxDistanceKm', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5</span>
            <span className="font-medium">נוכחי: {settings.advancedFilters.maxDistanceKm}</span>
            <span>200</span>
          </div>
        </div>
      </div>

      {/* תיבות סימון */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center space-x-2 space-x-reverse">
          <input
            type="checkbox"
            checked={settings.hardFilters.respectReligiousLevel}
            onChange={(e) => updateSettings('hardFilters.respectReligiousLevel', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">כבד רמות דתיות</span>
        </label>

        <label className="flex items-center space-x-2 space-x-reverse">
          <input
            type="checkbox"
            checked={settings.hardFilters.respectCommunityPreference}
            onChange={(e) => updateSettings('hardFilters.respectCommunityPreference', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">כבד העדפות עדתיות</span>
        </label>

        <label className="flex items-center space-x-2 space-x-reverse">
          <input
            type="checkbox"
            checked={settings.advancedFilters.allowDivorced}
            onChange={(e) => updateSettings('advancedFilters.allowDivorced', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">אפשר גרושים</span>
        </label>

        <label className="flex items-center space-x-2 space-x-reverse">
          <input
            type="checkbox"
            checked={settings.advancedFilters.requireSameCity}
            onChange={(e) => updateSettings('advancedFilters.requireSameCity', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">חובת אותה עיר</span>
        </label>
      </div>
    </div>
  )

  const renderWeightsSettings = () => (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 mb-4">
        קבע את חשיבות כל קריטריון בחישוב ציון ההתאמה (0 = לא חשוב, 10 = חשוב מאוד)
      </div>
      
      {Object.entries(settings.weights).map(([key, value]) => {
        const labels: Record<string, string> = {
          age: 'פער גילאים',
          location: 'קרבה גיאוגרפית',
          religiousLevel: 'התאמה דתית',
          education: 'רמת השכלה',
          profession: 'סוג מקצוע',
          familyBackground: 'רקע משפחתי'
        }
        
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {labels[key]}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={value}
              onChange={(e) => updateSettings(`weights.${key}`, parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>לא חשוב</span>
              <span className="font-medium">{value}/10</span>
              <span>חשוב מאוד</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderGptSettings = () => (
    <div className="space-y-6">
      {/* מודל GPT */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          מודל GPT
        </label>
        <select
          value={settings.gptSettings.model}
          onChange={(e) => updateSettings('gptSettings.model', e.target.value)}
          className="w-full p-2 border rounded-md"
        >
          <option value="gpt-4o-mini">GPT-4o Mini (מהיר וחסכוני)</option>
          <option value="gpt-4o">GPT-4o (מתקדם)</option>
          <option value="gpt-4">GPT-4 (קלאסי)</option>
        </select>
      </div>

      {/* רמת עומק ניתוח */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          רמת עומק הניתוח
        </label>
        <select
          value={settings.customGptSettings.analysisDepth}
          onChange={(e) => updateSettings('customGptSettings.analysisDepth', e.target.value)}
          className="w-full p-2 border rounded-md"
        >
          <option value="basic">בסיסי (מהיר)</option>
          <option value="detailed">מפורט (מומלץ)</option>
          <option value="comprehensive">מקיף (איטי יותר)</option>
        </select>
      </div>

      {/* פרומפט מותאם */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          פרומפט מותאם אישית (אופציונלי)
        </label>
        <textarea
          value={settings.customGptSettings.customPrompt || ''}
          onChange={(e) => updateSettings('customGptSettings.customPrompt', e.target.value)}
          placeholder="אתה שדכן מנוסה המתמחה ב... השתמש בפרומפט ברירת המחדל אם ריק"
          rows={4}
          className="w-full p-2 border rounded-md"
        />
      </div>

      {/* תחומי דגש */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          תחומי דגש (מופרדים בפסיק)
        </label>
        <input
          type="text"
          value={settings.customGptSettings.focusAreas.join(', ')}
          onChange={(e) => updateSettings('customGptSettings.focusAreas', 
            e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
          )}
          placeholder="תואמות רוחנית, יציבות משפחתית, חזון משותף"
          className="w-full p-2 border rounded-md"
        />
      </div>
    </div>
  )

  return (
    <Card className="max-w-4xl mx-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Settings className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">הגדרות התאמה מתקדמות</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            {saveStatus === 'success' && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="h-4 w-4 ml-1" />
                נשמר בהצלחה
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 ml-1" />
                שגיאה בשמירה
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 ml-1" />
              איפוס
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className={saveStatus === 'saving' ? 'opacity-50' : ''}
            >
              <Save className="h-4 w-4 ml-1" />
              {saveStatus === 'saving' ? 'שומר...' : 'שמור הגדרות'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 space-x-reverse">
            {[
              { id: 'basic', label: 'הגדרות בסיסיות' },
              { id: 'weights', label: 'משקולות חשיבות' },
              { id: 'gpt', label: 'הגדרות GPT' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {activeTab === 'basic' && renderBasicSettings()}
          {activeTab === 'weights' && renderWeightsSettings()}
          {activeTab === 'gpt' && renderGptSettings()}
        </div>

        {/* Changes indicator */}
        {hasChanges && (
          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-yellow-600 ml-2" />
              <span className="text-sm text-yellow-700">
                יש לך שינויים שלא נשמרו. לא לשכוח ללחוץ על "שמור הגדרות"!
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}