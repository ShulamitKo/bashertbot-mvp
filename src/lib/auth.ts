import { supabase } from './supabase'
import { Shadchan } from '@/types'

// התחברות עם Google OAuth
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly'
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// יציאה מהמערכת
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// קבלת פרופיל המשתמש הנוכחי
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('שגיאה בקבלת משתמש:', error)
    return null
  }
}

// קבלת או יצירת פרופיל שדכן
export async function getOrCreateShadchanProfile(user: any): Promise<Shadchan | null> {
  try {
    // בדיקה אם כבר קיים פרופיל
    const { data: existingProfile, error: fetchError } = await supabase
      .from('shadchanim')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (existingProfile && !fetchError) {
      return existingProfile
    }

    // יצירת פרופיל חדש
    const { data: newProfile, error: createError } = await supabase
      .from('shadchanim')
      .insert({
        auth_user_id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'שדכן',
        email: user.email,
        google_oauth_token: user.user_metadata?.provider_token
      })
      .select()
      .single()

    if (createError) throw createError
    return newProfile
  } catch (error) {
    console.error('שגיאה בקבלת/יצירת פרופיל שדכן:', error)
    return null
  }
}

// עדכון הגדרות שדכן
export async function updateShadchanSettings(shadchanId: string, settings: Partial<Shadchan>) {
  try {
    const { data, error } = await supabase
      .from('shadchanim')
      .update(settings)
      .eq('id', shadchanId)
      .select()
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// בדיקת סטטוס אימות
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

// פונקציה לבדיקת סטטוס האימות
export const debugAuthStatus = async () => {
  try {
    console.log('🔍 בודק סטטוס אימות...')
    
    // בדיקת סשן נוכחי
    const { data: session, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 Session data:', session)
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
    }
    
    // בדיקת משתמש נוכחי
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('👤 User data:', user)
    if (userError) {
      console.error('❌ User error:', userError)
    }
    
    // אם יש משתמש, בואו נבדוק אם יש לו שדכן
    if (user) {
      const { data: shadchan, error: shadchanError } = await supabase
        .from('shadchanim')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      
      console.log('🎯 Shadchan data:', shadchan)
      if (shadchanError) {
        console.error('❌ Shadchan error:', shadchanError)
      }
    }
    
  } catch (error) {
    console.error('❌ Debug auth error:', error)
  }
}

// פונקציה לרענון הטוקן
export const refreshAuthToken = async (): Promise<boolean> => {
  try {
    console.log('🔄 מרענן טוקן אימות...')
    
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('❌ שגיאה ברענון טוקן:', error)
      return false
    }
    
    if (data.session) {
      console.log('✅ טוקן רוענן בהצלחה')
      return true
    }
    
    console.warn('⚠️ לא התקבל טוקן חדש')
    return false
    
  } catch (error) {
    console.error('❌ שגיאה ברענון טוקן:', error)
    return false
  }
} 