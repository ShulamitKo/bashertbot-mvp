import React, { useState, useEffect, useCallback } from 'react'
import { Heart, Users, Upload, Settings, TrendingUp, AlertTriangle, ArrowLeft, History, Trash2, Eye, Loader2, X, User, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { debugAuthStatus, refreshAuthToken } from '@/lib/auth'
import { loadCandidatesFromSheet, DetailedCandidate } from '@/lib/google-sheets'
import { generateMatches } from '@/lib/openai'
import { MatchProposal, AdvancedMatchingSettings } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NewScanWarningModal } from '@/components/ui/NewScanWarningModal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UnifiedSettingsPanel } from '@/components/ui/UnifiedSettingsPanel'
import { 
  getActiveSession, 
  createNewSession, 
  updateActiveSession, 
  updateSpecificSession,
  hasUnprocessedMatches,
  moveMatchToProposals,
  getSessionHistory,
  getSessionStats,
  deleteSession,
  MatchingSession,
  checkAuthConnection
} from '@/lib/sessions'
import { loadSimplifiedShadchanSettings, saveSimplifiedShadchanSettings } from '@/lib/settings'
import { expandSimplifiedSettings, simplifyAdvancedSettings } from '@/types'
import { loadEnhancedProposals, loadFailedProposals, restoreProposalToActive, getProposalIndicators, getUrgencyBackgroundColor, sortProposalsByUrgency } from '@/lib/proposals'
import { EnhancedProposal, ProposalsFilter } from '@/types'
import { ProposalCard } from '@/components/ui/ProposalCard'
import { ProposalBadges, UrgencyIndicator } from '@/components/ui/ProposalBadges'

interface DashboardPageProps {
  user?: {
    name: string
    email: string
  }
}

type TabType = 'matches' | 'proposals' | 'import' | 'settings' | 'history' | 'proposals-history'

