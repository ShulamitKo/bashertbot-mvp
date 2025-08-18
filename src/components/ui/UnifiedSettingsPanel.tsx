import React, { useState, useEffect } from 'react'
import { Settings, Wifi, Target, Sliders, Save, RotateCcw, AlertCircle, CheckCircle, Eye, Brain } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { AdvancedMatchingSettings, getDefaultAdvancedMatchingSettings, SimplifiedShadchanSettings, simplifyAdvancedSettings } from '@/types'
import { getPromptStats } from '@/lib/prompt-generator'

interface UnifiedSettingsPanelProps {
  currentSettings?: AdvancedMatchingSettings
  onSave: (settings: AdvancedMatchingSettings) => Promise<void>
  isLoading?: boolean
  // Google Sheets וOpenAI settings
  sheetId?: string
  openaiKey?: string
  onSaveBasicSettings?: (sheetId: string, openaiKey: string) => Promise<void>
  onTestConnection?: (sheetId: string) => Promise<{ success: boolean, message: string }>
}

// פרופילי התאמה מוכנים
const MATCHING_PROFILES = {
  classic: {
    name: 'שדכן קלאסי',
    description: 'התמקדות ברמה דתית ועדות, פער גיל קטן',
    icon: '🎯',
    weights: { age: 8, location: 6, religiousLevel: 9, education: 5, profession: 4, familyBackground: 7, personality: 6, values: 9 },
    hardFilters: { maxAgeDifference: 4, respectReligiousLevel: true, respectCommunityPreference: true, respectDealBreakers: true, respectMaritalStatus: true },
    gptSettings: { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1000 },
    focusAreas: ['רמה דתית והלכה', 'רקע משפחתי', 'עדות וקהילה']
  },
  professional: {
    name: 'שדכן מקצועי', 
    description: 'התמקדות בהשכלה ומקצוע, פתוח יותר',
    icon: '💼',
    weights: { age: 6, location: 5, religiousLevel: 6, education: 9, profession: 8, familyBackground: 5, personality: 5, values: 6 },
    hardFilters: { maxAgeDifference: 6, respectReligiousLevel: false, respectCommunityPreference: false, respectDealBreakers: true, respectMaritalStatus: false },
    gptSettings: { model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 1200 },
    focusAreas: ['השכלה ומקצוע', 'יציבות כלכלית', 'מטרות בחיים']
  },
  emotional: {
    name: 'שדכן רגשי',
    description: 'התמקדות באישיות ותחביבים, ניתוח עמוק',
    icon: '❤️',
    weights: { age: 4, location: 3, religiousLevel: 7, education: 5, profession: 4, familyBackground: 8, personality: 10, values: 9 },
    hardFilters: { maxAgeDifference: 8, respectReligiousLevel: true, respectCommunityPreference: false, respectDealBreakers: true, respectMaritalStatus: true },
    gptSettings: { model: 'gpt-4o', temperature: 0.7, maxTokens: 1500 },
    focusAreas: ['אישיות ותחביבים', 'ערכים וחזון משפחתי', 'רקע משפחתי']
  }
}

// רשימת תחומי התמקדות הזמינים
const AVAILABLE_FOCUS_AREAS = [
  'רמה דתית והלכה',
  'עדות וקהילה',
  'ערכים וחזון משפחתי',
  'אישיות ותחביבים',
  'השכלה ומקצוע', 
  'רקע משפחתי',
  'מיקום ומגורים',
  'יציבות כלכלית',
  'מטרות בחיים'
]

