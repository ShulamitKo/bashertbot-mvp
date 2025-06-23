import { useState } from 'react'
import { Heart, Users, Upload, Settings, TrendingUp } from 'lucide-react'

interface DashboardPageProps {
  user?: {
    name: string
    email: string
  }
}

type TabType = 'matches' | 'proposals' | 'import' | 'settings'

export const DashboardPage = ({ user }: DashboardPageProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('matches')

  const tabs = [
    { id: 'matches' as TabType, label: 'התאמות חדשות', icon: Heart, count: 12 },
    { id: 'proposals' as TabType, label: 'הצעות פעילות', icon: Users, count: 8 },
    { id: 'import' as TabType, label: 'ייבוא מועמדים', icon: Upload, count: 0 },
    { id: 'settings' as TabType, label: 'הגדרות', icon: Settings, count: 0 },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return <MatchesTab />
      case 'proposals':
        return <ProposalsTab />
      case 'import':
        return <ImportTab />
      case 'settings':
        return <SettingsTab />
      default:
        return <MatchesTab />
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
            מוכן לבצע התאמות חדשות היום?
          </p>
        </div>

        {/* סטטיסטיקות מהירות */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">התאמות השבוע</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">הצעות פעילות</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">מועמדים בגיליון</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">שיעור הצלחה</p>
                <p className="text-2xl font-bold text-gray-900">78%</p>
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
const MatchesTab = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">התאמות חדשות</h2>
    <div className="text-center py-12">
      <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">עדיין אין התאמות חדשות</h3>
      <p className="text-gray-600 mb-6">
        לאחר הגדרת הגיליון ומפתח ה-AI, המערכת תתחיל ליצור התאמות אוטומטיות
      </p>
      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
        הגדר חיבורים
      </button>
    </div>
  </div>
)

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
const ImportTab = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">ייבוא מועמדים</h2>
    <div className="text-center py-12">
      <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">חבר את הגיליון שלך</h3>
      <p className="text-gray-600 mb-6">
        חבר את גיליון Google Sheets שלך כדי להתחיל לעבוד עם המועמדים
      </p>
      <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
        חבר גיליון
      </button>
    </div>
  </div>
)

// רכיב טאב הגדרות
const SettingsTab = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">הגדרות מערכת</h2>
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium mb-2">חיבור לגיליון</h3>
          <div className="text-sm text-gray-600 mb-3">
            מחובר: <span className="text-red-600">לא מחובר</span>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
            הגדר חיבור
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium mb-2">מפתח OpenAI</h3>
          <div className="text-sm text-gray-600 mb-3">
            סטטוס: <span className="text-red-600">לא הוגדר</span>
          </div>
          <button className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors">
            הוסף מפתח
          </button>
        </div>
      </div>
    </div>
  </div>
) 