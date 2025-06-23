import React, { useState, useEffect } from 'react'
import { Heart, Users, Upload, Settings, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, Download, BarChart3, Calendar, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { loadCandidatesFromSheet, DetailedCandidate } from '@/lib/google-sheets'
import { generateMatches } from '@/lib/openai'
import { MatchProposal } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface DashboardPageProps {
  user?: {
    name: string
    email: string
  }
}

type TabType = 'matches' | 'proposals' | 'import' | 'settings'

export const DashboardPage = ({ user }: DashboardPageProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('matches')
  const [accessToken, setAccessToken] = useState<string | null>(null)

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
    { id: 'settings' as TabType, label: 'הגדרות', icon: Settings, count: 0 },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return <MatchesTab accessToken={accessToken} />
      case 'proposals':
        return <ProposalsTab />
      case 'import':
        return <ImportTab accessToken={accessToken} />
      case 'settings':
        return <SettingsTab accessToken={accessToken} />
      default:
        return <MatchesTab accessToken={accessToken} />
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

        {/* טאבים */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
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
const MatchesTab = ({ accessToken }: { accessToken: string | null }) => {
  const [matches, setMatches] = useState<MatchProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number, total: number, message: string } | null>(null)

  const generateNewMatches = async () => {
    if (!accessToken) {
      setError('נא להתחבר מחדש עם Google')
      return
    }

    setLoading(true)
    setError(null)
    setProgress(null)

    try {
      // קבלת הגדרות מה-localStorage
      const sheetId = localStorage.getItem('sheetId')
      const openaiKey = localStorage.getItem('openaiKey')

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

      // טעינת מועמדים מהגיליון עם עיכוב למניעת Rate Limiting
      console.log('טוען מועמדים מהגיליון...')
      setProgress({ current: 20, total: 100, message: 'טוען מועמדים מהגיליון...' })
      
      // המתנה קצרה למניעת Rate Limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
      
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
      setProgress({ current: 50, total: 100, message: 'יוצר התאמות עם AI...' })

      // יצירת התאמות עם AI
      console.log('יוצר התאמות עם AI...')
      const generatedMatches = await generateMatches(
        candidatesData.males,
        candidatesData.females,
        4, // סף לוגי - רק התאמות איכותיות
        100 // מקסימום 100 התאמות - כל ההתאמות הטובות
      )

      setMatches(generatedMatches || [])
      setProgress({ current: 100, total: 100, message: 'הושלם!' })
      console.log(`נוצרו ${(generatedMatches || []).length} התאמות`)

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
      setTimeout(() => setProgress(null), 2000) // מסתיר את ה-progress לאחר 2 שניות
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">התאמות חדשות</h2>
        <div className="flex items-center space-x-4">
          {candidates && (
            <span className="text-sm text-gray-600">
              {candidates.males?.length || 0} בנים, {candidates.females?.length || 0} בנות
            </span>
          )}
          <button
            onClick={generateNewMatches}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'יוצר התאמות...' : 'צור התאמות חדשות'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">{progress.message}</span>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {error}
          </div>
        </div>
      )}

      {matches && matches.length > 0 ? (
        <div className="space-y-6">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין התאמות עדיין</h3>
          <p className="text-gray-600 mb-6">
            לחצי על "צור התאמות חדשות" כדי שהמערכת תנתח את המועמדים בגיליון
          </p>
          {candidates && (
            <div className="text-sm text-gray-500">
              נטענו {candidates.males?.length || 0} בנים ו-{candidates.females?.length || 0} בנות מהגיליון
            </div>
          )}
        </div>
      )}
    </div>
  )
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

// רכיב טאב ייבוא
const ImportTab = ({ accessToken }: { accessToken: string | null }) => {
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<{ males: DetailedCandidate[], females: DetailedCandidate[] } | null>(null)

  const loadCandidates = async () => {
    if (!accessToken) {
      alert('נא להתחבר מחדש עם Google')
      return
    }

    const sheetId = localStorage.getItem('sheetId')
    if (!sheetId) {
      alert('נא להגדיר מזהה גיליון בטאב הגדרות')
      return
    }

    setLoading(true)
    try {
      const data = await loadCandidatesFromSheet(accessToken, sheetId)
      setCandidates(data)
    } catch (error: any) {
      alert(`שגיאה בטעינת המועמדים: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">ייבוא מועמדים</h2>
      
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">מועמדים מהגיליון</h3>
          <button
            onClick={loadCandidates}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'טען מועמדים'}
          </button>
        </div>

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

            {/* רשימת מועמדים */}
            <div className="max-h-64 overflow-y-auto">
              <h4 className="font-medium mb-2">מועמדים:</h4>
              <div className="space-y-2 text-sm">
                {candidates.males.map((male, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{male.name}</span>
                    <span className="text-gray-500">{male.age} שנים, {male.location}</span>
                  </div>
                ))}
                {candidates.females.map((female, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{female.name}</span>
                    <span className="text-gray-500">{female.age} שנים, {female.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">לחץ "טען מועמדים" כדי לטעון את הנתונים מהגיליון</p>
          </div>
        )}
      </div>
    </div>
  )
}

// רכיב טאב הגדרות
const SettingsTab = ({ accessToken }: { accessToken: string | null }) => {
  const [sheetId, setSheetId] = useState(localStorage.getItem('sheetId') || '')
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openaiKey') || '')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean, message: string } | null>(null)

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
        localStorage.setItem('sheetId', sheetId)
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

  const saveOpenAIKey = () => {
    if (!openaiKey) {
      alert('נא להזין מפתח OpenAI')
      return
    }
    localStorage.setItem('openaiKey', openaiKey)
    alert('מפתח OpenAI נשמר בהצלחה!')
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
              {openaiKey ? 'הוגדר' : 'לא הוגדר'}
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
            <button 
              onClick={saveOpenAIKey}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              שמור מפתח
            </button>
          </div>
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

      <div className="flex gap-2 mt-4">
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          ✅ אישור הצעה
        </Button>
        <Button size="sm" variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
          📧 שלח אימייל
        </Button>
        <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
          ❌ דחיה
        </Button>
      </div>
    </Card>
  )
} 