// קומפוננט תצוגת פרומפט פנימי
const PromptPreviewContent: React.FC<{ 
  settings: AdvancedMatchingSettings
}> = ({ settings }) => {
  const [promptData, setPromptData] = useState<any>(null)
  
  useEffect(() => {
    try {
      console.log('🔍 [DEBUG] יוצר תצוגה מקדימה עם הגדרות:', settings)
      const data = getPromptStats(settings)
      console.log('📋 [DEBUG] תוצאות הפרומפט:', data)
      setPromptData(data)
    } catch (error) {
      console.error('❌ שגיאה ביצירת תצוגה מקדימה:', error)
      setPromptData(null)
    }
  }, [settings])

  if (!promptData) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <div className="text-center">
          <Brain className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>יוצר תצוגה מקדימה...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* תחומי התמקדות */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">תחומי התמקדות שלך:</h4>
        <div className="flex flex-wrap gap-2">
          {promptData.focusAreas.map((area: string, index: number) => (
            <span key={index} className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
              {area}
            </span>
          ))}
        </div>
      </div>

      {/* פרומפט מערכת */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">הוראות לבינה המלאכותית:</h4>
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto border-r-4 border-blue-300">
          {promptData.systemPrompt}
        </div>
      </div>

      {/* פרומפט משתמש */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">דוגמת הבקשה שתישלח:</h4>
        <div className="bg-green-50 p-4 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto border-r-4 border-green-300">
          {promptData.userPrompt}
        </div>
      </div>
    </div>
  )
}

export const UnifiedSettingsPanel: React.FC<UnifiedSettingsPanelProps> = ({
  currentSettings,
  onSave,
  isLoading = false,
  sheetId = '',
  openaiKey = '',
  onSaveBasicSettings,
  onTestConnection
}) => {
  const [settings, setSettings] = useState<AdvancedMatchingSettings>(
    currentSettings || getDefaultAdvancedMatchingSettings()
  )
  const [activeTab, setActiveTab] = useState<'connections' | 'matching' | 'preferences'>('connections')
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  
  // State לטאב חיבורים
  const [localSheetId, setLocalSheetId] = useState(sheetId)
  const [localOpenaiKey, setLocalOpenaiKey] = useState(openaiKey)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean, message: string } | null>(null)
  
  // State לפרופיל נבחר
  const [selectedProfile, setSelectedProfile] = useState<'classic' | 'professional' | 'emotional' | 'custom'>('classic')
  
  // State להגדרות מפושטות (לזיהוי שינויים)
  const [originalSimplified, setOriginalSimplified] = useState<SimplifiedShadchanSettings | null>(null)

  useEffect(() => {
    if (currentSettings) {
      // ניקוי תחומי התמקדות ישנים והחלפתם בתחומים דומים
      const areaMapping: Record<string, string> = {
        'חזון משותף': 'ערכים וחזון משפחתי',
        'תואמות רגשית': 'אישיות ותחביבים'
      }
      
      const mappedAreas = currentSettings.customGptSettings.focusAreas.map(area => 
        areaMapping[area] || area
      ).filter(area => AVAILABLE_FOCUS_AREAS.includes(area))
      
      // הסרת כפילויות
      const uniqueAreas = [...new Set(mappedAreas)]
      
      const cleanedSettings = {
        ...currentSettings,
        customGptSettings: {
          ...currentSettings.customGptSettings,
          focusAreas: uniqueAreas
        }
      }
      
      console.log('🧹 [DEBUG] ניקוי תחומי התמקדות ישנים:', {
        before: currentSettings.customGptSettings.focusAreas,
        after: cleanedSettings.customGptSettings.focusAreas
      })
      
      setSettings(cleanedSettings)
      // שמירת ההגדרות המפושטות המקוריות לזיהוי שינויים
      const simplified = simplifyAdvancedSettings(cleanedSettings)
      setOriginalSimplified(simplified)
      // עדכון הפרופיל הנבחר בהתאם להגדרות שנטענו
      setSelectedProfile(simplified.selectedProfile)
      console.log('🔄 [DEBUG] עדכן פרופיל נבחר:', simplified.selectedProfile)
    }
  }, [currentSettings])

  useEffect(() => {
    setLocalSheetId(sheetId)
    setLocalOpenaiKey(openaiKey)
  }, [sheetId, openaiKey])

  useEffect(() => {
    if (originalSimplified) {
      // השוואה על בסיס הגדרות מפושטות
      const currentSimplified = simplifyAdvancedSettings(settings)
      setHasChanges(JSON.stringify(currentSimplified) !== JSON.stringify(originalSimplified))
    }
  }, [settings, originalSimplified])

  // פונקציה לטעינת פרופיל מוכן
  const loadProfile = (profileKey: keyof typeof MATCHING_PROFILES) => {
    const profile = MATCHING_PROFILES[profileKey]
    setSettings(prev => ({
      ...prev,
      weights: profile.weights,
      hardFilters: profile.hardFilters,
      gptSettings: {
        ...profile.gptSettings,
        model: profile.gptSettings.model as 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4'
      },
      customGptSettings: {
        ...prev.customGptSettings,
        focusAreas: profile.focusAreas,
        analysisDepth: 'detailed' as const
      }
    }))
    setSelectedProfile(profileKey)
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      console.log('💾 [DEBUG] קומפוננטה מאוחדת - שולח להשמרה:', {
        maxMatches: settings.maxMatches,
        gptModel: settings.gptSettings.model,
        focusAreas: settings.customGptSettings.focusAreas,
        weights: settings.weights,
        selectedProfile
      })
      await onSave(settings)
      setSaveStatus('success')
      setHasChanges(false)
      // עדכון ההגדרות המפושטות המקוריות אחרי שמירה מוצלחת
      const simplified = simplifyAdvancedSettings(settings)
      setOriginalSimplified(simplified)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('❌ [DEBUG] שגיאה בשמירת הגדרות:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleSaveBasicSettings = async () => {
    if (onSaveBasicSettings) {
      try {
        await onSaveBasicSettings(localSheetId, localOpenaiKey)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (error) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }
  }

  const handleTestConnection = async () => {
    if (onTestConnection && localSheetId) {
      setTestingConnection(true)
      try {
        const result = await onTestConnection(localSheetId)
        setConnectionResult(result)
      } catch (error) {
        setConnectionResult({ success: false, message: 'שגיאה בבדיקת החיבור' })
      } finally {
        setTestingConnection(false)
      }
    }
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
    setSelectedProfile('custom')
  }

  // רכיב טאב חיבורים
  const renderConnectionsTab = () => (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 mb-4">
        הגדר את החיבורים הבסיסיים למערכת
      </div>

      {/* חיבור Google Sheets */}
      <Card className="p-6">
        <div className="flex items-center mb-4">
          <Wifi className="h-5 w-5 text-blue-600 ml-2" />
          <h3 className="font-medium text-lg">חיבור לגיליון Google Sheets</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              מזהה הגיליון (מה-URL)
            </label>
            <input
              type="text"
              value={localSheetId}
              onChange={(e) => setLocalSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="ltr"
            />
            <p className="text-xs text-gray-500 mt-1">
              העתק את המזהה מכתובת הגיליון: 
              https://docs.google.com/spreadsheets/d/<strong>מזהה-הגיליון</strong>/edit
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || !localSheetId}
              variant="outline"
              size="sm"
            >
              {testingConnection ? 'בודק חיבור...' : 'בדוק חיבור'}
            </Button>
          </div>

          {connectionResult && (
            <div className={`p-3 rounded-md text-sm ${
              connectionResult.success 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {connectionResult.message}
            </div>
          )}
        </div>
      </Card>

      {/* מפתח OpenAI */}
      <Card className="p-6">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-green-600 ml-2" />
          <h3 className="font-medium text-lg">מפתח OpenAI</h3>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-3">
            סטטוס: <span className={localOpenaiKey ? 'text-green-600' : 'text-red-600'}>
              {localOpenaiKey ? 'הוגדר ✅' : 'לא הוגדר ❌'}
            </span>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              מפתח API
            </label>
            <input
              type="password"
              value={localOpenaiKey}
              onChange={(e) => setLocalOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              dir="ltr"
            />
          </div>
        </div>
      </Card>

      {/* כפתור שמירה */}
      <div className="border-t pt-6">
        <Button 
          onClick={handleSaveBasicSettings}
          className="w-full md:w-auto"
        >
          <Save className="h-4 w-4 ml-1" />
          שמור הגדרות חיבור
        </Button>
      </div>
    </div>
  )

  // רכיב טאב התאמה
  const renderMatchingTab = () => (
    <div className="space-y-6">
      {/* שליטה בכמות זוגות ל-GPT - מובלטת למעלה */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-blue-600 ml-2" />
          <h3 className="font-medium text-lg text-blue-900">שליטה בכמות זוגות ל-GPT</h3>
          <div className="relative group mr-2">
            <button className="text-blue-500 hover:text-blue-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="absolute bottom-full right-0 mb-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-medium mb-2">🔍 תהליך ההתאמה:</div>
              <div className="space-y-1">
                <div>1. המערכת מסננת את כל המועמדים בעזרת אלגוריתם יחודי</div>
                <div>2. האלגוריתם מחשב ציוני התאמה</div>
                <div>3. הזוגות הטובים ביותר נשלחים ל-GPT לניתוח מעמיק</div>
                <div><strong>4. כל מה שחוזר מ-GPT יוצג לך!</strong></div>
              </div>
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm text-blue-700 mb-3">
            קבע כמה זוגות (שעברו בדיקת היתכנות) ישלחו לניתוח GPT
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-blue-100 cursor-pointer">
              <input
                type="radio"
                name="maxGptCandidates"
                value="10"
                checked={settings.maxMatches === 10}
                onChange={() => updateSettings('maxMatches', 10)}
                className="text-blue-600"
              />
              <div className="text-sm">
                <div className="font-medium">10 זוגות מובילים</div>
                <div className="text-xs text-gray-600">~$0.001</div>
              </div>
            </label>
            
            <label className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-blue-100 cursor-pointer">
              <input
                type="radio"
                name="maxGptCandidates"
                value="20"
                checked={settings.maxMatches === 20}
                onChange={() => updateSettings('maxMatches', 20)}
                className="text-blue-600"
              />
              <div className="text-sm">
                <div className="font-medium">20 זוגות מובילים</div>
                <div className="text-xs text-gray-600">~$0.002</div>
              </div>
            </label>
            
            <label className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-blue-100 cursor-pointer">
              <input
                type="radio"
                name="maxGptCandidates"
                value="50"
                checked={settings.maxMatches === 50}
                onChange={() => updateSettings('maxMatches', 50)}
                className="text-blue-600"
              />
              <div className="text-sm">
                <div className="font-medium">50 זוגות מובילים</div>
                <div className="text-xs text-gray-600">~$0.005</div>
              </div>
            </label>
            
            <label className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-blue-100 cursor-pointer">
              <input
                type="radio"
                name="maxGptCandidates"
                value="100"
                checked={settings.maxMatches === 100}
                onChange={() => updateSettings('maxMatches', 100)}
                className="text-blue-600"
              />
              <div className="text-sm">
                <div className="font-medium">כל הזוגות שעברו סינון</div>
                <div className="text-xs text-gray-600">עד $0.01</div>
              </div>
            </label>
          </div>
          

        </div>
      </Card>

      {/* פרופילי התאמה */}
      <Card className="p-6">
        <h3 className="font-medium text-lg mb-4">בחר פרופיל התאמה</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {Object.entries(MATCHING_PROFILES).map(([key, profile]) => (
            <label 
              key={key}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedProfile === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="profile"
                value={key}
                checked={selectedProfile === key}
                onChange={() => loadProfile(key as keyof typeof MATCHING_PROFILES)}
                className="sr-only"
              />
              <div className="flex items-center space-x-3 space-x-reverse">
                <span className="text-2xl">{profile.icon}</span>
                <div>
                  <div className="font-medium">{profile.name}</div>
                  <div className="text-sm text-gray-600">{profile.description}</div>
                </div>
              </div>
            </label>
          ))}
          
          <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedProfile === 'custom' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="profile"
              value="custom"
              checked={selectedProfile === 'custom'}
              onChange={() => setSelectedProfile('custom')}
              className="sr-only"
            />
            <div className="flex items-center space-x-3 space-x-reverse">
              <span className="text-2xl">⚙️</span>
              <div>
                <div className="font-medium">מותאם אישית</div>
                <div className="text-sm text-gray-600">שליטה מלאה על כל ההגדרות</div>
              </div>
            </div>
          </label>
        </div>

        {/* הגדרות מותאמות אישית */}
        {selectedProfile === 'custom' && (
          <div className="space-y-6 border-t pt-6">
            {/* תחומי התמקדות */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                תחומי התמקדות (סמן את הנושאים החשובים לך)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_FOCUS_AREAS.map((area) => (
                  <label key={area} className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      checked={settings.customGptSettings.focusAreas.includes(area)}
                      onChange={(e) => {
                        const currentAreas = settings.customGptSettings.focusAreas
                        const newAreas = e.target.checked 
                          ? [...currentAreas, area]
                          : currentAreas.filter((a: string) => a !== area)
                        updateSettings('customGptSettings.focusAreas', newAreas)
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{area}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* פער גיל */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                פער גיל מקסימלי: {settings.hardFilters.maxAgeDifference} שנים
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
                <span>15</span>
              </div>
            </div>

            {/* רמת ניתוח */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                רמת עומק הניתוח
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'basic', label: 'מהיר', desc: '30 שניות' },
                  { value: 'detailed', label: 'בינוני', desc: '60 שניות' },
                  { value: 'comprehensive', label: 'עמוק', desc: '2 דקות' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="analysisDepth"
                      value={option.value}
                      checked={settings.customGptSettings.analysisDepth === option.value}
                      onChange={() => updateSettings('customGptSettings.analysisDepth', option.value)}
                    />
                    <div className="text-sm">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-600">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* פילטרים קשיחים */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                פילטרים קשיחים
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    checked={settings.hardFilters.respectReligiousLevel}
                    onChange={(e) => updateSettings('hardFilters.respectReligiousLevel', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">כבד רמה דתית</span>
                </label>
                
                <label className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    checked={settings.hardFilters.respectMaritalStatus}
                    onChange={(e) => updateSettings('hardFilters.respectMaritalStatus', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">אל תציע גרושים לרווקים</span>
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
                    checked={settings.hardFilters.respectDealBreakers}
                    onChange={(e) => updateSettings('hardFilters.respectDealBreakers', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">כבד "דיל ברייקרס"</span>
                </label>
                
                <label className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    checked={settings.advancedFilters.requireSameCity}
                    onChange={(e) => updateSettings('advancedFilters.requireSameCity', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">רק מאותה עיר</span>
                </label>
              </div>
            </div>


          </div>
        )}
      </Card>

      {/* תצוגה מקדימה קבועה של הפרומפט */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-center mb-4">
          <Eye className="h-5 w-5 text-purple-600 ml-2" />
          <h3 className="font-medium text-lg text-purple-900">איך אני מתרגם את ההגדרות שלך למילים?</h3>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-purple-200 max-h-96 overflow-y-auto">
          <PromptPreviewContent settings={settings} />
        </div>
        
        <div className="mt-3 text-xs text-purple-600 flex items-center justify-between">
          <span>מתעדכן אוטומטית עם כל שינוי</span>
          <span>🔄 זמן אמת</span>
        </div>
      </Card>
    </div>
  )

  // רכיב טאב העדפות
  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 mb-4">
        הגדרות כלליות ותצורות נוספות
      </div>

      {/* הגדרות התראות */}
      <Card className="p-6">
        <h3 className="font-medium text-lg mb-4">התראות</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={settings.preferences.notificationSettings.urgentMatches}
              onChange={(e) => updateSettings('preferences.notificationSettings.urgentMatches', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">התראה על התאמות מעולות (ציון 8+)</span>
          </label>
          
          <label className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={settings.preferences.notificationSettings.weeklyReports}
              onChange={(e) => updateSettings('preferences.notificationSettings.weeklyReports', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">דוח שבועי</span>
          </label>
        </div>
      </Card>

      {/* הגדרות היסטוריה */}
      <Card className="p-6">
        <h3 className="font-medium text-lg mb-4">היסטוריה ושמירה</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={settings.preferences.saveSearchHistory}
              onChange={(e) => updateSettings('preferences.saveSearchHistory', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">שמור היסטוריית חיפושים</span>
          </label>
          
          <label className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={settings.preferences.autoRejectPreviousMatches}
              onChange={(e) => updateSettings('preferences.autoRejectPreviousMatches', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">אל תציע אותו זוג פעמיים</span>
          </label>
        </div>
      </Card>

      {/* מידע על עלויות */}
      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <h3 className="font-medium text-lg mb-4 text-yellow-900">מידע על עלויות</h3>
        <div className="space-y-2 text-sm text-yellow-700">
          <div>• GPT-4o Mini: ~$0.0001 לכל ניתוח</div>
          <div>• GPT-4o: ~$0.001 לכל ניתוח</div>
          <div>• עם {settings.maxMatches} זוגות מקס': ~${(settings.maxMatches * 0.0001).toFixed(4)} לחיפוש</div>
        </div>
      </Card>
    </div>
  )

  const tabs = [
    { id: 'connections' as const, label: 'התחברות וחיבורים', icon: Wifi },
    { id: 'matching' as const, label: 'הגדרות התאמה', icon: Target },
    { id: 'preferences' as const, label: 'העדפות כלליות', icon: Sliders },
  ]

  return (
    <Card className="max-w-6xl mx-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Settings className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">הגדרות מערכת</h2>
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
            
            {activeTab !== 'connections' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSettings(getDefaultAdvancedMatchingSettings())
                    setSelectedProfile('classic')
                    setHasChanges(true)
                  }}
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
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 space-x-reverse">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 space-x-reverse ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-[500px]">
          {activeTab === 'connections' && renderConnectionsTab()}
          {activeTab === 'matching' && renderMatchingTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
        </div>

        {/* Changes indicator */}
        {hasChanges && activeTab !== 'connections' && (
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
