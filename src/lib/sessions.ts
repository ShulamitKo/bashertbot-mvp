import { supabase } from './supabase'
import { MatchProposal } from '../types'

// טיפוסי נתונים לסשנים
export interface MatchingSession {
  id: string
  shadchan_id: string
  created_at: string
  is_active: boolean
  position: number
  total_matches: number
  processed_matches: number
  session_data: MatchProposal[]
}

// קבלת הסשן הפעיל הנוכחי
export const getActiveSession = async (): Promise<MatchingSession | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) return null

    const { data, error } = await supabase
      .from('matching_sessions')
      .select('*')
      .eq('shadchan_id', shadchan.id)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('שגיאה בקבלת סשן פעיל:', error)
      return null
    }

    return data || null
  } catch (error) {
    console.error('שגיאה בקבלת סשן פעיל:', error)
    return null
  }
}

// יצירת סשן חדש (דוחף את הקודם להיסטוריה)
export const createNewSession = async (): Promise<MatchingSession | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    // דחיקת הסשן הפעיל הנוכחי (אם יש)
    await pushActiveToHistory(shadchan.id)

    // יצירת סשן חדש
    const { data, error } = await supabase
      .from('matching_sessions')
      .insert({
        shadchan_id: shadchan.id,
        is_active: true,
        position: 0,
        total_matches: 0,
        processed_matches: 0,
        session_data: []
      })
      .select()
      .single()

    if (error) throw error

    console.log('✅ נוצר סשן חדש:', data.id)
    return data
  } catch (error) {
    console.error('❌ שגיאה ביצירת סשן חדש:', error)
    throw error
  }
}

// דחיקת הסשן הפעיל להיסטוריה
const pushActiveToHistory = async (shadchanId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('matching_sessions')
      .update({ is_active: false, position: 1 })
      .eq('shadchan_id', shadchanId)
      .eq('is_active', true)

    if (error) throw error
  } catch (error) {
    console.error('שגיאה בדחיקת סשן להיסטוריה:', error)
    throw error
  }
}

// עדכון נתוני הסשן הפעיל
export const updateActiveSession = async (matches: MatchProposal[]): Promise<void> => {
  try {
    const activeSession = await getActiveSession()
    if (!activeSession) {
      console.warn('אין סשן פעיל לעדכון')
      return
    }

    const processedCount = matches.filter(m => m.status !== 'pending').length

    const { error } = await supabase
      .from('matching_sessions')
      .update({
        session_data: matches,
        total_matches: matches.length,
        processed_matches: processedCount
      })
      .eq('id', activeSession.id)

    if (error) throw error

    console.log(`✅ עודכן סשן: ${matches.length} התאמות, ${processedCount} מעובדות`)
  } catch (error) {
    console.error('❌ שגיאה בעדכון סשן:', error)
    throw error
  }
}

// קבלת היסטוריית סשנים (10 אחרונים)
export const getSessionHistory = async (): Promise<MatchingSession[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) return []

    const { data, error } = await supabase
      .from('matching_sessions')
      .select('*')
      .eq('shadchan_id', shadchan.id)
      .eq('is_active', false)
      .order('position', { ascending: true })
      .limit(10)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('שגיאה בקבלת היסטוריית סשנים:', error)
    return []
  }
}

// בדיקה האם יש התאמות לא מעובדות בסשן הפעיל
export const hasUnprocessedMatches = async (): Promise<{ hasUnprocessed: boolean, count: number }> => {
  try {
    const activeSession = await getActiveSession()
    if (!activeSession) return { hasUnprocessed: false, count: 0 }

    const unprocessedCount = activeSession.session_data.filter(m => m.status === 'pending').length
    
    return { 
      hasUnprocessed: unprocessedCount > 0, 
      count: unprocessedCount 
    }
  } catch (error) {
    console.error('שגיאה בבדיקת התאמות לא מעובדות:', error)
    return { hasUnprocessed: false, count: 0 }
  }
}

// העברת התאמה מאושרת להצעות פעילות
export const moveMatchToProposals = async (match: MatchProposal): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    const activeSession = await getActiveSession()

    const { error } = await supabase
      .from('match_proposals')
      .insert({
        shadchan_id: shadchan.id,
        boy_row_id: match.maleId,
        girl_row_id: match.femaleId,
        match_score: match.finalScore,
        ai_reasoning: match.summary,
        original_session_id: activeSession?.id,
        status: 'approved'
      })

    if (error) throw error

    console.log('✅ התאמה הועברה להצעות פעילות:', match.maleName, '-', match.femaleName)
  } catch (error) {
    console.error('❌ שגיאה בהעברת התאמה להצעות:', error)
    throw error
  }
}

// סיכום סטטיסטיקות סשן
export const getSessionStats = (session: MatchingSession) => {
  const total = session.total_matches
  const processed = session.processed_matches
  const pending = total - processed
  const completionRate = total > 0 ? Math.round((processed / total) * 100) : 0

  return {
    total,
    processed,
    pending,
    completionRate,
    isCompleted: pending === 0
  }
}

// מחיקת סשן מההיסטוריה
export const deleteSession = async (sessionId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    // קודם נמצא את ה-shadchan_id
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    console.log('🔍 מנסה למחוק סשן:', sessionId, 'עבור שדכן:', shadchan.id)

    // ראשית נבדוק שהסשן קיים ושייך לשדכן
    const { data: sessionToDelete, error: fetchError } = await supabase
      .from('matching_sessions')
      .select('id, shadchan_id')
      .eq('id', sessionId)
      .eq('shadchan_id', shadchan.id)
      .single()

    if (fetchError) {
      console.error('❌ שגיאה בחיפוש הסשן:', fetchError)
      throw new Error(`לא ניתן למצוא את הסשן: ${fetchError.message}`)
    }

    if (!sessionToDelete) {
      throw new Error('הסשן לא נמצא או שאינך מורשה למחוק אותו')
    }

    console.log('✅ סשן נמצא, מבצע מחיקה...')

    const { error } = await supabase
      .from('matching_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('shadchan_id', shadchan.id)

    if (error) {
      console.error('❌ שגיאה במחיקה:', error)
      throw error
    }

    console.log('✅ סשן נמחק בהצלחה:', sessionId)
    
  } catch (error) {
    console.error('❌ שגיאה במחיקת סשן:', error)
    throw error
  }
} 