import { useState, useEffect } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { Header } from './components/Layout/Header'
import { getCurrentUser, getOrCreateShadchanProfile, onAuthStateChange } from './lib/auth'
import { Shadchan } from './types'
import './App.css'
import { supabase } from './lib/supabase'

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
      console.log('🔄 שינוי סטטוס אימות:', { event, session })
      
      if (session?.user && session?.access_token) {
        console.log('✅ סשן תקף - מחובר')
        setUser(session.user)
        setIsAuthenticated(true)
        loadShadchanProfile(session.user)
      } else {
        console.log('❌ סשן לא תקף - מתנתק')
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
      // בדיקה כפולה - גם משתמש וגם סשן
      const currentUser = await getCurrentUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('🔍 בדיקת אימות:', { user: currentUser, session: session })
      
      if (currentUser && session) {
        setUser(currentUser)
        setIsAuthenticated(true)
        await loadShadchanProfile(currentUser)
      } else {
        console.warn('⚠️ משתמש או סשן לא תקינים')
        setUser(null)
        setIsAuthenticated(false)
        setShadchan(null)
      }
    } catch (error) {
      console.error('שגיאה בבדיקת סטטוס אימות:', error)
      setUser(null)
      setIsAuthenticated(false)
      setShadchan(null)
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
        shadchan={shadchan}
      />
    </div>
  )
}

export default App 