import React, { useState, useEffect } from 'react'
import { Heart, Users, Upload, Settings, TrendingUp, AlertTriangle, ArrowLeft, History, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { debugAuthStatus, refreshAuthToken } from '@/lib/auth'
import { loadCandidatesFromSheet, DetailedCandidate } from '@/lib/google-sheets'
import { generateMatches } from '@/lib/openai'
import { MatchProposal } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NewScanWarningModal } from '@/components/ui/NewScanWarningModal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
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
  checkAuthConnection,
  reset406ErrorCount
} from '@/lib/sessions'
import { loadEnhancedProposals, updateProposalStatus } from '@/lib/proposals'
import { EnhancedProposal, ProposalsFilter } from '@/types'
import { ProposalCard } from '@/components/ui/ProposalCard'

interface DashboardPageProps {
  user?: {
    name: string
    email: string
  }
}

type TabType = 'matches' | 'proposals' | 'import' | 'settings' | 'history'

export const DashboardPage = ({ user }: DashboardPageProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('matches')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  
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

  // פונקציה לטעינת מספר ההצעות הפעילות בלבד (מהירה)
  const loadActiveProposalsCount = async () => {
    try {
      const { data: currentProposals } = await supabase
        .from('match_proposals')
        .select('id')
        .in('status', ['approved', 'in_progress', 'completed'])
      
      const count = currentProposals?.length || 0
      setActiveProposalsCount(count)
      console.log('📊 נטען מספר הצעות פעילות:', count)
    } catch (error) {
      console.error('שגיאה בטעינת מספר הצעות:', error)
    }
  }

  useEffect(() => {
    // איפוס מונה שגיאות 406 בתחילת הטעינה
    reset406ErrorCount()
    
    // קבלת Access Token מSupabase
    const getAccessToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        setAccessToken(session.provider_token)
      }
    }
    
    // הוספת דיבוג לבדיקת סטטוס האימות
    const initializeAuth = async () => {
      console.log('🔍 מתחיל בדיקת אימות...')
        
      // בדיקת סשן נוכחי
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('📋 Session:', session)
      console.log('❌ Session Error:', sessionError)
      
      if (!session) {
        console.error('❌ אין סשן פעיל! המשתמש לא מחובר')
        setAuthStatus('unauthenticated')
        return
      }
      
      await debugAuthStatus()
      await getAccessToken()
      setAuthStatus('authenticated')
      
      // טעינת מספר ההצעות הפעילות מיד בטעינת הדף
      await loadActiveProposalsCount()
    }

    initializeAuth()
  }, [])

  const tabs = [
    { id: 'matches' as TabType, label: 'התאמות חדשות', icon: Heart, count: 0 },
    { id: 'proposals' as TabType, label: 'הצעות פעילות', icon: Users, count: activeProposalsCount },
    { id: 'import' as TabType, label: 'ייבוא מועמדים', icon: Upload, count: 0 },
    { id: 'history' as TabType, label: 'היסטוריה', icon: History, count: 0 },
    { id: 'settings' as TabType, label: 'הגדרות', icon: Settings, count: 0 },
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
        />
      case 'proposals':
        return <ProposalsTab accessToken={accessToken} onCountChange={setActiveProposalsCount} />
      case 'import':
        return <ImportTab accessToken={accessToken} />
      case 'history':
        return <HistoryTab />
      case 'settings':
        return <SettingsTab accessToken={accessToken} />
      default:
        return <MatchesTab 
          accessToken={accessToken} 
          globalScanState={globalScanState}
          setGlobalScanState={setGlobalScanState}
          onProposalCountChange={setActiveProposalsCount}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">מועמדים בגיליון</p>
                <p className="text-2xl font-bold text-gray-900">2</p>
              </div>
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">שיעור הצלחה</p>
                <p className="text-2xl font-bold text-gray-900">--%</p>
              </div>
              <Heart className="w-8 h-8 text-red-600" />
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
  onProposalCountChange
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
}) => {
  const [matches, setMatches] = useState<MatchProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [candidates, setCandidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
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
        setMatches(activeSession.session_data)
        console.log('טעון סשן פעיל עם', activeSession.session_data.length, 'התאמות')
      }
    } catch (error) {
      console.error('שגיאה בטעינת סשן פעיל:', error)
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
      console.log('🔍 בודק חיבור למערכת...')
      setGlobalScanState({
        isScanning: true,
        progress: { current: 10, total: 100, message: 'בודק חיבור למערכת...' }
      })
      
      const authCheck = await checkAuthConnection()
      if (!authCheck.isConnected) {
        throw new Error(authCheck.error || 'שגיאה בחיבור למערכת')
      }
      console.log('✅ חיבור למערכת תקין')

      // טעינת נתוני מועמדים
      console.log('טוען נתוני מועמדים...')
      setGlobalScanState({
        isScanning: true,
        progress: { current: 30, total: 100, message: 'טוען נתוני מועמדים מהגיליון...' }
      })
      
      // קבלת ה-sheetId מההגדרות או מ-localStorage
      const sheetId = localStorage.getItem('sheetId')
      if (!sheetId) {
        throw new Error('לא נמצא מזהה גיליון. אנא הגדר את הגיליון בטאב ההגדרות.')
      }
      
      const candidatesData = await loadCandidatesFromSheet(accessToken!, sheetId)

      if (candidatesData.males.length === 0 || candidatesData.females.length === 0) {
        throw new Error('לא נמצאו מועמדים בגיליון')
      }

      // יצירת התאמות עם AI
      console.log('יוצר התאמות עם AI...')
      setGlobalScanState({
        isScanning: true,
        progress: { current: 60, total: 100, message: 'מנתח מועמדים עם בינה מלאכותית...' }
      })
      
      const generatedMatches = await generateMatches(
        candidatesData.males,
        candidatesData.females,
        5, // סף לוגי - רק התאמות איכותיות
        10 // יוחזרו 10 הטובות ביותר אחרי ניתוח GPT של כולם
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
      
      console.log(`✅ הושלם! נוצרו ${generatedMatches.length} התאמות`)
      
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

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'highly_recommended': return 'bg-green-100 text-green-800'
      case 'recommended': return 'bg-blue-100 text-blue-800'
      case 'consider': return 'bg-yellow-100 text-yellow-800'
      case 'not_recommended': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'highly_recommended': return 'מומלץ מאוד'
      case 'recommended': return 'מומלץ'
      case 'consider': return 'לשקול'
      case 'not_recommended': return 'לא מומלץ'
      default: return 'לבדוק'
    }
  }

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
              matches={matches}
                              onStatusUpdate={async (matchId, newStatus) => {
                  try {
                    // שימוש בפונקציה המרכזית לעדכון סטטוס
                    const updatedMatches = await updateMatchStatus(matches, matchId, newStatus, onProposalCountChange)
                    setMatches(updatedMatches)
                    
                    // הודעת הצלחה לעדכון הממשק
                    console.log(`✅ עודכן סטטוס הצעה ${matchId} ל-${newStatus}`)
                    
                    // אם ההצעה אושרה, תוצג הודעה נוספת
                    if (newStatus === 'approved') {
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
const updateMatchStatus = async (matches: MatchProposal[], matchId: string, newStatus: 'approved' | 'rejected', onProposalCountChange?: (count: number) => void) => {
  const updatedMatches = matches.map(m => 
    m.id === matchId ? { ...m, status: newStatus } : m
  )
  
  // שמירה מקומית
  localStorage.setItem('currentMatches', JSON.stringify(updatedMatches))
  
  // שמירה בסשן פעיל
  await updateActiveSession(updatedMatches)
  
  // אם אושר - העברה להצעות פעילות
  if (newStatus === 'approved') {
    const approvedMatch = updatedMatches.find(m => m.id === matchId)
    if (approvedMatch) {
      await moveMatchToProposals(approvedMatch)
      
      // עדכון מונה ההצעות הפעילות מיד
      if (onProposalCountChange) {
        // המתנה קצרה לוודא שההצעה נשמרה במסד הנתונים
        setTimeout(async () => {
          try {
            console.log('🔍 בודק מספר הצעות פעילות לאחר אישור...')
            const { data: currentProposals } = await supabase
              .from('match_proposals')
              .select('id')
              .in('status', ['approved', 'in_progress', 'completed'])
            
            const newCount = currentProposals?.length || 0
            console.log('📊 נמצאו', newCount, 'הצעות פעילות, מעדכן מונה...')
            onProposalCountChange(newCount)
          } catch (error) {
            console.error('שגיאה בעדכון מונה הצעות:', error)
          }
        }, 200) // המתנה קצרה לוודא שההכנסה הסתיימה
      }
    }
  }
  
  return updatedMatches
}

// רכיב טאב הצעות
const ProposalsTab = ({ accessToken, onCountChange }: { accessToken: string | null, onCountChange: (count: number) => void }) => {
  const [proposals, setProposals] = useState<EnhancedProposal[]>([])
  const [filteredProposals, setFilteredProposals] = useState<EnhancedProposal[]>([]) // הצעות מסוננות לתצוגה
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<EnhancedProposal | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true) // מציין אם זו הטעינה הראשונה
  const [searchText, setSearchText] = useState('') // טקסט החיפוש הנוכחי
  const [filter, setFilter] = useState<ProposalsFilter>({
    status: ['approved', 'in_progress', 'completed'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  useEffect(() => {
    if (accessToken) {
      loadEnhancedProposalsData()
    }
  }, [accessToken, filter])

  // אתחול filteredProposals כאשר proposals משתנה (ללא חיפוש)
  useEffect(() => {
    if (!filter.searchTerm) {
      setFilteredProposals(proposals)
    }
  }, [proposals, filter.searchTerm])

  // הסרתי את ה-useEffect שמעדכן את המונה כל פעם - זה יוצר עדכונים מיותרים

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
      // יישום החיפוש על ההצעות הנוכחיות
      applyTextSearch(proposals, searchText)
    }
  }

  // פונקציה לניקוי החיפוש
  const clearSearch = () => {
    setSearchText('')
    setFilter(prev => ({ ...prev, searchTerm: '' }))
    applyTextSearch(proposals, '')
  }

  const loadEnhancedProposalsData = async () => {
    if (!accessToken) return
    
    try {
      setLoading(true)
      console.log('🔄 טוען הצעות פעילות...')
      const enhancedProposals = await loadEnhancedProposals(accessToken)
      console.log('📊 נטענו הצעות:', enhancedProposals.length)
      
      // יישום פילטרים בסיסיים (ללא חיפוש טקסט)
      let filtered = enhancedProposals
      
      if (filter.status && filter.status.length > 0) {
        filtered = filtered.filter(p => filter.status!.includes(p.status))
      }
      
      // הסרתי את חיפוש הטקסט מכאן - זה יטופל בנפרד
      
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
      
      // שמירת כל ההצעות (מסוננות בלי חיפוש טקסט)
      setProposals(filtered)
      // יישום חיפוש טקסט על ההצעות המסוננות
      applyTextSearch(filtered, filter.searchTerm || '')
      
      // עדכון מספר ההצעות הכולל (לא לפי החיפוש!)
      onCountChange(filtered.length)
      setIsFirstLoad(false) // מעכשיו זו לא הטעינה הראשונה
      console.log('✅ מוצגות', filtered.length, 'הצעות פעילות מתוך', enhancedProposals.length, 'כולל')
    } catch (error) {
      console.error('שגיאה בטעינת הצעות מורחבות:', error)
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
      // טעינת ההצעה המעודכנת מהשרת
      const updatedProposals = await loadEnhancedProposals(accessToken!)
      const updatedProposal = updatedProposals.find(p => p.id === proposalId)
      
      if (updatedProposal) {
        // עדכון רק ההצעה הספציפית ברשימה הקיימת
        setProposals(prevProposals => {
          const newProposals = prevProposals.map(p => 
            p.id === proposalId ? updatedProposal : p
          )
          onCountChange(newProposals.length) // עדכון המונה
          return newProposals
        })
        console.log('✅ הצעה עודכנה בהצלחה:', proposalId)
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

  return (
    <div>
      {/* כותרת וסינון */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">הצעות פעילות</h2>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            {proposals.length} הצעות
          </span>
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
          <p className="text-gray-600">
            כאן יופיעו ההצעות שאישרת ונמצאות בתהליך מעקב.<br/>
            אשר הצעות מהטאב "התאמות חדשות" כדי לראות אותן כאן.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onUpdate={() => updateSingleProposal(proposal.id)}
              onViewProfiles={setSelectedProposal}
            />
          ))}
        </div>
      )}

      {/* מודל צפיה בפרופילים */}
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

// רכיב טאב היסטוריה
const HistoryTab = () => {
  const [sessions, setSessions] = useState<MatchingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<MatchingSession | null>(null)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)

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
    
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את הסשן? פעולה זו בלתי הפיכה.')) {
      return
    }

    setDeletingSession(sessionId)
    try {
      await deleteSession(sessionId)
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
              matches={selectedSession.session_data}
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
                   if (newStatus === 'approved') {
                     const approvedMatch = updatedMatches.find(m => m.id === matchId)
                     if (approvedMatch) {
                       await moveMatchToProposals(approvedMatch)
                     }
                   }
                   
                   // הודעת הצלחה
                   console.log(`✅ עודכן סטטוס הצעה ${matchId} ל-${newStatus} בהיסטוריה`)
                   
                   // אם ההצעה אושרה, תוצג הודעה נוספת
                   if (newStatus === 'approved') {
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
                       m.id === matchId ? { ...m, status: originalMatch?.status || 'pending' } : m
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
    </div>
  )
}

// רכיב טאב ייבוא
const ImportTab = ({ accessToken }: { accessToken: string | null }) => {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [candidates, setCandidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
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
        setCandidates(parsedCandidates)
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

      const sheetId = settings?.google_sheet_id || localStorage.getItem('sheetId')
      if (!sheetId) {
        setError('נא להגדיר מזהה גיליון בטאב הגדרות')
        return
      }

      const data = await loadCandidatesFromSheet(accessToken, sheetId)
      
      // שמירת הנתונים ב-localStorage
      localStorage.setItem('importedCandidates', JSON.stringify(data))
      
      setCandidates(data)
      
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
                  setCandidates(null)
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

// רכיב טאב הגדרות
const SettingsTab = ({ accessToken }: { accessToken: string | null }) => {
  const [sheetId, setSheetId] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean, message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // טעינת הגדרות קיימות מהמסד הנתונים
  useEffect(() => {
    loadCurrentSettings()
  }, [])

  const loadCurrentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('shadchanim')
        .select('google_sheet_id, openai_api_key')
        .eq('auth_user_id', user.id)
        .single()

      if (data) {
        setSheetId(data.google_sheet_id || '')
        setOpenaiKey(data.openai_api_key || '')
      }
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות:', error)
    } finally {
      setLoading(false)
    }
  }

  const testGoogleSheetsConnection = async () => {
    if (!sheetId) {
      setConnectionResult({ success: false, message: 'נא להזין מזהה גיליון' })
      return
    }

    setTestingConnection(true)
    setConnectionResult(null)

    try {
      if (!accessToken) {
        setConnectionResult({ success: false, message: 'אין אסימון גישה. נסי להתחבר מחדש עם Google' })
        return
      }

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConnectionResult({ 
          success: true, 
          message: `חיבור הצליח! גיליון: "${data.properties?.title || 'ללא שם'}"` 
        })
      } else {
        setConnectionResult({ 
          success: false, 
          message: 'לא ניתן לגשת לגיליון. בדקי שהגיליון ציבורי או שיש לך הרשאות גישה' 
        })
      }
    } catch (error) {
      setConnectionResult({ 
        success: false, 
        message: 'שגיאה בחיבור לגיליון' 
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const saveSettings = async () => {
    if (!sheetId && !openaiKey) {
      alert('נא להזין לפחות אחד מהשדות')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('שגיאה: לא מחובר למערכת')
        return
      }

      const updateData: any = {}
      if (sheetId) updateData.google_sheet_id = sheetId
      if (openaiKey) updateData.openai_api_key = openaiKey

      const { error } = await supabase
        .from('shadchanim')
        .update(updateData)
        .eq('auth_user_id', user.id)

      if (error) {
        throw error
      }

      // גם שמירה ב-localStorage לתאימות לאחור
      if (sheetId) localStorage.setItem('sheetId', sheetId)
      if (openaiKey) localStorage.setItem('openaiKey', openaiKey)

      alert('הגדרות נשמרו בהצלחה במסד הנתונים!')
    } catch (error: any) {
      console.error('שגיאה בשמירת הגדרות:', error)
      alert('שגיאה בשמירת הגדרות: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">טוען הגדרות...</div>
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">הגדרות מערכת</h2>
      <div className="space-y-6">
        {/* חיבור גיליון */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium mb-4 text-lg">חיבור לגיליון Google Sheets</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                מזהה הגיליון (מה-URL)
              </label>
              <input
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">
                העתיקי את המזהה מכתובת הגיליון: 
                https://docs.google.com/spreadsheets/d/<strong>מזהה-הגיליון</strong>/edit
              </p>
            </div>

            <button
              onClick={testGoogleSheetsConnection}
              disabled={testingConnection || !sheetId}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingConnection ? 'בודק חיבור...' : 'בדוק חיבור'}
            </button>

            {connectionResult && (
              <div className={`p-3 rounded-lg text-sm ${
                connectionResult.success 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {connectionResult.message}
              </div>
            )}
          </div>
        </div>

        {/* מפתח OpenAI */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium mb-4 text-lg">מפתח OpenAI</h3>
          <div className="text-sm text-gray-600 mb-3">
            סטטוס: <span className={openaiKey ? 'text-green-600' : 'text-red-600'}>
              {openaiKey ? 'הוגדר ✅' : 'לא הוגדר ❌'}
            </span>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              dir="ltr"
            />
          </div>
        </div>

        {/* כפתור שמירה כללי */}
        <div className="border-t pt-6">
          <button 
            onClick={saveSettings}
            disabled={saving}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'שומר...' : '💾 שמור הגדרות במסד הנתונים'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            ההגדרות יישמרו במסד הנתונים ויסתנכרנו על פני כל המכשירים
          </p>
        </div>
      </div>
    </div>
  )
}

// רכיב להצגת הצעת התאמה משופרת
const MatchCard = ({ match, matches, onStatusUpdate }: { 
  match: MatchProposal, 
  matches: MatchProposal[],
  onStatusUpdate?: (matchId: string, newStatus: 'approved' | 'rejected') => void 
}) => {
  const [showProfilesModal, setShowProfilesModal] = useState(false)
  const [candidatesData, setCandidatesData] = useState<{
    maleProfile: any | null
    femaleProfile: any | null
  }>({ maleProfile: null, femaleProfile: null })
  const [isProcessing, setIsProcessing] = useState(false)

  // טעינת נתוני המועמדים המלאים
  const loadCandidateProfiles = async () => {
    try {
      console.log('נתוני הצעה מלאים:', match)
      console.log('boy_data:', match.boy_data)
      console.log('girl_data:', match.girl_data)
      
      setCandidatesData({
        maleProfile: match.boy_data || null,
        femaleProfile: match.girl_data || null
      })
      
      setShowProfilesModal(true)
    } catch (error) {
      console.error('שגיאה בטעינת פרופילי המועמדים:', error)
    }
  }

  // טיפול באישור הצעה
  const handleApprove = async () => {
    if (isProcessing) return
    
    const confirmApprove = window.confirm(
      `האם אתה בטוח שברצונך לאשר את ההצעה בין ${match.maleName} ו-${match.femaleName}?\n\nלאחר האישור, ההצעה תועבר לטאב "הצעות פעילות" למעקב.`
    )
    
    if (!confirmApprove) return
    
    setIsProcessing(true)
    try {
      // הודעת התחלה
      const processingNotification = document.createElement('div')
      processingNotification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      processingNotification.textContent = 'מעבד אישור הצעה...'
      document.body.appendChild(processingNotification)
      
      // עדכון הסטטוס - נקרא רק ל-onStatusUpdate שיטפל בהכל
      if (onStatusUpdate) {
        await onStatusUpdate(match.id, 'approved')
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
    
    const confirmReject = window.confirm(
      `האם אתה בטוח שברצונך לדחות את ההצעה בין ${match.maleName} ו-${match.femaleName}?\n\nהסיבה לדחיה תירשם ותועזור לשפר התאמות עתידיות.`
    )
    
    if (!confirmReject) return
    
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
            match.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            match.status === 'approved' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {match.status === 'pending' ? 'ממתין' : 
             match.status === 'approved' ? 'אושר' : 'נדחה'}
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
            onClick={loadCandidateProfiles}
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
            disabled={isProcessing}
          >
            👥 צפה בפרופילים
        </Button>
          
          {match.status === 'pending' && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                onClick={handleApprove}
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
          
          {match.status === 'approved' && (
            <span className="text-sm text-green-600 font-medium px-3 py-2 bg-green-50 rounded">
              ✅ ההצעה אושרה - מועברת להצעות פעילות
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
              <span className="font-medium text-gray-600">עיר:</span>
              <span className="mr-2">{profile.location || profile.city || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מגזר:</span>
              <span className="mr-2">{profile.sector || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">פתוח למגזרים אחרים:</span>
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
              <span className="font-medium text-gray-600">זרם דתי:</span>
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
              <span className="font-medium text-gray-600">שפות:</span>
              <span className="mr-2">{profile.languages || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">גובה:</span>
              <span className="mr-2">{profile.height || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מראה:</span>
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
              <span className="font-medium text-gray-600">אחים:</span>
              <span className="mr-2">{profile.siblings || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">מקום בסדר הלידה:</span>
              <span className="mr-2">{profile.birthOrder || 'לא צוין'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">שימוש באינטרנט:</span>
              <span className="mr-2">{profile.internetUsage || 'לא צוין'}</span>
            </div>
          </div>

          {/* שדות טקסט ארוכים */}
          <div className="space-y-3">
            {profile.aboutMe && (
              <div>
                <span className="font-medium text-gray-600">קצת עליי:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.aboutMe}</p>
              </div>
            )}

            {profile.lookingFor && (
              <div>
                <span className="font-medium text-gray-600">מחפש/ת:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.lookingFor}</p>
              </div>
            )}

            {profile.importantQualities && (
              <div>
                <span className="font-medium text-gray-600">תכונות חשובות לי:</span>
                <p className="text-gray-700 mt-1 bg-blue-50 p-2 rounded">{profile.importantQualities}</p>
              </div>
            )}

            {profile.hobbies && (
              <div>
                <span className="font-medium text-gray-600">תחביבים ועניינים:</span>
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
                <span className="font-medium text-gray-600">אישיות:</span>
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
                <span className="font-medium text-gray-600">גמישות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.flexibility}</p>
              </div>
            )}

            {profile.educationViews && (
              <div>
                <span className="font-medium text-gray-600">השקפה על חינוך:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.educationViews}</p>
              </div>
            )}

            {profile.familyBackground && (
              <div>
                <span className="font-medium text-gray-600">רקע משפחתי:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.familyBackground}</p>
              </div>
            )}

            {profile.additionalNotes && (
              <div>
                <span className="font-medium text-gray-600">הערות נוספות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.additionalNotes}</p>
              </div>
            )}

            {profile.notes && (
              <div>
                <span className="font-medium text-gray-600">הערות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.notes}</p>
              </div>
            )}

            {profile.dealBreakers && (
              <div>
                <span className="font-medium text-gray-600">דרישות מהותיות (דיל ברייקרס):</span>
                <p className="text-red-700 mt-1 bg-red-50 p-2 rounded border border-red-200 font-medium">{profile.dealBreakers}</p>
              </div>
            )}

            {profile.contact && (
              <div>
                <span className="font-medium text-gray-600">פרטי קשר:</span>
                <p className="text-gray-700 mt-1 bg-green-50 p-2 rounded">{profile.contact}</p>
              </div>
            )}

            {profile.currentlyProposed && (
              <div>
                <span className="font-medium text-gray-600">הצעות נוכחיות:</span>
                <p className="text-gray-700 mt-1 bg-yellow-50 p-2 rounded">{profile.currentlyProposed}</p>
              </div>
            )}

            {profile.previouslyProposed && (
              <div>
                <span className="font-medium text-gray-600">הצעות קודמות:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{profile.previouslyProposed}</p>
              </div>
            )}

            {/* הצגת שדות דינמיים נוספים */}
            {Object.entries(profile).map(([key, value]) => {
              // דילוג על שדות שכבר הוצגו
              if (['id', 'name', 'age', 'birthDate', 'maritalStatus', 'preferredAgeRange', 'sector', 'openToOtherSectors', 'location', 'city', 'community', 'edah', 
                   'religiousLevel', 'religiousStream', 'education', 'profession', 'languages', 'height', 
                   'appearance', 'dressStyle', 'smoking', 'siblings', 'birthOrder', 'internetUsage',
                   'aboutMe', 'lookingFor', 'importantQualities', 'hobbies', 'valuesAndBeliefs', 
                   'personality', 'lifestyle', 'flexibility', 'educationViews', 'familyBackground',
                   'additionalNotes', 'notes', 'dealBreakers', 'contact', 'currentlyProposed', 
                   'previouslyProposed'].includes(key)) {
                return null
              }

              // הצגת שדות נוספים שיש בהם תוכן
              if (value && typeof value === 'string' && value.trim()) {
                return (
                  <div key={key}>
                    <span className="font-medium text-gray-600">{key}:</span>
                    <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{value}</p>
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">פרופילי המועמדים</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
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