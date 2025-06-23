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