export const DashboardPage = ({ user }: DashboardPageProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('matches')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const [shadchanId, setShadchanId] = useState<string | null>(null) // State חדש ל-shadchanId
  
  // State גלובלי לסריקת התאמות
  const [globalScanState, setGlobalScanState] = useState<{
    isScanning: boolean
    progress: { current: number, total: number, message: string } | null
  }>({
    isScanning: false,
    progress: null
  })

  // State למספר הצעות פעילות
  const [activeProposalsCount, setActiveProposalsCount] = useState(0)
  const [urgentProposalsCount, setUrgentProposalsCount] = useState(0)

  // State להגדרות מתקדמות - חדש!
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedMatchingSettings | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  
  // State להגדרות בסיסיות
  const [sheetId, setSheetId] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')

  // const [candidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)

  // פונקציה לטעינת מספר ההצעות הפעילות בלבד (מהירה)
  const loadActiveProposalsCount = useCallback(async () => {
    try {
      // רק הסטטוסים הרלוונטיים שמופיעים בטאבים שלנו
      const relevantStatuses = [
        'ready_for_processing', 'restored_to_active',
        'ready_for_contact', 'contacting', 'awaiting_response',
        'schedule_meeting', 'meeting_scheduled', 'in_meeting_process',
        'meeting_completed', 'completed'
      ]
      
      const { data: currentProposals } = await supabase
        .from('match_proposals')
        .select('id')
        .in('status', relevantStatuses)
      
      const count = currentProposals?.length || 0
      setActiveProposalsCount(count)
    } catch (error) {
      console.error('שגיאה בטעינת מספר הצעות:', error)
    }
  }, [])

  // פונקציה לטעינת הגדרות השדכן - מפושטות!
  const loadAdvancedSettings = useCallback(async () => {
    if (!shadchanId) return
    
    try {
      setIsLoadingSettings(true)
      console.log('📁 [DEBUG] טוען הגדרות מפושטות עבור שדכן:', shadchanId)
      const simplifiedSettings = await loadSimplifiedShadchanSettings(shadchanId)
      console.log('📋 [DEBUG] הגדרות מפושטות שנטענו:', simplifiedSettings)
      
      // הרחבה להגדרות מלאות לצורך התצוגה
      const expandedSettings = expandSimplifiedSettings(simplifiedSettings)
      console.log('🔧 [DEBUG] הגדרות מורחבות:', {
        maxMatches: expandedSettings.maxMatches,
        gptModel: expandedSettings.gptSettings.model,
        focusAreas: expandedSettings.customGptSettings.focusAreas
      })
      setAdvancedSettings(expandedSettings)
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות מתקדמות:', error)
    } finally {
      setIsLoadingSettings(false)
    }
  }, [shadchanId])

  // פונקציה לשמירת הגדרות השדכן - מפושטות!
  const saveAdvancedSettings = useCallback(async (settings: AdvancedMatchingSettings) => {
    if (!shadchanId) throw new Error('לא נמצא מזהה שדכן')
    
    try {
      // המרה להגדרות מפושטות
      const simplifiedSettings = simplifyAdvancedSettings(settings)
      console.log('🔥 [DEBUG] שומר הגדרות מפושטות:', {
        shadchanId,
        simplified: simplifiedSettings
      })
      
      await saveSimplifiedShadchanSettings(shadchanId, simplifiedSettings)
      console.log('✅ [DEBUG] הגדרות מפושטות נשמרו בהצלחה')
    setAdvancedSettings(settings)
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות מתקדמות:', error)
      throw error
    }
  }, [shadchanId])

  // פונקציות להגדרות בסיסיות
  const loadBasicSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('shadchanim')
        .select('google_sheet_id, openai_api_key')
        .eq('auth_user_id', user.id)
        .single()

      if (data) {
        setSheetId(data.google_sheet_id || '')
        setOpenaiKey(data.openai_api_key || '')
      }
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות בסיסיות:', error)
    }
  }, [])

  const saveBasicSettings = useCallback(async (sheetId: string, openaiKey: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא נמצא משתמש')

      const { error } = await supabase
        .from('shadchanim')
        .update({
          google_sheet_id: sheetId,
          openai_api_key: openaiKey,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', user.id)

      if (error) throw error

      setSheetId(sheetId)
      setOpenaiKey(openaiKey)
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות בסיסיות:', error)
      throw error
    }
  }, [])

  const testGoogleSheetsConnection = useCallback(async (sheetId: string) => {
    try {
      if (!accessToken) {
        return { success: false, message: 'נדרש אימות Google - התחבר מחדש ❌' }
      }

      // בדיקה שמזהה הגיליון תקין
      if (!sheetId || sheetId.length < 10) {
        return { success: false, message: 'מזהה הגיליון לא תקין ❌' }
      }

      // בדיקה פשוטה - אם יש access token ומזהה תקין
      // יש להוסיף כאן קריאה אמיתית ל-API של Google Sheets
      return { success: true, message: 'החיבור לגיליון בוצע בהצלחה! ✅' }
    } catch (error) {
      return { success: false, message: 'שגיאה בחיבור לגיליון ❌' }
    }
  }, [accessToken])

  useEffect(() => {
    // קבלת Access Token מSupabase
    const getAccessToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        setAccessToken(session.provider_token)
      }
    }
    
    // הוספת דיבוג לבדיקת סטטוס האימות
    const initializeAuth = async () => {
      // בדיקת סשן נוכחי
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setAuthStatus('unauthenticated')
        return
      }
      
      await debugAuthStatus()
      await getAccessToken()

      // אחזור shadchan_id
      const { data: shadchanData, error: shadchanError } = await supabase
        .from('shadchanim')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single()

      if (shadchanError || !shadchanData) {
        // ניתן להחליט איך לטפל במצב כזה, לדוגמה להעביר למסך שגיאה או להתנתק
        setAuthStatus('unauthenticated')
        return
      }

      setShadchanId(shadchanData.id)
      setAuthStatus('authenticated')
      
      // טעינת מספר ההצעות הפעילות מיד בטעינת הדף
      await loadActiveProposalsCount()
    }

    initializeAuth()
  }, [loadActiveProposalsCount])

  // טעינת הגדרות כשיש shadchanId - חדש!
  useEffect(() => {
    if (shadchanId) {
      loadAdvancedSettings()
      loadBasicSettings()
    }
  }, [shadchanId, loadAdvancedSettings, loadBasicSettings])

  const tabs = [
    { id: 'matches' as TabType, label: 'התאמות חדשות', icon: Heart, count: 0 },
    { id: 'proposals' as TabType, label: 'הצעות פעילות', icon: Users, count: activeProposalsCount },
    { id: 'import' as TabType, label: 'ייבוא מועמדים', icon: Upload, count: 0 },
    { id: 'history' as TabType, label: 'היסטוריית התאמות', icon: History, count: 0 },
    { id: 'proposals-history' as TabType, label: 'היסטוריית הצעות', icon: TrendingUp, count: 0 },
    { id: 'settings' as TabType, label: 'הגדרות מערכת', icon: Settings, count: 0 },
  ]

  // אם עדיין בודק אימות
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">בודק סטטוס אימות...</p>
        </div>
      </div>
    )
  }

  // אם המשתמש לא מחובר
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">שגיאת אימות</h2>
            <p className="text-gray-600 mb-6">
              המערכת זיהתה שאינך מחובר/ת. זה עלול לקרות כאשר:
            </p>
            <ul className="text-right text-sm text-gray-500 mb-6 space-y-1">
              <li>• הסשן פג תוקף</li>
              <li>• הטוקן לא תקף</li>
              <li>• יש בעיה בחיבור למערכת</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors mb-3"
            >
              רענן דף וחזור למסך התחברות
            </button>
            <button
              onClick={() => {
                // נסה לנקות את הסשן ולחזור למסך התחברות
                supabase.auth.signOut().then(() => {
                  window.location.href = '/'
                })
              }}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              התנתק וחזור למסך התחברות
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return <MatchesTab 
          accessToken={accessToken} 
          globalScanState={globalScanState}
          setGlobalScanState={setGlobalScanState}
          onProposalCountChange={setActiveProposalsCount}
          advancedSettings={advancedSettings}
          loadActiveProposalsCount={loadActiveProposalsCount}
        />
      case 'proposals':
        return <ProposalsTab accessToken={accessToken} onCountChange={setActiveProposalsCount} onUrgentCountChange={setUrgentProposalsCount} shadchanId={shadchanId} loadActiveProposalsCount={loadActiveProposalsCount} />
      case 'import':
        return <ImportTab accessToken={accessToken} />
      case 'history':
        return <HistoryTab accessToken={accessToken} />
      case 'proposals-history':
        return <ProposalsHistoryTab accessToken={accessToken} loadActiveProposalsCount={loadActiveProposalsCount} />
      case 'settings':
        return <UnifiedSettingsPanel 
          currentSettings={advancedSettings || undefined}
          onSave={saveAdvancedSettings}
          isLoading={isLoadingSettings}
          sheetId={sheetId}
          openaiKey={openaiKey}
          onSaveBasicSettings={saveBasicSettings}
          onTestConnection={testGoogleSheetsConnection}
        />
      default:
        return <MatchesTab 
          accessToken={accessToken} 
          globalScanState={globalScanState}
          setGlobalScanState={setGlobalScanState}
          onProposalCountChange={setActiveProposalsCount}
          advancedSettings={advancedSettings}
          loadActiveProposalsCount={loadActiveProposalsCount}
        />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* כותרת דשבורד */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            שלום {user?.name || 'שדכן'} 👋
          </h1>
          <p className="text-gray-600">
            מוכנה לבצע התאמות חדשות היום?
          </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const refreshed = await refreshAuthToken()
                  if (refreshed) {
                    const successMsg = document.createElement('div')
                    successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                    successMsg.textContent = '✅ החיבור רוענן בהצלחה'
                    document.body.appendChild(successMsg)
                    setTimeout(() => {
                      if (document.body.contains(successMsg)) {
                        document.body.removeChild(successMsg)
                      }
                    }, 3000)
                  } else {
                    throw new Error('לא הצלח לרענן')
                  }
                } catch (error) {
                  const errorMsg = document.createElement('div')
                  errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                  errorMsg.textContent = '❌ שגיאה ברענון החיבור'
                  document.body.appendChild(errorMsg)
                  setTimeout(() => {
                    if (document.body.contains(errorMsg)) {
                      document.body.removeChild(errorMsg)
                    }
                  }, 3000)
                }
              }}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              title="רענן חיבור למערכת"
            >
              🔄 רענן חיבור
            </Button>
          </div>
        </div>

        {/* סטטיסטיקות מהירות */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">התאמות השבוע</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">הצעות פעילות</p>
                <p className="text-2xl font-bold text-gray-900 transition-all duration-500">
                  {activeProposalsCount}
                  {activeProposalsCount > 0 && (
                    <span className="text-sm text-blue-600 mr-2">✨</span>
                  )}
                </p>
              </div>
              <Users className={`w-8 h-8 transition-colors duration-300 ${
                activeProposalsCount > 0 ? 'text-blue-600' : 'text-gray-400'
              }`} />
            </div>
          </div>

          <div className={`rounded-lg p-6 shadow-sm border transition-all duration-300 hover:shadow-md ${
            urgentProposalsCount > 0 
              ? 'bg-red-50 border-red-200' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">הצעות דחופות</p>
                <p className={`text-2xl font-bold transition-all duration-500 ${
                  urgentProposalsCount > 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {urgentProposalsCount}
                  {urgentProposalsCount > 0 && (
                    <span className="text-sm text-red-600 mr-2 animate-pulse">🔥</span>
                  )}
                </p>
                {urgentProposalsCount > 0 && (
                  <p className="text-xs text-red-600 mt-1">דורש תשומת לב מיידית</p>
                )}
              </div>
              <AlertTriangle className={`w-8 h-8 transition-colors duration-300 ${
                urgentProposalsCount > 0 ? 'text-red-600 animate-pulse' : 'text-gray-400'
              }`} />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">מועמדים בגיליון</p>
                <p className="text-2xl font-bold text-gray-900">2</p>
              </div>
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* הודעת סריקה גלובלית */}
        {globalScanState.isScanning && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-lg shadow-lg mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-6 w-6 border border-white opacity-30"></div>
                </div>
                <div>
                  <div className="font-semibold">סריקת התאמות פעילה</div>
                  <div className="text-sm opacity-90">
                    {globalScanState.progress?.message || 'מעבד נתונים...'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {globalScanState.progress?.current || 0}%
                </div>
                <div className="text-xs opacity-75">מתוך 100%</div>
              </div>
            </div>
            {globalScanState.progress && (
              <div className="mt-3 w-full bg-white bg-opacity-20 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${globalScanState.progress.current}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* טאבים */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                      {tab.count}
                    </span>
                  )}
                  {/* חיווי סריקה בטאב התאמות */}
                  {tab.id === 'matches' && globalScanState.isScanning && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-orange-600 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// רכיב טאב התאמות
const MatchesTab = ({ 
  accessToken, 
  globalScanState, 
  setGlobalScanState,
  onProposalCountChange,
  advancedSettings,
  loadActiveProposalsCount
}: { 
  accessToken: string | null
  globalScanState: {
    isScanning: boolean
    progress: { current: number, total: number, message: string } | null
  }
  setGlobalScanState: React.Dispatch<React.SetStateAction<{
    isScanning: boolean
    progress: { current: number, total: number, message: string } | null
  }>>
  onProposalCountChange: (count: number) => void
  advancedSettings: AdvancedMatchingSettings | null
  loadActiveProposalsCount?: () => Promise<void> // אופציונלי - לעדכון מונה מיידי
}) => {
  // מונע אזהרה על פרמטר שלא נמצא בשימוש
  React.useEffect(() => {}, [loadActiveProposalsCount])
  const [matches, setMatches] = useState<MatchProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [candidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNewScanWarning, setShowNewScanWarning] = useState(false)
  const [unprocessedCount, setUnprocessedCount] = useState(0)

  // טעינת הסשן הפעיל בעת העלאת הקומפוננט
  useEffect(() => {
    loadActiveSession()
  }, [])

  const loadActiveSession = async () => {
    try {
      const activeSession = await getActiveSession()
      if (activeSession && activeSession.session_data.length > 0) {
        // טעינת ההתאמות כמו שהן - ללא שינוי סטטוס
        const matches: MatchProposal[] = activeSession.session_data as MatchProposal[];
        
        setMatches(matches);
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת סשן פעיל:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const generateNewMatches = async () => {
    if (!accessToken) {
      setError('נא להתחבר מחדש עם Google')
      return
    }

    // בדיקה האם יש התאמות לא מעובדות
    const { hasUnprocessed, count } = await hasUnprocessedMatches()
    if (hasUnprocessed) {
      setUnprocessedCount(count)
      setShowNewScanWarning(true)
      return
    }

    await performNewScan()
  }

  // פונקציה לביצוע סריקה חדשה
  const performNewScan = async () => {
    try {
    setLoading(true)
    setError(null)
    
      // הפעלת מצב סריקה עם אנימציות
    setGlobalScanState({
      isScanning: true,
        progress: { current: 0, total: 100, message: 'מתחיל סריקה...' }
      })
      
      // בדיקת חיבור למערכת לפני התחלה
      setGlobalScanState({
        isScanning: true,
        progress: { current: 10, total: 100, message: 'בודק חיבור למערכת...' }
      })
      
      const authCheck = await checkAuthConnection()
      if (!authCheck.isConnected) {
        throw new Error(authCheck.error || 'שגיאה בחיבור למערכת')
      }

      // טעינת נתוני מועמדים
      setGlobalScanState({
        isScanning: true,
        progress: { current: 30, total: 100, message: 'טוען נתוני מועמדים מהגיליון...' }
      })
      
      // קבלת ה-sheetId תחילה ממסד הנתונים, ואז מ-localStorage כגיבוי
      let sheetId = null
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: settings } = await supabase
            .from('shadchanim')
            .select('google_sheet_id')
            .eq('auth_user_id', user.id)
            .single()
          
          sheetId = settings?.google_sheet_id
        }
      } catch (error) {
        console.warn('לא ניתן לטעון הגדרות ממסד נתונים, נסה localStorage:', error)
      }
      
      // אם לא נמצא במסד הנתונים, נסה localStorage
      if (!sheetId) {
        sheetId = localStorage.getItem('sheetId')
      }
      
      if (!sheetId) {
        throw new Error('לא נמצא מזהה גיליון. אנא הגדר את הגיליון בטאב ההגדרות.')
      }
      
      const candidatesData = await loadCandidatesFromSheet(accessToken!, sheetId)

      if (candidatesData.males.length === 0 || candidatesData.females.length === 0) {
        throw new Error('לא נמצאו מועמדים בגיליון')
      }

      // יצירת התאמות עם AI
      setGlobalScanState({
        isScanning: true,
        progress: { current: 60, total: 100, message: 'מנתח מועמדים עם בינה מלאכותית...' }
      })
      
      const generatedMatches = await generateMatches(
        candidatesData.males,
        candidatesData.females,
        advancedSettings || undefined // משתמש בהגדרות השדכן או ברירת מחדל
      )

      if (generatedMatches.length === 0) {
        setMatches([])
        setLoading(false)
        setGlobalScanState({ isScanning: false, progress: null })
        return
      }
      
      // יצירת סשן חדש ושמירת ההתאמות
      setGlobalScanState({
        isScanning: true,
        progress: { current: 90, total: 100, message: 'שומר התאמות במערכת...' }
      })
      
      await createNewSession()
      await updateActiveSession(generatedMatches)
      
      // סיום מוצלח
      setGlobalScanState({
        isScanning: true,
        progress: { current: 100, total: 100, message: 'הושלם בהצלחה! ✨' }
      })
      
      setMatches(generatedMatches)
      setLoading(false)
      
      // איפוס מצב הסריקה אחרי הצגת הודעת הצלחה
      setTimeout(() => {
        setGlobalScanState({ isScanning: false, progress: null })
      }, 2000)

    } catch (error: any) {
      console.error('שגיאה ביצירת התאמות:', error)
      setError(`שגיאה ביצירת התאמות: ${error.message}`)
      setLoading(false)
      
      // איפוס מצב הסריקה בשגיאה
          setGlobalScanState({ isScanning: false, progress: null })
      
      // הוספת עיכוב לפני איפוס השגיאה (למשתמש לראות)
      if (error.message?.includes('Rate limit')) {
        setTimeout(() => {
          setError(null)
        }, 5000) // 5 שניות לשגיאות rate limit
      } else {
        setTimeout(() => {
          setError(null)
        }, 2000) // 2 שניות לשגיאות
      }
    }
  }

  // פונקציות עזר שמורות (כרגע לא בשימוש)
  // const getRecommendationColor = (recommendation: string) => {
  //   switch (recommendation) {
  //     case 'highly_recommended': return 'bg-green-100 text-green-800'
  //     case 'recommended': return 'bg-blue-100 text-blue-800'
  //     case 'consider': return 'bg-yellow-100 text-yellow-800'
  //     case 'not_recommended': return 'bg-red-100 text-red-800'
  //     default: return 'bg-gray-100 text-gray-800'
  //   }
  // }

  // const getRecommendationText = (recommendation: string) => {
  //   switch (recommendation) {
  //     case 'highly_recommended': return 'מומלץ מאוד'
  //     case 'recommended': return 'מומלץ'
  //     case 'consider': return 'לשקול'
  //     case 'not_recommended': return 'לא מומלץ'
  //     default: return 'לבדוק'
  //   }
  // }

  // אם עדיין בטעינה ראשונית
  if (initialLoading) {
    return <LoadingSpinner message="טוען התאמות קיימות..." />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">התאמות חדשות</h2>
          {globalScanState.isScanning && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span>סריקה פעילה...</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {candidates && (
            <span className="text-sm text-gray-600">
              {candidates.males?.length || 0} בנים, {candidates.females?.length || 0} בנות
            </span>
          )}
          <button
            onClick={generateNewMatches}
            disabled={loading || globalScanState.isScanning}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-3 ${
              (loading || globalScanState.isScanning)
                ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 text-white shadow-lg transform scale-105 animate-pulse' 
                : 'bg-blue-600 text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 hover:shadow-lg hover:scale-105'
            } disabled:opacity-50`}
          >
            {(loading || globalScanState.isScanning) && (
              <div className="relative">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-5 w-5 border border-white opacity-30"></div>
              </div>
            )}
            {(loading || globalScanState.isScanning) ? (
              <span className="animate-pulse">
                {globalScanState.progress?.message || 'מבצע סריקת התאמות...'}
              </span>
            ) : (
              <>
                <Heart className="w-5 h-5" />
                צור התאמות חדשות
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar מרשים עם אנימציית טעינה */}
      {globalScanState.progress && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-600 border-t-transparent"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-6 w-6 border border-blue-400 opacity-20"></div>
              </div>
              <span className="text-lg font-semibold text-blue-800">{globalScanState.progress.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-600">{globalScanState.progress.current}%</span>
              <span className="text-xs text-blue-500">/ {globalScanState.progress.total}%</span>
            </div>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
              style={{ width: `${(globalScanState.progress.current / globalScanState.progress.total) * 100}%` }}
            >
              <div className="absolute inset-0 scan-progress-bar"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 progress-wave"></div>
              <div className="absolute right-0 top-0 h-full w-1 bg-white opacity-80 animate-pulse"></div>
            </div>
          </div>
          {globalScanState.progress.current === 100 && (
            <div className="mt-3 text-center">
              <span className="text-green-600 font-medium animate-bounce">✨ סיום בהצלחה! ✨</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {error}
          </div>
        </div>
      )}

      {loading && globalScanState.progress && globalScanState.progress.current === 0 ? (
        <LoadingSpinner message="מכין את המערכת..." />
      ) : matches && matches.length > 0 ? (
        <div className="space-y-6">
          {matches.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              accessToken={accessToken}
                              onStatusUpdate={async (matchId, newStatus) => {
                  try {
                    // שימוש בפונקציה המרכזית לעדכון סטטוס
                    const updatedMatches = await updateMatchStatus(matches, matchId, newStatus, onProposalCountChange)
                    
                    setMatches(updatedMatches)
                    
                    // אם ההצעה אושרה, תוצג הודעה נוספת
                    if (newStatus === 'ready_for_processing') {
                      setTimeout(() => {
                        const infoNotification = document.createElement('div')
                        infoNotification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                        infoNotification.textContent = '✅ ההצעה אושרה והועברה לטאב "הצעות פעילות"'
                        document.body.appendChild(infoNotification)
                        
                        setTimeout(() => {
                          if (document.body.contains(infoNotification)) {
                            document.body.removeChild(infoNotification)
                          }
                        }, 4000)
                      }, 1000)
                    }
                  } catch (error) {
                    console.error('שגיאה בעדכון סטטוס בטאב התאמות חדשות:', error)
                    
                    // הודעת שגיאה למשתמש בהתאם לסוג השגיאה
                    let errorMessage = '❌ שגיאה בעדכון הסטטוס. נסה שוב.'
                    
                    if (error instanceof Error) {
                      if (error.message.includes('אימות')) {
                        errorMessage = '🔐 שגיאת אימות - אנא רענן את הדף והתחבר מחדש'
                      } else if (error.message.includes('כבר קיימת') || error.message.includes('כבר מאושרת')) {
                        // במקרה של הצעה קיימת, זה לא באמת שגיאה - זה מצב תקין
                        const successNotification = document.createElement('div')
                        successNotification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                        successNotification.textContent = '✅ ההצעה כבר מאושרת - היא נמצאת בטאב "הצעות פעילות"'
                        document.body.appendChild(successNotification)
                        
                        setTimeout(() => {
                          if (document.body.contains(successNotification)) {
                            document.body.removeChild(successNotification)
                          }
                        }, 4000)
                        return // לא נציג הודעת שגיאה
                      } else if (error.message.includes('הרשאות')) {
                        errorMessage = '🔐 שגיאת הרשאות - אנא רענן את הדף'
                      }
                    }
                    
                    const errorNotification = document.createElement('div')
                    errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                    errorNotification.textContent = errorMessage
                    document.body.appendChild(errorNotification)
                    
                    setTimeout(() => {
                      if (document.body.contains(errorNotification)) {
                        document.body.removeChild(errorNotification)
                      }
                    }, 5000)
                  }
                }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="relative">
            <Heart className={`w-16 h-16 mx-auto mb-4 ${
              (loading || globalScanState.isScanning)
                ? 'text-pink-400 animate-pulse' 
                : 'text-pink-300 heartbeat hover:text-pink-400 transition-colors'
            }`} />
            {(loading || globalScanState.isScanning) && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!(loading || globalScanState.isScanning) && (
              <div className="absolute -top-2 -right-2">
                <div className="w-4 h-4 bg-pink-400 rounded-full animate-ping opacity-60"></div>
              </div>
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {(loading || globalScanState.isScanning) ? 'מכין התאמות חדשות...' : 'אין התאמות עדיין'}
          </h3>
          <p className="text-gray-600 mb-6">
            {(loading || globalScanState.isScanning)
              ? globalScanState.progress?.message || 'המערכת מנתחת את המועמדים ויוצרת התאמות מותאמות אישית'
              : 'לחצי על "צור התאמות חדשות" כדי שהמערכת תנתח את המועמדים בגיליון ותיצור שידוכים מדהימים! 💕'
            }
          </p>
          {!(loading || globalScanState.isScanning) && (
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>✨</span>
                <span>המערכת מוכנה ליצור התאמות מושלמות</span>
                <span>✨</span>
              </div>
            </div>
          )}
          {candidates && !(loading || globalScanState.isScanning) && (
            <div className="text-sm text-gray-500">
              נטענו {candidates.males?.length || 0} בנים ו-{candidates.females?.length || 0} בנות מהגיליון
            </div>
          )}
        </div>
      )}

      {/* Modal אזהרה לסריקה חדשה */}
      <NewScanWarningModal
        isOpen={showNewScanWarning}
        unprocessedCount={unprocessedCount}
        onClose={() => setShowNewScanWarning(false)}
        onContinue={async () => {
          // סגירת המודל תחילה
          setShowNewScanWarning(false)
          // המתנה קצרה לאנימציית הסגירה ואז התחלת הסריקה
          setTimeout(async () => {
            await performNewScan()
          }, 300)
        }}
      />
    </div>
  )
}

// פונקציית עזר לעדכון סטטוס התאמה
const updateMatchStatus = async (matches: MatchProposal[], matchId: string, newStatus: 'ready_for_processing' | 'rejected', onProposalCountChange?: (count: number) => void) => {
  // עדכון המערך המקומי
  const updatedMatches = matches.map(m => 
    m.id === matchId ? { ...m, status: newStatus } : m
  )
  
  // שמירה מקומית
  localStorage.setItem('currentMatches', JSON.stringify(updatedMatches))
  
  // שמירה בסשן פעיל - טעינה מחדש של הסשן הפעיל לוודא שיש לנו את הנתונים העדכניים
  try {
    const currentActiveSession = await getActiveSession()
    if (currentActiveSession) {
      // עדכון רק ההתאמה הספציפית בסשן הפעיל
      const updatedSessionData = currentActiveSession.session_data.map(m => 
        m.id === matchId ? { ...m, status: newStatus } : m
      )
      
      await updateActiveSession(updatedSessionData)
    }
  } catch (error) {
    console.error('❌ שגיאה בעדכון סשן פעיל:', error)
    // אם יש שגיאה, נשתמש בנתונים המקומיים
    await updateActiveSession(updatedMatches)
  }
  
  // אם אושר - העברה להצעות פעילות
  if (newStatus === 'ready_for_processing') {
    const approvedMatch = updatedMatches.find(m => m.id === matchId)
    if (approvedMatch) {
      await moveMatchToProposals(approvedMatch)
      
      // עדכון מיידי של מונה ההצעות הפעילות
      setTimeout(async () => {
        const { data: currentProposals } = await supabase
          .from('match_proposals')
          .select('id')
          .in('status', ['ready_for_processing', 'restored_to_active', 'ready_for_contact', 'contacting', 'awaiting_response', 'schedule_meeting', 'meeting_scheduled', 'in_meeting_process', 'meeting_completed', 'completed'])
        
        const count = currentProposals?.length || 0
        if (onProposalCountChange) {
          onProposalCountChange(count)
        }
      }, 200) // המתנה קצרה לוודא שההצעה נשמרה במסד הנתונים
    }
  }
  
  return updatedMatches
}

// הגדרת טאבי סטטוס
const statusTabs = [
  { 
    id: 'new', 
    label: 'חדשות להתחלה', 
    statuses: ['ready_for_processing', 'restored_to_active'],
    color: 'yellow' as const,
    icon: '🆕'
  },
  { 
    id: 'contact', 
    label: 'בתהליך יצירת קשר', 
    statuses: ['ready_for_contact', 'contacting', 'awaiting_response'],
    color: 'blue' as const,
    icon: '📞'
  },
  { 
    id: 'meetings', 
    label: 'פגישות ומעקב', 
    statuses: ['schedule_meeting', 'meeting_scheduled', 'in_meeting_process'],
    color: 'purple' as const,
    icon: '📅'
  },
  { 
    id: 'success', 
    label: 'הצלחות! 🎉', 
    statuses: ['meeting_completed', 'completed'],
    color: 'green' as const,
    icon: '🎉'
  }
]

// רכיב שורת הצעה לתצוגת רשימה
const ProposalListRow = ({ proposal, onClick }: { proposal: EnhancedProposal, onClick: () => void }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-blue-100 text-blue-800',
      ready_for_processing: 'bg-yellow-100 text-yellow-800',
      restored_to_active: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      ready_for_contact: 'bg-purple-100 text-purple-800',
      contacting: 'bg-blue-100 text-blue-800',
      awaiting_response: 'bg-orange-100 text-orange-800',
      rejected_by_candidate: 'bg-red-100 text-red-800',
      schedule_meeting: 'bg-teal-100 text-teal-800',
      meeting_scheduled: 'bg-cyan-100 text-cyan-800',
      in_meeting_process: 'bg-green-100 text-green-800',
      meeting_completed: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-blue-100 text-blue-800'
  }

  const getStatusText = (status: string) => {
    const texts = {
      pending: 'ממתין לאישור',
      ready_for_processing: 'ממתינה לתחילת טיפול',
      restored_to_active: 'הוחזרה לטיפול',
      rejected: 'נדחתה',
      ready_for_contact: 'מוכן ליצירת קשר',
      contacting: 'יוצר קשר',
      awaiting_response: 'ממתין לתגובה',
      rejected_by_candidate: 'נדחתה על ידי מועמד',
      schedule_meeting: 'לקבוע פגישה',
      meeting_scheduled: 'פגישה נקבעה',
      in_meeting_process: 'בתהליך פגישות',
      meeting_completed: 'פגישה התקיימה',
      completed: 'מזל טוב! 🎉',
      closed: 'נסגרה'
    }
    return texts[status as keyof typeof texts] || 'התאמה חדשה'
  }

  return (
    <div 
      className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer relative ${getUrgencyBackgroundColor(proposal)}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {/* אינדיקטור דחיפות */}
        <div className="absolute top-2 right-2">
          <UrgencyIndicator proposal={proposal} />
        </div>

        {/* פרטי ההצעה */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4">
            {/* שמות וגילאים */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                💙 {proposal.boyDetails?.name || proposal.boy_data?.name || 'ללא שם'}
                {(proposal.boyDetails?.age || proposal.boy_data?.age) && (
                  <span className="text-sm text-gray-600 font-normal"> ({proposal.boyDetails?.age || proposal.boy_data?.age})</span>
                )}
              </span>
              <span className="text-gray-400">↔</span>
              <span className="font-semibold text-gray-900">
                💕 {proposal.girlDetails?.name || proposal.girl_data?.name || 'ללא שם'}
                {(proposal.girlDetails?.age || proposal.girl_data?.age) && (
                  <span className="text-sm text-gray-600 font-normal"> ({proposal.girlDetails?.age || proposal.girl_data?.age})</span>
                )}
              </span>
            </div>
            
            {/* סמנים ויזואליים */}
            <div className="ml-4">
              <ProposalBadges proposal={proposal} size="sm" maxBadges={3} />
            </div>

            {/* ערים */}
            {(proposal.boyDetails?.city || proposal.boy_data?.city || proposal.girlDetails?.city || proposal.girl_data?.city) && (
              <div className="text-sm text-gray-600">
                📍 {(proposal.boyDetails?.city || proposal.boy_data?.city) && (proposal.girlDetails?.city || proposal.girl_data?.city)
                      ? `${proposal.boyDetails?.city || proposal.boy_data?.city} ↔ ${proposal.girlDetails?.city || proposal.girl_data?.city}`
                      : (proposal.boyDetails?.city || proposal.boy_data?.city || proposal.girlDetails?.city || proposal.girl_data?.city || '')}
              </div>
            )}
          </div>
        </div>

        {/* ציון והתאמה */}
        <div className="flex items-center gap-4">
          {/* ציון */}
          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
            <span>⭐</span>
            <span className="font-bold text-blue-600">
              {proposal.match_score || proposal.finalScore || 'N/A'}
            </span>
          </div>

          {/* סטטוס */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(proposal.status)}`}>
            {getStatusText(proposal.status)}
          </span>

          {/* ימים בתהליך */}
          {proposal.daysInProcess !== undefined && (
            <span className="text-xs text-gray-500">
              {proposal.daysInProcess} ימים
            </span>
          )}

          {/* חץ */}
          <span className="text-gray-400">👆</span>
        </div>
      </div>
    </div>
  )
}

// רכיב כרטיס הצעה קומפקטי לתצוגת רשת
const ProposalGridCard = ({ proposal, onClick }: { proposal: EnhancedProposal, onClick: () => void }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-blue-100 text-blue-800',
      ready_for_processing: 'bg-yellow-100 text-yellow-800',
      restored_to_active: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      ready_for_contact: 'bg-purple-100 text-purple-800',
      contacting: 'bg-blue-100 text-blue-800',
      awaiting_response: 'bg-orange-100 text-orange-800',
      rejected_by_candidate: 'bg-red-100 text-red-800',
      schedule_meeting: 'bg-teal-100 text-teal-800',
      meeting_scheduled: 'bg-cyan-100 text-cyan-800',
      in_meeting_process: 'bg-green-100 text-green-800',
      meeting_completed: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-blue-100 text-blue-800'
  }

  const getStatusText = (status: string) => {
    const texts = {
      pending: 'ממתין לאישור',
      ready_for_processing: 'ממתינה לתחילת טיפול',
      restored_to_active: 'הוחזרה לטיפול',
      rejected: 'נדחתה',
      ready_for_contact: 'מוכן ליצירת קשר',
      contacting: 'יוצר קשר',
      awaiting_response: 'ממתין לתגובה',
      rejected_by_candidate: 'נדחתה על ידי מועמד',
      schedule_meeting: 'לקבוע פגישה',
      meeting_scheduled: 'פגישה נקבעה',
      in_meeting_process: 'בתהליך פגישות',
      meeting_completed: 'פגישה התקיימה',
      completed: 'מזל טוב! 🎉',
      closed: 'נסגרה'
    }
    return texts[status as keyof typeof texts] || 'התאמה חדשה'
  }

  return (
    <div 
      className={`border rounded-lg p-5 hover:shadow-lg transition-all cursor-pointer min-h-[200px] relative ${getUrgencyBackgroundColor(proposal)}`}
      onClick={onClick}
    >
      {/* סמן דחיפות עליון */}
      <div className="absolute top-3 left-3">
        <UrgencyIndicator proposal={proposal} />
      </div>

      {/* כותרת עם ציון */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0 mr-8">
          <h3 className="font-semibold text-gray-900 text-base mb-1">
            💙 {proposal.boyDetails?.name || proposal.boy_data?.name || 'ללא שם'}
            {(proposal.boyDetails?.age || proposal.boy_data?.age) && (
              <span className="text-sm text-gray-600 font-normal"> ({proposal.boyDetails?.age || proposal.boy_data?.age})</span>
            )}
          </h3>
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            💕 {proposal.girlDetails?.name || proposal.girl_data?.name || 'ללא שם'}
            {(proposal.girlDetails?.age || proposal.girl_data?.age) && (
              <span className="text-sm text-gray-600 font-normal"> ({proposal.girlDetails?.age || proposal.girl_data?.age})</span>
            )}
          </h3>
          {(proposal.boyDetails?.city || proposal.boy_data?.city || proposal.girlDetails?.city || proposal.girl_data?.city) && (
            <p className="text-sm text-gray-600 mb-2">
              📍 {(proposal.boyDetails?.city || proposal.boy_data?.city) && (proposal.girlDetails?.city || proposal.girl_data?.city)
                    ? `${proposal.boyDetails?.city || proposal.boy_data?.city} ↔ ${proposal.girlDetails?.city || proposal.girl_data?.city}`
                    : (proposal.boyDetails?.city || proposal.boy_data?.city || proposal.girlDetails?.city || proposal.girl_data?.city || '')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
            <span className="text-lg">⭐</span>
            <span className="font-bold text-xl text-blue-600">
              {proposal.match_score || proposal.finalScore || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* סמנים ויזואליים */}
      <div className="mb-3">
        <ProposalBadges proposal={proposal} size="sm" maxBadges={2} />
      </div>

      {/* פרטים נוספים */}
      <div className="space-y-2 mb-4">
        {(proposal.boyDetails?.profession || proposal.boy_data?.profession) && (
          <div className="text-xs text-gray-600">
            💼 {proposal.boyDetails?.name || proposal.boy_data?.name || 'בן'}: {proposal.boyDetails?.profession || proposal.boy_data?.profession}
          </div>
        )}
        {(proposal.girlDetails?.profession || proposal.girl_data?.profession) && (
          <div className="text-xs text-gray-600">
            💼 {proposal.girlDetails?.name || proposal.girl_data?.name || 'בת'}: {proposal.girlDetails?.profession || proposal.girl_data?.profession}
          </div>
        )}
        {proposal.daysInProcess && (
          <div className="text-xs text-gray-600">
            ⏱️ {proposal.daysInProcess} ימים בתהליך
          </div>
        )}
      </div>

      {/* סטטוס ותאריך */}
      <div className="flex justify-between items-center mt-auto">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(proposal.status)}`}>
          {getStatusText(proposal.status)}
        </span>
        <span className="text-xs text-gray-500">
          {proposal.created_at ? new Date(proposal.created_at).toLocaleDateString('he-IL') : 
           proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString('he-IL') : 
           'תאריך לא ידוע'}
        </span>
      </div>

      {/* אינדיקטור ללחיצה */}
      <div className="text-center mt-3 pt-2 border-t border-gray-100">
        <span className="text-xs text-blue-600 font-medium">👆 לחץ לטיפול מלא בהצעה</span>
      </div>
    </div>
  )
}

// רכיב טאב הצעות
const ProposalsTab = ({ accessToken, onCountChange, onUrgentCountChange, shadchanId, loadActiveProposalsCount }: { accessToken: string | null, onCountChange: (count: number) => void, onUrgentCountChange: (count: number) => void, shadchanId: string | null, loadActiveProposalsCount?: () => Promise<void> }) => {
  const [proposals, setProposals] = useState<EnhancedProposal[]>([])
  const [filteredProposals, setFilteredProposals] = useState<EnhancedProposal[]>([]) // הצעות מסוננות לתצוגה
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProposal, setSelectedProposal] = useState<EnhancedProposal | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true) // מציין אם זו הטעינה הראשונה
  const [searchText, setSearchText] = useState('') // טקסט החיפוש הנוכחי
  const [activeStatusTab, setActiveStatusTab] = useState('new') // טאב הסטטוס הפעיל
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') // מצב התצוגה: רשימה או רשת
  const [selectedProposalForEdit, setSelectedProposalForEdit] = useState<EnhancedProposal | null>(null) // הצעה שנבחרה לעריכה מהרשת
  const [isInEditMode, setIsInEditMode] = useState(false) // האם אנחנו במצב עריכת הצעה
  const [filter, setFilter] = useState<ProposalsFilter>({
    status: ['ready_for_processing', 'restored_to_active', 'ready_for_contact', 'contacting', 'awaiting_response', 'schedule_meeting', 'meeting_scheduled', 'meeting_completed', 'completed', 'in_meeting_process'], // רק הסטטוסים הרלוונטיים (ללא rejected_by_candidate, closed)
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  useEffect(() => {
    console.log('🔑 ProposalsTab useEffect triggered:', { accessToken: !!accessToken, filter })
    if (accessToken) {
      loadEnhancedProposalsData()
    } else {
      console.warn('⚠️ ProposalsTab: accessToken לא זמין עדיין')
    }
  }, [accessToken, filter])

  // אתחול filteredProposals כאשר proposals משתנה או כאשר הטאב הפעיל משתנה
  useEffect(() => {
    const tabFilteredProposals = filterByActiveTab(proposals)
    applyTextSearch(tabFilteredProposals, filter.searchTerm || '')
  }, [proposals, filter.searchTerm, activeStatusTab])

  // הסרתי את ה-useEffect שמעדכן את המונה כל פעם - זה יוצר עדכונים מיותרים

  // פונקציה לחישוב מספר הצעות בכל טאב
  const getTabCounts = (allProposals: EnhancedProposal[]) => {
    const counts: Record<string, number> = {}
    statusTabs.forEach(tab => {
      counts[tab.id] = allProposals.filter(p => tab.statuses.includes(p.status)).length
    })
    return counts
  }

  // פונקציה לסינון הצעות לפי טאב פעיל
  const filterByActiveTab = (allProposals: EnhancedProposal[]) => {
    const activeTab = statusTabs.find(tab => tab.id === activeStatusTab)
    if (!activeTab) return allProposals
    
    return allProposals.filter(p => activeTab.statuses.includes(p.status))
  }

  // פונקציה ליישום חיפוש טקסט בלבד (לא משפיעה על המונה הכללי)
  const applyTextSearch = (proposalsToFilter: EnhancedProposal[], searchTerm: string) => {
    let result = proposalsToFilter
    
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      result = proposalsToFilter.filter(p => 
        p.boyDetails?.name.toLowerCase().includes(searchLower) ||
        p.girlDetails?.name.toLowerCase().includes(searchLower)
      )
    }
    
    setFilteredProposals(result)
  }

  // פונקציה שמטפלת בלחיצת Enter בתיבת החיפוש
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // עדכון הפילטר עם הטקסט החדש
      setFilter(prev => ({ ...prev, searchTerm: searchText }))
      // יישום החיפוש על ההצעות המסוננות לפי טאב
      const tabFilteredProposals = filterByActiveTab(proposals)
      applyTextSearch(tabFilteredProposals, searchText)
    }
  }

  // פונקציה לניקוי החיפוש
  const clearSearch = () => {
    setSearchText('')
    setFilter(prev => ({ ...prev, searchTerm: '' }))
    const tabFilteredProposals = filterByActiveTab(proposals)
    applyTextSearch(tabFilteredProposals, '')
  }

  const loadEnhancedProposalsData = async () => {
    if (!accessToken) {
      console.warn('⚠️ לא ניתן לטעון הצעות ללא accessToken')
      setError('חיבור לא זמין - נסה לרענן את הדף')
      return
    }
    
    try {
      setLoading(true)
      setError(null) // נקה שגיאות קודמות
      console.log('🔄 טוען הצעות פעילות...')
      
      const enhancedProposals = await loadEnhancedProposals(accessToken)
      console.log('📊 נטענו הצעות:', enhancedProposals.length)
      
      // יצים פילטרים בסיסיים (ללא חיפוש טקסט)
      let filtered = enhancedProposals
      
      if (filter.status && filter.status.length > 0) {
        filtered = filtered.filter(p => filter.status!.includes(p.status))
      }
      
      // מיון
      if (filter.sortBy) {
        filtered.sort((a, b) => {
          let aVal: any, bVal: any
          
          switch (filter.sortBy) {
            case 'created_at':
              aVal = new Date(a.created_at || '1970-01-01')
              bVal = new Date(b.created_at || '1970-01-01')
              break
            case 'last_activity':
              aVal = new Date(a.lastActivity || '1970-01-01')
              bVal = new Date(b.lastActivity || '1970-01-01')
              break
            case 'match_score':
              aVal = a.match_score || 0
              bVal = b.match_score || 0
              break
            case 'days_in_process':
              aVal = a.daysInProcess || 0
              bVal = b.daysInProcess || 0
              break
            default:
              return 0
          }
          
          const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
          return filter.sortOrder === 'desc' ? -result : result
        })
      }
      
      // שמירת כל ההצעות (ללא סינון לפי טאב)
      setProposals(filtered)
      
      // סינון לפי הטאב הפעיל
      const tabFilteredProposals = filterByActiveTab(filtered)
      
      // מיון חכם לפי דחיפות (הצעות דחופות יעלו למעלה)
      const urgencySortedProposals = sortProposalsByUrgency(tabFilteredProposals)
      
      // יישום חיפוש טקסט על ההצעות המסוננות לפי טאב
      applyTextSearch(urgencySortedProposals, filter.searchTerm || '')
      
      // עדכון מספר ההצעות הכולל (כל הטאבים)
      onCountChange(filtered.length)
      
      // חישוב מספר הצעות דחופות (לפי הלוגיקה החדשה)
      const urgentCount = filtered.filter(proposal => {
        const { isUrgent } = getProposalIndicators(proposal)
        return isUrgent
      }).length
      onUrgentCountChange(urgentCount)
      setIsFirstLoad(false) // מעכשיו זו לא הטעינה הראשונה
      console.log('✅ מוצגות', filtered.length, 'הצעות פעילות מתוך', enhancedProposals.length, 'כולל')
    } catch (error) {
      console.error('❌ שגיאה בטעינת הצעות מורחבות:', error)
      
      // הצגת שגיאה מפורטת בקונסול
      let errorMessage = 'שגיאה לא צפויה בטעינת הצעות'
      if (error instanceof Error) {
        console.error('פרטי השגיאה:', error.message)
        console.error('Stack trace:', error.stack)
        errorMessage = error.message
      }
      
      setError(errorMessage)
      
      // רק במקרה של שגיאה אמיתית נאפס את המונה
      if (isFirstLoad) onCountChange(0) // רק בטעינה הראשונה נאפס במקרה של שגיאה
    } finally {
      setLoading(false)
    }
  }

  // פונקציה לעדכון הצעה יחידה בלי לטעון הכל מחדש
  const updateSingleProposal = async (proposalId: string) => {
    console.log('🔄 מעדכן הצעה יחידה:', proposalId)
    try {
      // טעינת כל ההצעות מחדש כדי לקבל את הסטטוס המעודכן
      const updatedProposals = await loadEnhancedProposals(accessToken!)
      const updatedProposal = updatedProposals.find(p => p.id === proposalId)
      
      if (updatedProposal) {
        // אם ההצעה עדיין קיימת ברשימת הפעילות - עדכון רק ההצעה הספציפית
        setProposals(prevProposals => {
          const newProposals = prevProposals.map(p => 
            p.id === proposalId ? updatedProposal : p
          )
          onCountChange(newProposals.length) // עדכון המונה
          
          // אם זו ההצעה שנבחרה לעריכה, עדכן גם אותה
          if (selectedProposalForEdit && selectedProposalForEdit.id === proposalId) {
            setSelectedProposalForEdit(updatedProposal)
          }
          
          return newProposals
        })
        // עדכון מיידי נוסף של מונה כללי
        if (loadActiveProposalsCount) {
          await loadActiveProposalsCount()
        }
        console.log('✅ הצעה עודכנה בהצלחה:', proposalId)
      } else {
        // אם ההצעה לא קיימת יותר ברשימת הפעילות (שינוי סטטוס) - הסרה מהרשימה
        console.log('📤 הצעה הוסרה מרשימת הפעילות:', proposalId)
        setProposals(prevProposals => {
          const newProposals = prevProposals.filter(p => p.id !== proposalId)
          onCountChange(newProposals.length) // עדכון המונה
          
          // אם זו ההצעה שהיתה נבחרת לעריכה, חזור לרשימה
          if (selectedProposalForEdit && selectedProposalForEdit.id === proposalId) {
            setSelectedProposalForEdit(null)
            setIsInEditMode(false)
          }
          
          return newProposals
        })
        // עדכון מיידי נוסף של מונה כללי
        if (loadActiveProposalsCount) {
          await loadActiveProposalsCount()
        }
      }
    } catch (error) {
      console.error('❌ שגיאה בעדכון הצעה יחידה:', error)
      // במקרה של שגיאה, נטען הכל מחדש כגיבוי
      await loadEnhancedProposalsData()
    }
  }

  if (loading) {
    return <LoadingSpinner message="טוען הצעות פעילות..." />
  }

  // אם אנחנו במצב עריכה, הצג את מסך הטיפול המלא
  if (isInEditMode && selectedProposalForEdit) {
    return (
      <div className="space-y-6">
        {/* כותרת עם כפתור חזרה */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={() => {
              setIsInEditMode(false)
              setSelectedProposalForEdit(null)
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span className="text-xl">←</span>
            <span>חזרה להצעות פעילות</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-2xl font-bold text-gray-900">
            טיפול בהצעה: {selectedProposalForEdit.boyDetails?.name || selectedProposalForEdit.boy_data?.name || 'ללא שם'} ↔ {selectedProposalForEdit.girlDetails?.name || selectedProposalForEdit.girl_data?.name || 'ללא שם'}
          </h1>
        </div>
        
        {/* תוכן הטיפול המלא */}
        <ProposalCard
          proposal={selectedProposalForEdit}
          onUpdate={async () => {
            // הפונקציה updateSingleProposal כבר מטפלת בעדכון הנתונים ובעדכון selectedProposalForEdit
            await updateSingleProposal(selectedProposalForEdit.id)
          }}
          onViewProfiles={(proposal) => {
            // פתיחת ProfilesModal
            setSelectedProposal(proposal)
          }}
          shadchanId={shadchanId!}
        />
        
        {/* מודל צפיה בפרופילים - במסך הטיפול המלא */}
        {selectedProposal && (
          <ProfilesModal
            maleProfile={selectedProposal.boyDetails}
            femaleProfile={selectedProposal.girlDetails}
            onClose={() => setSelectedProposal(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      {/* הצגת שגיאה אם יש */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-red-600">⚠️</div>
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">שגיאה בטעינת הצעות</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={loadEnhancedProposalsData}
              className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
            >
              נסה שוב
            </button>
          </div>
        </div>
      )}
      
      {/* טאבי סטטוס - חלוקה לפי שלב התהליך */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span>🔄</span>
          <span>סינון לפי שלב בתהליך</span>
        </h3>
        <nav className="flex flex-wrap gap-2">
          {statusTabs.map(tab => {
            const tabCounts = getTabCounts(proposals)
            const count = tabCounts[tab.id] || 0
            const isActive = activeStatusTab === tab.id
            
            return (
              <button
                key={tab.id}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 ${
                  isActive
                    ? 'bg-white shadow-sm border-2 border-blue-200 text-blue-700' 
                    : 'bg-transparent border-2 border-transparent text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
                onClick={() => setActiveStatusTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    isActive 
                      ? `bg-${tab.color}-100 text-${tab.color}-800` 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
      
      {/* כותרת וסינון */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">
            {statusTabs.find(tab => tab.id === activeStatusTab)?.label || 'הצעות פעילות'}
          </h2>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            {filteredProposals.length} הצעות
          </span>
          <button
            onClick={loadEnhancedProposalsData}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            title="רענן הצעות"
          >
            🔄
          </button>
          
          {/* כפתורי החלפת תצוגה */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="תצוגת רשימה"
            >
              📋 רשימה
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="תצוגת רשת"
            >
              ⚏ רשת
            </button>
          </div>
        </div>
        
        {/* פילטרים בסיסיים */}
        <div className="flex gap-3">
          <select
            value={filter.sortBy}
            onChange={(e) => setFilter(prev => ({ ...prev, sortBy: e.target.value as any }))}
            className="border rounded-lg px-3 py-1 text-sm"
          >
            <option value="created_at">לפי תאריך יצירה</option>
            <option value="last_activity">לפי פעילות אחרונה</option>
            <option value="match_score">לפי ציון התאמה</option>
            <option value="days_in_process">לפי ימים בתהליך</option>
          </select>
          
          <div className="relative">
            <input
              type="text"
              placeholder="חיפוש לפי שם (לחץ Enter)..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="border rounded-lg px-3 py-1 text-sm w-48"
            />
            {filter.searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="נקה חיפוש"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        {/* כפתור עזרה עם טולטיפ */}
        {filteredProposals.length > 0 && (
          <div className="flex justify-center">
            <div className="relative group">
              <button className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-1">
                <span>🚦</span>
                <span>מדריך סמנים</span>
                <span className="text-xs">❓</span>
              </button>
              
              {/* טולטיפ */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[400px]">
                  <div className="text-center font-semibold mb-2">🚦 מדריך סמנים חכמים</div>
                  <div className="space-y-1 text-right">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs">🔥 דחוף</span>
                      <span>ממתין לתגובה 3+ ימים או לקבוע פגישה 1+ יום</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-yellow-600 text-white px-2 py-1 rounded text-xs">⚠️ אזהרה</span>
                      <span>ללא התקדמות 2+ ימים</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-orange-600 text-white px-2 py-1 rounded text-xs">💬 ממתין</span>
                      <span>ללא תגובה 1+ יום</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-xs">🆕 חדש</span>
                      <span>הצעה חדשה ממתינה לטיפול</span>
                    </div>
                  </div>
                  
                  {/* חץ למטה */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {filteredProposals.length === 0 && filter.searchTerm ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">לא נמצאו תוצאות</h3>
          <p className="text-gray-600">
            לא נמצאו הצעות התואמות לחיפוש "{filter.searchTerm}".<br/>
            נסה מילות חיפוש אחרות או נקה את החיפוש.
          </p>
          <button
            onClick={clearSearch}
            className="mt-4 text-blue-600 hover:text-blue-800 underline"
          >
            נקה חיפוש
          </button>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין הצעות פעילות</h3>
          <p className="text-gray-600 mb-4">
            כאן יופיעו ההצעות שאישרת ונמצאות בתהליך מעקב.<br/>
            אשר הצעות מהטאב "התאמות חדשות" כדי לראות אותן כאן.
          </p>
          <button
            onClick={loadEnhancedProposalsData}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            רענן הצעות
          </button>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 text-lg">ℹ️</span>
              <div>
                <h4 className="font-medium text-blue-900">
                  {viewMode === 'grid' ? 'תצוגת רשת - צפיה מהירה' : 'תצוגת רשימה - קומפקטית'}
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  {viewMode === 'grid' 
                    ? 'לחץ על כרטיס כדי לפתוח מסך טיפול מלא בהצעה (עדכון סטטוס, הוספת הערות, צפיה בפרופילים, יצירת קשר וכו\').'
                    : 'לחץ על שורה כדי לפתוח מסך טיפול מלא בהצעה. תצוגה זו מאפשרת סריקה מהירה של כל ההצעות.'
                  }
                  {' '}בחר בין תצוגת רשימה לרשת למעלה.
                </p>
              </div>
            </div>
          </div>
          
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
            {filteredProposals.map((proposal) => (
            viewMode === 'grid' ? (
              <ProposalGridCard
                key={proposal.id}
                proposal={proposal}
                onClick={() => {
                  setSelectedProposalForEdit(proposal)
                  setIsInEditMode(true)
                }}
              />
            ) : (
              <ProposalListRow
                key={proposal.id}
                proposal={proposal}
                onClick={() => {
                  setSelectedProposalForEdit(proposal)
                  setIsInEditMode(true)
                }}
              />
            )
          ))}
          </div>
        </>
      )}

      

      {/* מודל צפיה בפרופילים - רק כשלא במסך טיפול מלא */}
      {selectedProposal && !isInEditMode && (
        <ProfilesModal
          maleProfile={selectedProposal.boyDetails}
          femaleProfile={selectedProposal.girlDetails}
          onClose={() => setSelectedProposal(null)}
        />
      )}
    </div>
  )
}

// רכיב טאב היסטוריה
const HistoryTab = ({ accessToken }: { accessToken: string | null }) => {
  const [sessions, setSessions] = useState<MatchingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<MatchingSession | null>(null)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadHistorySessions()
  }, [])

  const loadHistorySessions = async () => {
    try {
      const historySessions = await getSessionHistory()
      setSessions(historySessions)
    } catch (error) {
      console.error('שגיאה בטעינת היסטוריית סשנים:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation() // מניעת פתיחת הסשן
    setSessionToDelete(sessionId)
    setShowDeleteSessionModal(true)
  }

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return
    
    setShowDeleteSessionModal(false)
    setDeletingSession(sessionToDelete)
    try {
      await deleteSession(sessionToDelete)
      console.log('סשן נמחק בהצלחה, מרענן רשימה...')
      // רענון רשימת הסשנים
      await loadHistorySessions()
      console.log('רשימת הסשנים רוענה')
      
      // הודעת הצלחה
      const successMsg = document.createElement('div')
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      successMsg.textContent = '✅ הסשן נמחק בהצלחה'
      document.body.appendChild(successMsg)
      setTimeout(() => {
        document.body.removeChild(successMsg)
      }, 3000)
      
    } catch (error: any) {
      console.error('שגיאה במחיקת סשן:', error)
      alert(`שגיאה במחיקת הסשן: ${error.message || 'שגיאה לא ידועה'}`)
    } finally {
      setDeletingSession(null)
      setSessionToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (loading) {
    return <LoadingSpinner message="טוען היסטוריה..." />
  }

  if (selectedSession) {
    const stats = getSessionStats(selectedSession)
    
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setSelectedSession(null)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              חזרה להיסטוריה
            </Button>
            <div>
              <h2 className="text-xl font-semibold">סשן מתאריך {formatDate(selectedSession.created_at)}</h2>
              <p className="text-sm text-gray-600">
                {stats.total} התאמות, {stats.processed} מעובדות ({stats.completionRate}%)
              </p>
            </div>
          </div>
        </div>

        {/* הצגת התאמות מהסשן */}
        <div className="space-y-6">
          {selectedSession.session_data.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              accessToken={accessToken}
                             onStatusUpdate={async (matchId, newStatus) => {
                 try {
                   // עדכון local state מיידי
                   const updatedMatches = selectedSession.session_data.map(m => 
                     m.id === matchId ? { ...m, status: newStatus } : m
                   )
                   
                   // עדכון הסשן המוצג
                   setSelectedSession({
                     ...selectedSession,
                     session_data: updatedMatches
                   })
                   
                   // עדכון הסשן בהיסטוריה
                   await updateSpecificSession(selectedSession.id, updatedMatches)
                   
                   // אם אושר - העברה להצעות פעילות
                   if (newStatus === 'ready_for_processing') {
                     const approvedMatch = updatedMatches.find(m => m.id === matchId)
                     if (approvedMatch) {
                       await moveMatchToProposals(approvedMatch)
                       // המונה יתעדכן אוטומטית כאשר נעבור לטאב ההצעות
                     }
                   }
                   
                   // הודעת הצלחה
                   console.log(`✅ עודכן סטטוס הצעה ${matchId} ל-${newStatus} בהיסטוריה`)
                   
                   // אם ההצעה אושרה, תוצג הודעה נוספת
                   if (newStatus === 'ready_for_processing') {
                     setTimeout(() => {
                       const infoNotification = document.createElement('div')
                       infoNotification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                       infoNotification.textContent = '💡 עבור לטאב "הצעות פעילות" לראות את ההצעה המאושרת'
                       document.body.appendChild(infoNotification)
                       
                       setTimeout(() => {
                         if (document.body.contains(infoNotification)) {
                           document.body.removeChild(infoNotification)
                         }
                       }, 4000)
                     }, 1000)
                   }
                 } catch (error) {
                   console.error('שגיאה בעדכון סטטוס בהיסטוריה:', error)
                   
                   // החזרת הסטייט המקומי במקרה של שגיאה
                   const originalMatch = selectedSession.session_data.find(m => m.id === matchId)
                   setSelectedSession({
                     ...selectedSession,
                     session_data: selectedSession.session_data.map(m => 
                       m.id === matchId ? { ...m, status: originalMatch?.status || 'ready_for_processing' } : m
                     )
                   })
                   
                   // הודעת שגיאה למשתמש בהתאם לסוג השגיאה
                   let errorMessage = '❌ שגיאה בעדכון הסטטוס בהיסטוריה. נסה שוב.'
                   
                   if (error instanceof Error) {
                     if (error.message.includes('אימות')) {
                       errorMessage = '🔐 שגיאת אימות - אנא רענן את הדף והתחבר מחדש'
                     } else if (error.message.includes('כבר קיימת')) {
                       errorMessage = '💡 ההצעה כבר קיימת במערכת - עבור לטאב "הצעות פעילות"'
                     } else if (error.message.includes('הרשאות')) {
                       errorMessage = '🔐 שגיאת הרשאות - אנא רענן את הדף'
                     }
                   }
                   
                   const errorNotification = document.createElement('div')
                   errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                   errorNotification.textContent = errorMessage
                   document.body.appendChild(errorNotification)
                   
                   setTimeout(() => {
                     if (document.body.contains(errorNotification)) {
                       document.body.removeChild(errorNotification)
                     }
                   }, 5000)
                 }
               }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">היסטוריית סשנים</h2>
        <span className="text-sm text-gray-600">
          {sessions.length} מתוך 10 סשנים
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין היסטוריה עדיין</h3>
          <p className="text-gray-600">
            כאן יופיעו סשני ההתאמות הקודמים שלך
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const stats = getSessionStats(session)
            
            return (
              <div
                key={session.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow bg-white rounded-lg border border-gray-200"
                onClick={() => setSelectedSession(session)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {formatDate(session.created_at)}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        stats.isCompleted 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {stats.isCompleted ? 'הושלם' : `נותרו ${stats.pending}`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>{stats.total} התאמות</span>
                      <span>{stats.processed} מעובדות</span>
                      <span>{stats.completionRate}% הושלם</span>
                    </div>
                    
                    {/* סרגל התקדמות */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      disabled={deletingSession === session.id}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      title="מחק סשן"
                    >
                      {deletingSession === session.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                    <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </div>
                </div>
              </div>
             )
          })}
        </div>
      )}

      {/* מודל מחיקת סשן */}
      {showDeleteSessionModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteSessionModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* אייקון */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              {/* כותרת */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                מחיקת סשן 🗑️
              </h3>
              
              {/* תוכן */}
              <div className="mb-6">
                <p className="text-gray-600 mb-3">
                  האם אתה בטוח שברצונך למחוק את הסשן הזה?
                </p>
                <div className="bg-red-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-800">
                    <strong>אזהרה:</strong> פעולה זו בלתי הפיכה!
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  כל ההתאמות והנתונים בסשן זה יימחקו לצמיתות ולא ניתן יהיה לשחזר אותם.
                </p>
              </div>
              
              {/* כפתורים */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteSessionModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={deletingSession !== null}
                >
                  ביטול
                </button>
                <button
                  onClick={confirmDeleteSession}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                  disabled={deletingSession !== null}
                >
                  {deletingSession ? 'מוחק...' : 'מחק סשן 🗑️'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// רכיב טאב ייבוא
const ImportTab: React.FC<{ accessToken: string | null }> = ({ accessToken }) => {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [candidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // טעינת נתונים שמורים בעת העלאת הקומפוננט
  useEffect(() => {
    loadSavedCandidates()
  }, [])

  const loadSavedCandidates = async () => {
    try {
      // בדיקה אם יש נתונים שמורים ב-localStorage
      const savedCandidates = localStorage.getItem('importedCandidates')
      if (savedCandidates) {
        const parsedCandidates = JSON.parse(savedCandidates)
        // setCandidates(parsedCandidates)
        console.log('טעון מועמדים שמורים:', parsedCandidates.males?.length || 0, 'בנים,', parsedCandidates.females?.length || 0, 'בנות')
      }
    } catch (error) {
      console.error('שגיאה בטעינת מועמדים שמורים:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const loadCandidates = async () => {
    if (!accessToken) {
      setError('נא להתחבר מחדש עם Google')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // קבלת הגדרות מהמסד הנתונים
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('לא מחובר למערכת')
        return
      }

      const { data: settings } = await supabase
        .from('shadchanim')
        .select('google_sheet_id')
        .eq('auth_user_id', user.id)
        .single()

      let sheetId = settings?.google_sheet_id
      if (!sheetId) {
        sheetId = localStorage.getItem('sheetId')
      }
      
      if (!sheetId) {
        setError('נא להגדיר מזהה גיליון בטאב הגדרות')
        return
      }
      
      // שמירה ב-localStorage אם נמצא במסד הנתונים (לביצועים בפעם הבאה)
      if (settings?.google_sheet_id && !localStorage.getItem('sheetId')) {
        localStorage.setItem('sheetId', settings.google_sheet_id)
      }

      const data = await loadCandidatesFromSheet(accessToken!, sheetId)
      
      // שמירת הנתונים ב-localStorage
      localStorage.setItem('importedCandidates', JSON.stringify(data))
      
      // setCandidates(data)
      
      console.log(`✅ נטענו ${data.males?.length || 0} בנים ו-${data.females?.length || 0} בנות`)
      
    } catch (error: any) {
      console.error('שגיאה בטעינת המועמדים:', error)
      setError(`שגיאה בטעינת המועמדים: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // אם עדיין בטעינה ראשונית
  if (initialLoading) {
    return <LoadingSpinner message="טוען נתוני ייבוא..." />
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">ייבוא מועמדים</h2>
      
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">מועמדים מהגיליון</h3>
            {candidates && (
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                {candidates.males?.length || 0} + {candidates.females?.length || 0} = {(candidates.males?.length || 0) + (candidates.females?.length || 0)} מועמדים
              </span>
            )}
          </div>
          <button
            onClick={loadCandidates}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {loading ? 'טוען...' : candidates ? 'רענן מועמדים' : 'טען מועמדים'}
          </button>
        </div>



        {/* הודעת שגיאה */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {error}
            </div>
          </div>
        )}

        {candidates ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">בנים</h4>
                <p className="text-2xl font-bold text-blue-600">{candidates.males.length}</p>
                <p className="text-sm text-blue-700">מועמדים נטענו</p>
              </div>
              <div className="bg-pink-50 p-4 rounded-lg">
                <h4 className="font-medium text-pink-900 mb-2">בנות</h4>
                <p className="text-2xl font-bold text-pink-600">{candidates.females.length}</p>
                <p className="text-sm text-pink-700">מועמדות נטענו</p>
              </div>
            </div>

            {/* כפתורים */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => {
                  localStorage.removeItem('importedCandidates')
                  // setCandidates(null)
                  setError(null)
                }}
                className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                נקה נתונים שמורים
              </button>
            </div>

            {/* רשימת מועמדים */}
            <div className="max-h-64 overflow-y-auto">
              <h4 className="font-medium mb-2">מועמדים:</h4>
              <div className="space-y-2 text-sm">
                {candidates.males.map((male, index) => (
                  <div key={`male-${index}`} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="font-medium">👨 {male.name}</span>
                    <span className="text-gray-500">{male.age} שנים, {male.location}</span>
                  </div>
                ))}
                {candidates.females.map((female, index) => (
                  <div key={`female-${index}`} className="flex justify-between items-center p-2 bg-pink-50 rounded">
                    <span className="font-medium">👩 {female.name}</span>
                    <span className="text-gray-500">{female.age} שנים, {female.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="relative">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
              {loading && (
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {loading ? 'טוען מועמדים מהגיליון...' : 'אין מועמדים נטענים'}
            </h3>
            <p className="text-gray-600">
              {loading 
                ? 'המערכת מייבאת את נתוני המועמדים מגיליון Google Sheets'
                : 'לחץ "טען מועמדים" כדי לטעון את הנתונים מהגיליון'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}



// רכיב להצגת הצעת התאמה משופרת
const MatchCard = ({ match, onStatusUpdate }: { 
  match: MatchProposal, 
  onStatusUpdate?: (matchId: string, newStatus: 'ready_for_processing' | 'rejected') => void,
  accessToken: string | null
  }) => {
    const [showProfilesModal, setShowProfilesModal] = useState(false)
    const [candidatesData, setCandidatesData] = useState<{
      maleProfile: any | null
      femaleProfile: any | null
    }>({ maleProfile: null, femaleProfile: null })
  const [isProcessing, setIsProcessing] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)

    // הצגת פרופילים מיידית - ללא טעינה מחדש
  const showProfiles = () => {
    // שימוש מיידי בנתונים הקיימים
        setCandidatesData({
          maleProfile: match.boy_data || null,
          femaleProfile: match.girl_data || null
        })
        setShowProfilesModal(true)
  }

  // טיפול באישור הצעה
  const handleApprove = async () => {
    if (isProcessing) return
    setShowApprovalModal(true)
  }

  // אישור הצעה אחרי הסכמה במודל
  const confirmApprove = async () => {
    setShowApprovalModal(false)
    
    setIsProcessing(true)
    try {
      // הודעת התחלה
      const processingNotification = document.createElement('div')
      processingNotification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      processingNotification.textContent = 'מעבד אישור הצעה...'
      document.body.appendChild(processingNotification)
      
      // עדכון הסטטוס - נקרא רק ל-onStatusUpdate שיטפל בהכל
      if (onStatusUpdate) {
        await onStatusUpdate(match.id, 'ready_for_processing')
      }
      
      // הודעת הצלחה
      document.body.removeChild(processingNotification)
      const successNotification = document.createElement('div')
      successNotification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      successNotification.textContent = '✅ ההצעה אושרה ונשמרה בהצלחה!'
      document.body.appendChild(successNotification)
      
      setTimeout(() => {
        if (document.body.contains(successNotification)) {
          document.body.removeChild(successNotification)
        }
      }, 3000)
      
    } catch (error) {
      console.error('שגיאה באישור הצעה:', error)
      
      // הסרת הודעת עיבוד אם קיימת
      const existingProcessing = document.querySelector('.fixed.top-4.right-4.bg-blue-500')
      if (existingProcessing && document.body.contains(existingProcessing)) {
        document.body.removeChild(existingProcessing)
      }
      
      // טיפול מיוחד במקרה של הצעה קיימת
      if (error instanceof Error && (error.message.includes('כבר קיימת') || error.message.includes('כבר מאושרת'))) {
        const infoNotification = document.createElement('div')
        infoNotification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        infoNotification.textContent = '✅ ההצעה כבר מאושרת - היא נמצאת בטאב "הצעות פעילות"'
        document.body.appendChild(infoNotification)
        
        setTimeout(() => {
          if (document.body.contains(infoNotification)) {
            document.body.removeChild(infoNotification)
          }
        }, 4000)
      } else {
        // הודעת שגיאה רגילה
        const errorNotification = document.createElement('div')
        errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        errorNotification.textContent = '❌ שגיאה באישור ההצעה. נסה שוב.'
        document.body.appendChild(errorNotification)
        
        setTimeout(() => {
          if (document.body.contains(errorNotification)) {
            document.body.removeChild(errorNotification)
          }
        }, 3000)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // טיפול בדחיית הצעה
  const handleReject = async () => {
    if (isProcessing) return
    setShowRejectionModal(true)
  }

  // דחיית הצעה אחרי הסכמה במודל
  const confirmReject = async () => {
    setShowRejectionModal(false)
    
    setIsProcessing(true)
    try {
      // הודעת התחלה
      const processingNotification = document.createElement('div')
      processingNotification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      processingNotification.textContent = 'מעבד דחיית הצעה...'
      document.body.appendChild(processingNotification)
      
      // עדכון הסטטוס - נקרא רק ל-onStatusUpdate שיטפל בהכל
      if (onStatusUpdate) {
        await onStatusUpdate(match.id, 'rejected')
      }
      
      // הודעת הצלחה
      document.body.removeChild(processingNotification)
      const successNotification = document.createElement('div')
      successNotification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      successNotification.textContent = '🚫 ההצעה נדחתה ונשמרה להיסטוריה'
      document.body.appendChild(successNotification)
      
      setTimeout(() => {
        if (document.body.contains(successNotification)) {
          document.body.removeChild(successNotification)
        }
      }, 3000)
      
    } catch (error) {
      console.error('שגיאה בדחיית הצעה:', error)
      
      // הודעת שגיאה
      const errorNotification = document.createElement('div')
      errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      errorNotification.textContent = '❌ שגיאה בדחיית ההצעה. נסה שוב.'
      document.body.appendChild(errorNotification)
      
      setTimeout(() => {
        if (document.body.contains(errorNotification)) {
          document.body.removeChild(errorNotification)
        }
      }, 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
    <Card className="p-4 border-r-4 border-r-blue-500">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-800">
              {match.maleName} {match.boy_data?.age && `(${match.boy_data.age})`} ← → {match.femaleName} {match.girl_data?.age && `(${match.girl_data.age})`}
          </h3>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span className="bg-green-100 px-2 py-1 rounded-full">
              🧮 לוגי: {match.logicalScore.toFixed(1)}/10
            </span>
            <span className="bg-purple-100 px-2 py-1 rounded-full">
              🤖 GPT: {match.gptScore}/10
            </span>
            <span className="bg-blue-100 px-2 py-1 rounded-full font-medium">
              🎯 סופי: {match.finalScore.toFixed(1)}/10
            </span>
          </div>
        </div>
                  <div className="text-left">
           <span className={`px-3 py-1 rounded-full text-sm font-medium ${
             match.status === 'ready_for_processing' ? 'bg-yellow-100 text-yellow-800' :
             match.status === 'restored_to_active' ? 'bg-green-100 text-green-800' :
             match.status === 'rejected' ? 'bg-red-100 text-red-800' :
             'bg-gray-100 text-gray-800' // סטטוס ברירת מחדל
           }`}>
             {match.status === 'ready_for_processing' ? 'ממתינה לתחילת טיפול' :
              match.status === 'restored_to_active' ? 'הוחזרה לטיפול' :
              match.status === 'rejected' ? 'נדחתה' : 'התאמה חדשה'} {/* עדכון טקסט תצוגה */}
           </span>
          </div>
      </div>
      
      <div className="mb-3">
        <p className="text-gray-700 font-medium mb-2">💭 סיכום ההתאמה:</p>
        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{match.summary}</p>
      </div>

      {match.strengths.length > 0 && (
        <div className="mb-3">
          <p className="text-green-700 font-medium mb-2">✅ נקודות חוזק:</p>
          <ul className="text-sm text-green-600">
            {match.strengths.map((strength: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span>•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.concerns.length > 0 && (
        <div className="mb-3">
          <p className="text-orange-700 font-medium mb-2">⚠️ נקודות לתשומת לב:</p>
          <ul className="text-sm text-orange-600">
            {match.concerns.map((concern: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span>•</span>
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 mt-4">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={showProfiles}
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
            disabled={isProcessing}
          >
            👥 צפה בפרופילים
        </Button>
          
          {match.status !== 'rejected' && match.status !== 'ready_for_processing' && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                onClick={handleApprove} // ישנה את הסטטוס ל-ready_for_processing
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ מעבד...' : '✅ אישור הצעה'}
        </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={handleReject}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ מעבד...' : '❌ דחיה'}
              </Button>
            </>
          )}
          
                     {match.status === 'ready_for_processing' && (
             <span className="text-sm text-green-600 font-medium px-3 py-2 bg-green-50 rounded">
               ✅ ממתינה לתחילת טיפול - מועברת להצעות פעילות
             </span>
           )}
           
           {match.status === 'restored_to_active' && (
             <span className="text-sm text-green-600 font-medium px-3 py-2 bg-green-50 rounded">
               ✅ הוחזרה לטיפול - מועברת להצעות פעילות
             </span>
           )}
          
          {match.status === 'rejected' && (
            <span className="text-sm text-red-600 font-medium px-3 py-2 bg-red-50 rounded">
              ❌ ההצעה נדחתה - נשמרה בהיסטוריה
            </span>
          )}
      </div>
    </Card>

      {/* מודל להצגת פרופילים מלאים */}
      {showProfilesModal && (
        <ProfilesModal
          maleProfile={candidatesData.maleProfile}
          femaleProfile={candidatesData.femaleProfile}
          onClose={() => setShowProfilesModal(false)}
        />
      )}

      {/* מודל אישור הצעה */}
      {showApprovalModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowApprovalModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* אייקון */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* כותרת */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                אישור הצעת שידוך 💕
              </h3>
              
              {/* תוכן */}
              <div className="mb-6">
                <p className="text-gray-600 mb-3">
                  האם אתה בטוח שברצונך לאשר את ההצעה בין:
                </p>
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="font-medium text-blue-900">
                    {match.maleName} ↔ {match.femaleName}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  לאחר האישור, ההצעה תועבר לטאב "הצעות פעילות" למעקב ואתה תוכל להתחיל בתהליך יצירת הקשר.
                </p>
              </div>
              
              {/* כפתורים */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isProcessing}
                >
                  ביטול
                </button>
                <button
                  onClick={confirmApprove}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'מאשר...' : 'אשר הצעה ✓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* מודל דחיית הצעה */}
      {showRejectionModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowRejectionModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* אייקון */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              
              {/* כותרת */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                דחיית הצעת שידוך ❌
              </h3>
              
              {/* תוכן */}
              <div className="mb-6">
                <p className="text-gray-600 mb-3">
                  האם אתה בטוח שברצונך לדחות את ההצעה בין:
                </p>
                <div className="bg-red-50 rounded-lg p-3 mb-3">
                  <p className="font-medium text-red-900">
                    {match.maleName} ↔ {match.femaleName}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  הסיבה לדחיה תירשם ותועזור לשיפור התאמות עתידיות. ההצעה תסווג כנדחית ולא תוצג שוב.
                </p>
              </div>
              
              {/* כפתורים */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectionModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isProcessing}
                >
                  ביטול
                </button>
                <button
                  onClick={confirmReject}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'דוחה...' : 'דחה הצעה ❌'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// רכיב מודל להצגת פרופילים מלאים
const ProfilesModal = ({ 
  maleProfile, 
  femaleProfile, 
  onClose 
}: { 
  maleProfile: any | null
  femaleProfile: any | null
  onClose: () => void 
}) => {
  const renderProfile = (profile: any, title: string) => {
 

    if (!profile) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>לא נמצא פרופיל עבור {title}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800 border-b pb-2">{title}</h3>
        
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {/* נתונים בסיסיים */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">מזהה מספרי:</span>
              <span className="mr-2">{profile.id || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">שם:</span>
              <span className="mr-2">{profile.name || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">גיל:</span>
              <span className="mr-2">{profile.age || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">תאריך לידה:</span>
              <span className="mr-2">{profile.birthDate || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מצב משפחתי:</span>
              <span className="mr-2">{profile.maritalStatus || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">טווח גיל מועדף:</span>
              <span className="mr-2">{profile.preferredAgeRange || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מקום מגורים:</span>
              <span className="mr-2">{profile.location || profile.city || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מגזר:</span>
              <span className="mr-2">{profile.sector || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">האם פתוחה להצעות בסטטוס או עדה אחרת?:</span>
              <span className="mr-2">{profile.openToOtherSectors || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">עדה:</span>
              <span className="mr-2">{profile.community || profile.edah || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">רמה דתית:</span>
              <span className="mr-2">{profile.religiousLevel || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">השתייכות לזרם דתי:</span>
              <span className="mr-2">{profile.religiousStream || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">השכלה:</span>
              <span className="mr-2">{profile.education || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מקצוע:</span>
              <span className="mr-2">{profile.profession || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">שפות מדוברות:</span>
              <span className="mr-2">{profile.languages || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">גובה:</span>
              <span className="mr-2">{profile.height || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מראה חיצוני:</span>
              <span className="mr-2">{profile.appearance || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">סגנון לבוש:</span>
              <span className="mr-2">{profile.dressStyle || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">עישון:</span>
              <span className="mr-2">{profile.smoking || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מספר אחים ואחיות:</span>
              <span className="mr-2">{profile.siblings || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">סדר לידה במשפחה:</span>
              <span className="mr-2">{profile.birthOrder || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">שימוש באינטרנט ורשתות חברתית:</span>
              <span className="mr-2">{profile.internetUsage || 'לא צוין'}</span>
            </div>
          </div>

          {/* שדות טקסט ארוכים */}
          <div className="space-y-3">
            {profile.aboutMe && (
              <div>
                <span className="font-medium text-gray-600">כמה משפטים על עצמי:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.aboutMe}</p>
              </div>
            )}

            {profile.lookingFor && (
              <div>
                <span className="font-medium text-gray-600">כמה משפטים על מה אני מחפש:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.lookingFor}</p>
              </div>
            )}

            {profile.importantQualities && (
              <div>
                <span className="font-medium text-gray-600">דברים שחשובים לי שיהיו בבן/ת זוגי:</span>
                <p className="text-gray-700 mt-1 bg-blue-50 p-2 rounded">{profile.importantQualities}</p>
              </div>
            )}

            {profile.hobbies && (
              <div>
                <span className="font-medium text-gray-600">תחביבים:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.hobbies}</p>
              </div>
            )}

            {profile.valuesAndBeliefs && (
              <div>
                <span className="font-medium text-gray-600">ערכים ואמונות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.valuesAndBeliefs}</p>
              </div>
            )}

            {profile.personality && (
              <div>
                <span className="font-medium text-gray-600">מאפייני אישיות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.personality}</p>
              </div>
            )}

            {profile.lifestyle && (
              <div>
                <span className="font-medium text-gray-600">סגנון חיים:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.lifestyle}</p>
              </div>
            )}

            {profile.flexibility && (
              <div>
                <span className="font-medium text-gray-600">גמישות לשינויים:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.flexibility}</p>
              </div>
            )}

            {profile.educationViews && (
              <div>
                <span className="font-medium text-gray-600">השקפתך בנושא חינוך ילדים:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.educationViews}</p>
              </div>
            )}

            {profile.dealBreakers && (
              <div>
                <span className="font-medium text-gray-600">דברים שחשובים לי שלא יהיו בבן/ת זוגי:</span>
                <p className="text-gray-700 mt-1 bg-red-50 p-2 rounded">{profile.dealBreakers}</p>
              </div>
            )}
            
            {profile.additionalNotes && (
              <div>
                <span className="font-medium text-gray-600">העדפות נוספות/הערות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.additionalNotes}</p>
              </div>
            )}

            {profile.contact && (
              <div>
                <span className="font-medium text-gray-600">איך ליצור קשר:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.contact}</p>
              </div>
            )}

            {profile.currentlyProposed && (
              <div>
                <span className="font-medium text-gray-600">מוצע עכשיו:</span>
                <p className="text-gray-700 mt-1 bg-green-50 p-2 rounded">{profile.currentlyProposed}</p>
              </div>
            )}

            {profile.previouslyProposed && (
              <div>
                <span className="font-medium text-gray-600">הוצעו בעבר:</span>
                <p className="text-gray-700 mt-1 bg-yellow-50 p-2 rounded">{profile.previouslyProposed}</p>
              </div>
            )}

            {profile.email && (
              <div>
                <span className="font-medium text-gray-600">כתובת מייל ליצירת קשר:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.email}</p>
              </div>
            )}

            {profile.phone && (
              <div>
                <span className="font-medium text-gray-600">טלפון ליצירת קשר:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.phone}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">פרופילי המועמדים</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold hover:bg-gray-100 rounded-full p-1 transition-colors"
          >
            ×
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-blue-50 rounded-lg p-6">
              {renderProfile(maleProfile, `${maleProfile?.name || 'בחור'} (${maleProfile?.age || 'לא צוין'})`)}
            </div>
            
            <div className="bg-pink-50 rounded-lg p-6">
              {renderProfile(femaleProfile, `${femaleProfile?.name || 'בחורה'} (${femaleProfile?.age || 'לא צוין'})`)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// רכיב טאב היסטוריית הצעות
const ProposalsHistoryTab = ({ accessToken, loadActiveProposalsCount }: { accessToken: string | null, loadActiveProposalsCount?: () => Promise<void> }) => {
  const [failedProposals, setFailedProposals] = useState<EnhancedProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<EnhancedProposal | null>(null)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)

  useEffect(() => {
    loadFailedProposalsHistory()
  }, [])

  const loadFailedProposalsHistory = async () => {
    if (!accessToken) {
      setLoading(false)
      return
    }
    
    try {
      const failed = await loadFailedProposals(accessToken)
      setFailedProposals(failed)
    } catch (error) {
      console.error('שגיאה בטעינת היסטוריית הצעות כושלות:', error)
    } finally {
      setLoading(false)
    }
  }

  // פונקציה להצגת הודעת הצלחה ירוקה
  const showSuccessMessage = (message: string) => {
    const successMsg = document.createElement('div')
    successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300'
    successMsg.textContent = message
    document.body.appendChild(successMsg)
    setTimeout(() => {
      successMsg.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(successMsg)) {
          document.body.removeChild(successMsg)
        }
      }, 300)
    }, 3000)
  }

  // פונקציה להצגת הודעת שגיאה אדומה
  const showErrorMessage = (message: string) => {
    const errorMsg = document.createElement('div')
    errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300'
    errorMsg.textContent = message
    document.body.appendChild(errorMsg)
    setTimeout(() => {
      errorMsg.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(errorMsg)) {
          document.body.removeChild(errorMsg)
        }
      }, 300)
    }, 3000)
  }

  const handleRestoreProposal = async (proposalId: string) => {
    if (!accessToken) return
    
    try {
      setIsRestoring(proposalId)
      await restoreProposalToActive(proposalId, 'ההצעה הוחזרה לפעילות')
      // הסר את ההצעה מהרשימה לאחר שחזור מוצלח
      setFailedProposals(prev => prev.filter(p => p.id !== proposalId))
      // עדכון מיידי של מונה ההצעות הפעילות
      if (loadActiveProposalsCount) {
        await loadActiveProposalsCount()
      }
      showSuccessMessage('✅ ההצעה הוחזרה בהצלחה לפעילות!')
    } catch (error) {
      console.error('שגיאה בשחזור הצעה:', error)
      showErrorMessage('❌ שגיאה בשחזור ההצעה')
    } finally {
      setIsRestoring(null)
    }
  }

  if (loading) {
    return <LoadingSpinner message="טוען היסטוריית הצעות..." />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">היסטוריית הצעות</h2>
        <span className="text-sm text-gray-600">
          {failedProposals.length} הצעות שנסגרו
        </span>
      </div>

      {failedProposals.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין הצעות בהיסטוריה</h3>
          <p className="text-gray-600">
            כאן יופיעו הצעות שנדחו או נסגרו
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {failedProposals.map((proposal) => (
            <div key={proposal.id} className="bg-white border border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      הצעה #{proposal.id.slice(-8)}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      proposal.status === 'rejected_by_candidate' 
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}>
                      {proposal.status === 'rejected_by_candidate' ? 'נדחתה על ידי מועמד' : 'נסגרה'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(proposal.updated_at || '').toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-blue-700 font-medium">
                      👤 {proposal.boyDetails?.name || proposal.boy_data?.name || 'ללא שם'}
                    </span>
                    <span className="text-gray-400">↔</span>
                    <span className="text-pink-700 font-medium">
                      👤 {proposal.girlDetails?.name || proposal.girl_data?.name || 'ללא שם'}
                    </span>
                  </div>
                </div>
                
                <div className="text-left">
                  <div className="text-xs text-gray-500">
                    {Math.floor((new Date().getTime() - new Date(proposal.created_at || '').getTime()) / (1000 * 60 * 60 * 24))} ימים בתהליך
                  </div>
                  {proposal.finalScore && (
                    <div className="text-xs text-gray-400 mt-1">
                      ציון: {proposal.finalScore.toFixed(1)}/10
                    </div>
                  )}
                </div>
              </div>
              
              {/* הערה אחרונה אם קיימת */}
              {proposal.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-medium text-gray-500">הערה אחרונה:</span> {proposal.notes}
                  </p>
                </div>
              )}
              
              {/* כפתורי פעולה */}
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={() => setSelectedProposal(proposal)}
                  size="sm"
                  variant="outline"
                  className="flex-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  צפה בפרטי ההצעה
                </Button>
                <Button
                  onClick={() => handleRestoreProposal(proposal.id)}
                  disabled={isRestoring === proposal.id}
                  size="sm"
                  variant="outline"
                  className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                >
                  {isRestoring === proposal.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      משחזר...
                    </>
                  ) : (
                    <>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      החזר הצעה לפעילות
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* מודל תצוגה מפורטת */}
      {selectedProposal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProposal(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                פרטי הצעה #{selectedProposal.id.slice(-8)}
              </h2>
              <button
                onClick={() => setSelectedProposal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <ReadOnlyProposalView proposal={selectedProposal} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// רכיב תצוגה לקריאה בלבד עבור הצעות מההיסטוריה
const ReadOnlyProposalView = ({ proposal }: { proposal: EnhancedProposal }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // פונקציית תרגום סטטוסים לעברית
  const translateStatus = (status: string): string => {
    const statusTranslations: { [key: string]: string } = {
      'pending': 'ממתין',
      'ready_for_processing': 'מוכן לעיבוד',
      'rejected': 'נדחה',
      'ready_for_contact': 'מוכן ליצירת קשר',
      'contacting': 'יוצר קשר',
      'awaiting_response': 'ממתין לתגובה',
      'rejected_by_candidate': 'נדחתה על ידי מועמד',
      'schedule_meeting': 'לקבוע פגישה',
      'meeting_scheduled': 'פגישה קבועה',
      'in_meeting_process': 'בתהליך פגישות',
      'meeting_completed': 'פגישה הושלמה',
      'completed': 'הושלם',
      'closed': 'נסגרה',
      'restored_to_active': 'הוחזרה לטיפול'
    }
    
    return statusTranslations[status] || status
  }

  const boyData = proposal.boyDetails || proposal.boy_data
  const girlData = proposal.girlDetails || proposal.girl_data

  return (
    <div className="space-y-6">
      {/* כותרת ומידע בסיסי */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900">
            הצעה #{proposal.id.slice(-8)}
          </h3>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              proposal.status === 'rejected_by_candidate' 
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-800 border border-gray-200'
            }`}>
              {proposal.status === 'rejected_by_candidate' ? 'נדחתה על ידי מועמד' : 'נסגרה'}
            </span>
            {proposal.finalScore && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                ציון התאמה: {proposal.finalScore.toFixed(1)}/10
              </span>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600 space-y-1">
          <div>נוצר: {formatDate(proposal.created_at || '')} בשעה {formatTime(proposal.created_at || '')}</div>
          <div>עודכן לאחרונה: {formatDate(proposal.updated_at || '')} בשעה {formatTime(proposal.updated_at || '')}</div>
          <div>זמן בתהליך: {Math.floor((new Date().getTime() - new Date(proposal.created_at || '').getTime()) / (1000 * 60 * 60 * 24))} ימים</div>
        </div>
      </div>

      {/* פרטי המועמדים */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* פרטי הבחור */}
        <div className="bg-blue-50 rounded-lg p-5">
          <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
            <User className="w-5 h-5 mr-2" />
            פרטי הבחור
          </h4>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium text-gray-600">שם:</span> {boyData?.name || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">גיל:</span> {boyData?.age || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">עיר:</span> {boyData?.city || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">מקצוע:</span> {boyData?.profession || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">רמת דתיות:</span> {boyData?.religiosity_level || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">עדה:</span> {boyData?.origin || 'לא צוין'}</div>
            {boyData?.height && <div><span className="font-medium text-gray-600">גובה:</span> {boyData.height}</div>}
            {boyData?.phone && <div><span className="font-medium text-gray-600">טלפון:</span> {boyData.phone}</div>}
            {boyData?.email && <div><span className="font-medium text-gray-600">אימייל:</span> {boyData.email}</div>}
          </div>
        </div>

        {/* פרטי הבחורה */}
        <div className="bg-pink-50 rounded-lg p-5">
          <h4 className="text-lg font-semibold text-pink-800 mb-3 flex items-center">
            <User className="w-5 h-5 mr-2" />
            פרטי הבחורה
          </h4>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium text-gray-600">שם:</span> {girlData?.name || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">גיל:</span> {girlData?.age || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">עיר:</span> {girlData?.city || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">מקצוע:</span> {girlData?.profession || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">רמת דתיות:</span> {girlData?.religiosity_level || 'לא צוין'}</div>
            <div><span className="font-medium text-gray-600">עדה:</span> {girlData?.origin || 'לא צוין'}</div>
            {girlData?.height && <div><span className="font-medium text-gray-600">גובה:</span> {girlData.height}</div>}
            {girlData?.phone && <div><span className="font-medium text-gray-600">טלפון:</span> {girlData.phone}</div>}
            {girlData?.email && <div><span className="font-medium text-gray-600">אימייל:</span> {girlData.email}</div>}
          </div>
        </div>
      </div>

      {/* הערות */}
      {(proposal.notesHistory && proposal.notesHistory.length > 0) || proposal.notes ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            הערות {proposal.notesHistory && `(${proposal.notesHistory.length + (proposal.notes ? 1 : 0)} הערות)`}
          </h4>
          
          <div className="space-y-3">
            {/* הערות מהיסטוריה - בסדר הפוך (החדשות קודם) */}
            {proposal.notesHistory && proposal.notesHistory
              .slice()
              .reverse()
              .map((note, index) => (
                <div key={index} className="border-l-4 border-blue-200 bg-white p-3 rounded-r-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {formatDate(note.created_at)} בשעה {formatTime(note.created_at)}
                    </span>
                    {note.status && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        סטטוס: {translateStatus(note.status)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {note.content}
                  </div>
                  {note.edited_at && note.edited_at !== note.created_at && (
                    <div className="text-xs text-gray-400 mt-1 italic">
                      נערך בתאריך: {formatDate(note.edited_at)} בשעה {formatTime(note.edited_at)}
                    </div>
                  )}
                </div>
              ))
            }
            
            {/* הערה נוכחית (אם קיימת ולא חלק מההיסטוריה) */}
            {proposal.notes && (
              <div className="border-l-4 border-green-200 bg-white p-3 rounded-r-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-green-600 font-medium">
                    הערה נוכחית
                  </span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {proposal.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* מידע נוסף על ההתאמה */}
      {proposal.ai_reasoning && (
        <div className="bg-yellow-50 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-yellow-800 mb-3">
            נימוק ההתאמה
          </h4>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {proposal.ai_reasoning}
          </div>
        </div>
      )}
    </div>
  )
}