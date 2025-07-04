import { useState } from 'react'
import { signInWithGoogle } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface LoginPageProps {
  onLogin?: () => void
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await signInWithGoogle()
      
      if (result.success) {
        if (onLogin) onLogin()
      } else {
        setError(result.error || 'שגיאה בהתחברות')
      }
    } catch (err: any) {
      setError('שגיאה בהתחברות: ' + (err.message || 'אירעה שגיאה לא צפויה'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async () => {
    if (!email) {
      setError('נא להזין כתובת אימייל')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      })

      if (error) {
        setError(error.message)
      } else {
        setError('נשלח לך קישור התחברות לאימייל')
      }
    } catch (err: any) {
      setError('שגיאה בשליחת אימייל: ' + (err.message || 'אירעה שגיאה לא צפויה'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {/* כותרת */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">ב</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">באשערטבוט</h1>
          <p className="text-gray-600">מערכת שידוכים מבוססת בינה מלאכותית</p>
        </div>

        {/* הודעת שגיאה */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* כפתור התחברות */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center space-x-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>
              {isLoading ? 'מתחבר...' : 'התחברות עם Google'}
            </span>
          </button>

          <div className="text-center text-gray-400 text-sm">או</div>

          <input
            type="email"
            placeholder="הכנס את כתובת האימייל שלך"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          
          <button
            onClick={handleEmailLogin}
            disabled={isLoading || !email}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-3 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'שולח...' : 'שלח קישור התחברות לאימייל'}
          </button>

          {/* מידע נוסף */}
          <div className="text-xs text-gray-500 text-center mt-6">
            <p>על ידי התחברות אתה מסכים לתנאי השימוש ומדיניות הפרטיות</p>
          </div>
        </div>

        {/* יתרונות המערכת */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">מה כולל באשערטבוט?</h3>
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>התאמות חכמות באמצעות בינה מלאכותית</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>חיבור ישיר לגיליונות Google Sheets</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>ניהול מלא של הצעות שידוך</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>פרטיות מלאה - הנתונים נשארים אצלך</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
} 