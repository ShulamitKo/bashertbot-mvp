import { useState, useEffect } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { Header } from './components/Layout/Header'
import { getCurrentUser, getOrCreateShadchanProfile, onAuthStateChange } from './lib/auth'
import { Shadchan } from './types'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [shadchan, setShadchan] = useState<Shadchan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // בדיקת סטטוס אימות ראשונה
    checkAuthStatus()

    // האזנה לשינויים בסטטוס האימות
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        loadShadchanProfile(session.user)
      } else {
        setUser(null)
        setIsAuthenticated(false)
        setShadchan(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        setIsAuthenticated(true)
        await loadShadchanProfile(currentUser)
      }
    } catch (error) {
      console.error('שגיאה בבדיקת סטטוס אימות:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadShadchanProfile = async (user: any) => {
    try {
      const profile = await getOrCreateShadchanProfile(user)
      setShadchan(profile)
    } catch (error) {
      console.error('שגיאה בטעינת פרופיל שדכן:', error)
    }
  }

  const handleLogin = () => {
    // הפונקציה תקרא אוטומטית דרך onAuthStateChange
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUser(null)
    setShadchan(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">ב</span>
          </div>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        user={{
          name: shadchan?.name || user?.user_metadata?.full_name || 'שדכן',
          email: user?.email || ''
        }}
        onSignOut={handleLogout}
      />
      <DashboardPage
        user={{
          name: shadchan?.name || user?.user_metadata?.full_name || 'שדכן',
          email: user?.email || ''
        }}
      />
    </div>
  )
}

export default App 