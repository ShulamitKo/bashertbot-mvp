import React, { useState, useEffect } from 'react'
import { Heart, Users, Upload, Settings, TrendingUp, AlertTriangle, ArrowLeft, History, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  hasUnprocessedMatches,
  moveMatchToProposals,
  getSessionHistory,
  getSessionStats,
  deleteSession,
  MatchingSession
} from '@/lib/sessions'

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
  
  // State גלובלי לסריקת התאמות
  const [globalScanState, setGlobalScanState] = useState<{
    isScanning: boolean
    progress: { current: number, total: number, message: string } | null
  }>({
    isScanning: false,
    progress: null
  })

  useEffect(() => {
    // קבלת Access Token מSupabase
    const getAccessToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        setAccessToken(session.provider_token)
      }
    }
    getAccessToken()
  }, [])

  const tabs = [
    { id: 'matches' as TabType, label: 'התאמות חדשות', icon: Heart, count: 0 },
    { id: 'proposals' as TabType, label: 'הצעות פעילות', icon: Users, count: 0 },
    { id: 'import' as TabType, label: 'ייבוא מועמדים', icon: Upload, count: 0 },
    { id: 'history' as TabType, label: 'היסטוריה', icon: History, count: 0 },
    { id: 'settings' as TabType, label: 'הגדרות', icon: Settings, count: 0 },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return <MatchesTab 
          accessToken={accessToken} 
          globalScanState={globalScanState}
          setGlobalScanState={setGlobalScanState}
        />
      case 'proposals':
        return <ProposalsTab />
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
        />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* כותרת דשבורד */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            שלום {user?.name || 'שדכן'} 👋
          </h1>
          <p className="text-gray-600">
            מוכנה לבצע התאמות חדשות היום?
          </p>
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

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">הצעות פעילות</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
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
  setGlobalScanState 
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
}) => {
  const [matches, setMatches] = useState<MatchProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [candidates, setCandidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number, total: number, message: string } | null>(null)
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

  const performNewScan = async () => {
    setLoading(true)
    setError(null)
    
    // עדכון ה-State הגלובלי
    setGlobalScanState({
      isScanning: true,
      progress: { current: 0, total: 100, message: 'מכין את המערכת לסריקה...' }
    })
    
    setProgress({ current: 0, total: 100, message: 'מכין את המערכת לסריקה...' })

    try {
      // קבלת הגדרות מהמסד הנתונים
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('לא מחובר למערכת')
        setLoading(false)
        return
      }

      const { data: settings } = await supabase
        .from('shadchanim')
        .select('google_sheet_id, openai_api_key')
        .eq('auth_user_id', user.id)
        .single()

      const sheetId = settings?.google_sheet_id || localStorage.getItem('sheetId')
      const openaiKey = settings?.openai_api_key || localStorage.getItem('openaiKey')

      if (!sheetId) {
        setError('נא להגדיר מזהה גיליון בטאב הגדרות')
        setLoading(false)
        return
      }

      if (!openaiKey) {
        setError('נא להגדיר מפתח OpenAI בטאב הגדרות')
        setLoading(false)
        return
      }

      // וידוא שיש טוקן ו-openaiKey לא null
      if (!accessToken || !openaiKey) {
        setError('חסרים נתוני אימות')
        setLoading(false)
        return
      }

      // טעינת מועמדים מהגיליון עם עיכוב למניעת Rate Limiting
      console.log('טוען מועמדים מהגיליון...')
      const updateProgress = (current: number, message: string) => {
        const progressData = { current, total: 100, message }
        setProgress(progressData)
        setGlobalScanState({ isScanning: true, progress: progressData })
      }
      
      updateProgress(5, '🔗 מתחבר לגיליון Google Sheets...')
      
      // המתנה קצרה למניעת Rate Limiting
      await new Promise(resolve => setTimeout(resolve, 800))
      
      updateProgress(15, '📊 טוען נתוני מועמדים...')
      await new Promise(resolve => setTimeout(resolve, 600))
      
      const candidatesData = await loadCandidatesFromSheet(accessToken, sheetId)
      setCandidates(candidatesData)

      if (!candidatesData || !candidatesData.males || !candidatesData.females) {
        setError('שגיאה בטעינת נתוני המועמדים')
        setLoading(false)
        return
      }

      if (candidatesData.males.length === 0 || candidatesData.females.length === 0) {
        setError('הגיליון לא מכיל מועמדים בשני הטאבים (בנים ובנות)')
        setLoading(false)
        return
      }

      console.log(`נטענו ${candidatesData.males.length} בנים ו-${candidatesData.females.length} בנות`)
      updateProgress(35, `👥 נטענו ${candidatesData.males.length} בנים ו-${candidatesData.females.length} בנות`)
      await new Promise(resolve => setTimeout(resolve, 800))
      
      updateProgress(50, '🔍 מנתח פרופילי מועמדים...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      updateProgress(70, '🤖 יוצר התאמות חכמות עם AI...')

      // יצירת התאמות עם AI
      console.log('יוצר התאמות עם AI...')
      const generatedMatches = await generateMatches(
        candidatesData.males,
        candidatesData.females,
        4, // סף לוגי - רק התאמות איכותיות
        10 // מקסימום 10 התאמות - כל ההתאמות הטובות
      )

      console.log(`✅ נוצרו ${generatedMatches.length} התאמות`)
      
      updateProgress(85, `💾 שומר ${generatedMatches.length} התאמות חדשות...`)
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // יצירת סשן חדש ושמירת ההתאמות
      await createNewSession()
      await updateActiveSession(generatedMatches)
      
      updateProgress(95, '🔄 מסיים עיבוד...')
      await new Promise(resolve => setTimeout(resolve, 400))
      
      setMatches(generatedMatches)
      updateProgress(100, '🎉 הושלם בהצלחה! נוצרו התאמות חדשות')
      
      // הודעת הצלחה ויזואלית
      setTimeout(() => {
        const successNotification = document.createElement('div')
        successNotification.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 animate-bounce'
        successNotification.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="text-2xl">🎉</div>
            <div>
              <div class="font-bold">סריקה הושלמה!</div>
              <div class="text-sm opacity-90">נוצרו ${generatedMatches.length} התאמות חדשות</div>
            </div>
          </div>
        `
        document.body.appendChild(successNotification)
        setTimeout(() => {
          if (document.body.contains(successNotification)) {
            document.body.removeChild(successNotification)
          }
        }, 5000)
      }, 1000)

    } catch (error: any) {
      console.error('שגיאה ביצירת התאמות:', error)
      
      // הודעת שגיאה מפורטת יותר
      let errorMessage = 'שגיאה לא ידועה'
      if (error.message?.includes('429')) {
        errorMessage = 'יותר מדי בקשות ל-Google Sheets. נסה שוב בעוד דקה'
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'שגיאה בטעינת נתונים מ-Google Sheets. בדוק את החיבור לאינטרנט'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
      
      // הצגת הודעת הצלחה למשך זמן ארוך יותר אם הסריקה הצליחה
      if (progress?.current === 100) {
        setTimeout(() => {
          setProgress(null)
          setGlobalScanState({ isScanning: false, progress: null })
        }, 4000) // 4 שניות להודעת הצלחה
      } else {
        setTimeout(() => {
          setProgress(null)
          setGlobalScanState({ isScanning: false, progress: null })
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
      {progress && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-600 border-t-transparent"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-6 w-6 border border-blue-400 opacity-20"></div>
              </div>
              <span className="text-lg font-semibold text-blue-800">{progress.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-600">{progress.current}%</span>
              <span className="text-xs text-blue-500">/ {progress.total}%</span>
            </div>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            >
              <div className="absolute inset-0 scan-progress-bar"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 progress-wave"></div>
              <div className="absolute right-0 top-0 h-full w-1 bg-white opacity-80 animate-pulse"></div>
            </div>
          </div>
          {progress.current === 100 && (
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

      {loading && progress && progress.current === 0 ? (
        <LoadingSpinner message="מכין את המערכת..." />
      ) : matches && matches.length > 0 ? (
        <div className="space-y-6">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
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
const updateMatchStatus = async (matchId: string, newStatus: 'approved' | 'rejected') => {
  const currentMatches = JSON.parse(localStorage.getItem('currentMatches') || '[]') as MatchProposal[]
  const updatedMatches = currentMatches.map(m => 
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
    }
  }
  
  return updatedMatches
}

// רכיב טאב הצעות
const ProposalsTab = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">הצעות פעילות</h2>
    <div className="text-center py-12">
      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">אין הצעות פעילות</h3>
      <p className="text-gray-600">
        כאן יופיעו ההצעות שאישרת ונמצאות בתהליך מעקב
      </p>
    </div>
  </div>
)

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
            <MatchCard key={match.id} match={match} />
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
  const [progress, setProgress] = useState<{ current: number, total: number, message: string } | null>(null)
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
    setProgress({ current: 0, total: 100, message: 'מכין חיבור לגיליון...' })

    try {
      // קבלת הגדרות מהמסד הנתונים
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('לא מחובר למערכת')
        return
      }

      setProgress({ current: 20, total: 100, message: 'מקבל הגדרות...' })
      await new Promise(resolve => setTimeout(resolve, 300))

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

      setProgress({ current: 40, total: 100, message: 'מתחבר לגיליון Google...' })
      await new Promise(resolve => setTimeout(resolve, 500))

      setProgress({ current: 60, total: 100, message: 'טוען נתוני מועמדים...' })
      const data = await loadCandidatesFromSheet(accessToken, sheetId)
      
      setProgress({ current: 90, total: 100, message: 'שומר נתונים...' })
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // שמירת הנתונים ב-localStorage
      localStorage.setItem('importedCandidates', JSON.stringify(data))
      
      setCandidates(data)
      setProgress({ current: 100, total: 100, message: 'הושלם בהצלחה! ✅' })
      
      console.log(`✅ נטענו ${data.males?.length || 0} בנים ו-${data.females?.length || 0} בנות`)
      
    } catch (error: any) {
      console.error('שגיאה בטעינת המועמדים:', error)
      setError(`שגיאה בטעינת המועמדים: ${error.message}`)
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(null), 2000)
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

        {/* Progress Bar */}
        {progress && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-700">{progress.message}</span>
              </div>
              <span className="text-sm text-blue-600">{progress.current}/{progress.total}</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

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
const MatchCard = ({ match }: { match: MatchProposal }) => {
  return (
    <Card className="p-4 border-r-4 border-r-blue-500">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-800">
            {match.maleName} ← → {match.femaleName}
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
        <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1">
          ✅ אישור הצעה
        </Button>
        <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 flex-1">
          ❌ דחיה
        </Button>
      </div>
    </Card>
  )
} 