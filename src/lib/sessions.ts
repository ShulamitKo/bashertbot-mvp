import { supabase } from './supabase'
import { MatchProposal } from '../types'
import { refreshAuthToken } from './auth'

// פונקציה ליצירת ai_reasoning מפורט עם כל המידע
const createDetailedReasoning = (match: MatchProposal): string => {
  const parts: string[] = []
  
  // ציונים מפורטים
  if (match.logicalScore || match.gptScore || match.finalScore) {
    const scores: string[] = []
    if (match.logicalScore) scores.push(`🧮 לוגי: ${match.logicalScore.toFixed(1)}/10`)
    if (match.gptScore) scores.push(`🤖 GPT: ${match.gptScore}/10`)
    if (match.finalScore) scores.push(`🎯 סופי: ${match.finalScore.toFixed(1)}/10`)
    
    if (scores.length > 0) {
      parts.push(`ציונים: ${scores.join(' ')}`)
    }
  }
  
  // סיכום
  if (match.summary) {
    parts.push(`💭 סיכום: ${match.summary}`)
  }
  
  // נקודות חוזק
  if (match.strengths && match.strengths.length > 0) {
    parts.push(`✅ נקודות חוזק:`)
    match.strengths.forEach(strength => {
      parts.push(`• ${strength}`)
    })
  }
  
  // נקודות לתשומת לב
  if (match.concerns && match.concerns.length > 0) {
    parts.push(`⚠️ נקודות לתשומת לב:`)
    match.concerns.forEach(concern => {
      parts.push(`• ${concern}`)
    })
  }
  
  // אם אין מידע מפורט, השתמש במה שיש
  if (parts.length === 0) {
    return match.summary || match.ai_reasoning || 'התאמה מאושרת'
  }
  
  return parts.join('\n')
}

// מונה שגיאות 406 כדי לכבות את הבדיקה אם יש יותר מדי
let proposal406ErrorCount = 0
const MAX_406_ERRORS = 3

// איפוס מונה שגיאות 406 (לקריאה מחוץ לקובץ)
export const reset406ErrorCount = (): void => {
  proposal406ErrorCount = 0
  console.log('🔄 מונה שגיאות 406 אופס')
}

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
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('❌ שגיאה בקבלת פרטי משתמש:', userError)
      throw new Error('שגיאה באימות המשתמש')
    }
    
    if (!user) {
      console.warn('⚠️ משתמש לא מחובר')
      return null
    }

    const { data: shadchan, error: shadchanError } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (shadchanError) {
      console.error('❌ שגיאה בקבלת פרטי שדכן:', shadchanError)
      if (shadchanError.code === 'PGRST116') {
        throw new Error('לא נמצא פרופיל שדכן. אנא צור פרופיל חדש.')
      }
      throw new Error('שגיאה בטעינת פרטי השדכן')
    }

    if (!shadchan) {
      console.warn('⚠️ לא נמצא פרופיל שדכן')
      return null
    }

    let { data, error } = await supabase
      .from('matching_sessions')
      .select('*')
      .eq('shadchan_id', shadchan.id)
      .eq('is_active', true)
      .single()

    // אם יש שגיאת 406, ננסה לרענן טוקן ולנסות שוב
    if (error && (error.code === 'PGRST301' || error.message?.includes('406') || error.message?.includes('Not Acceptable'))) {
      console.log('🔄 שגיאת 406 בקבלת סשן - מנסה לרענן טוקן ולנסות שוב...')
      
      try {
        const refreshed = await refreshAuthToken()
        if (refreshed) {
          console.log('✅ טוקן רוענן, מנסה שוב...')
          
          // נסיון שני
          const retry = await supabase
            .from('matching_sessions')
            .select('*')
            .eq('shadchan_id', shadchan.id)
            .eq('is_active', true)
            .single()
          
          data = retry.data
          error = retry.error
        }
      } catch (refreshError) {
        console.error('❌ שגיאה ברענון טוקן:', refreshError)
      }
    }

    if (error) {
      if (error.code === 'PGRST116') {
        // לא נמצא סשן פעיל - זה תקין
        console.log('ℹ️ לא נמצא סשן פעיל')
        return null
      }
      
      // טיפול בשגיאת 406 (גם אחרי רענון)
      if (error.code === 'PGRST301' || error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
        console.error('🔐 שגיאת הרשאות 406 בקבלת סשן פעיל (גם אחרי רענון):', error)
        throw new Error('שגיאת הרשאות - אנא רענן את הדף והתחבר מחדש')
      }
      
      console.error('❌ שגיאה בקבלת סשן פעיל:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('❌ שגיאה בקבלת סשן פעיל:', error)
    throw error
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

    // דחיקת הסשן הפעיל הנוכחי להיסטוריה (אם קיים)
    await pushActiveToHistory(shadchan.id)

    // יצירת סשן חדש - הטריגר יטפל בניהול המיקומים
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
    // בדיקה אם יש סשן פעיל
    const { data: activeSessions, error: checkError } = await supabase
      .from('matching_sessions')
      .select('id')
      .eq('shadchan_id', shadchanId)
      .eq('is_active', true)

    if (checkError) throw checkError

    if (!activeSessions || activeSessions.length === 0) {
      console.log('📝 אין סשן פעיל לדחיקה להיסטוריה')
      return
    }

    // דחיקת הסשן הפעיל להיסטוריה
    const { error } = await supabase
      .from('matching_sessions')
      .update({ is_active: false })
      .eq('shadchan_id', shadchanId)
      .eq('is_active', true)

    if (error) throw error
    
    console.log(`📚 סשן פעיל הועבר להיסטוריה (${activeSessions.length} סשנים)`)
  } catch (error) {
    console.error('שגיאה בדחיקת סשן להיסטוריה:', error)
    // לא נזרוק שגיאה כדי לא לחסום יצירת סשן חדש
    console.warn('⚠️ ממשיכים ביצירת סשן חדש למרות השגיאה')
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

// עדכון נתוני סשן ספציפי (לשימוש בהיסטוריה)
export const updateSpecificSession = async (sessionId: string, matches: MatchProposal[]): Promise<void> => {
  try {
    const processedCount = matches.filter(m => m.status !== 'pending').length

    const { error } = await supabase
      .from('matching_sessions')
      .update({
        session_data: matches,
        total_matches: matches.length,
        processed_matches: processedCount
      })
      .eq('id', sessionId)

    if (error) throw error

    console.log(`✅ עודכן סשן ${sessionId}: ${matches.length} התאמות, ${processedCount} מעובדות`)
  } catch (error) {
    console.error('❌ שגיאה בעדכון סשן ספציפי:', error)
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
      .order('created_at', { ascending: false }) // החדשים ביותר ראשונים
      .limit(10)

    if (error) throw error

    console.log(`📚 נטענו ${data?.length || 0} סשנים מההיסטוריה`)
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

// בדיקת האם ההצעה כבר קיימת לפני הוספה
// בדיקה מתקדמת שמחזירה את פרטי ההצעה הקיימת (אם יש)
const checkIfProposalExistsAdvanced = async (shadchanId: string, boyRowId: string, girlRowId: string): Promise<{id: string, status: string, created_at: string} | null> => {
  try {
    // אם יש יותר מדי שגיאות 406, נדלג על הבדיקה
    if (proposal406ErrorCount >= MAX_406_ERRORS) {
      console.warn(`⚠️ מדלג על בדיקת קיימות הצעה בגלל יותר מדי שגיאות 406 (${proposal406ErrorCount}/${MAX_406_ERRORS})`)
      return null
    }
    
    console.log(`🔍 בודק קיימות הצעה (מתקדם): shadchan=${shadchanId}, boy=${boyRowId}, girl=${girlRowId}`)
    
    // בדיקת אימות לפני ביצוע השאילתה
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.warn('⚠️ בעיה באימות בזמן בדיקת הצעה - מדלג על בדיקה:', userError)
      return null // במקום לזרוק שגיאה, פשוט נחזיר null
    }

    let { data, error } = await supabase
      .from('match_proposals')
      .select('id, status, created_at')
      .eq('shadchan_id', shadchanId)
      .eq('boy_row_id', boyRowId)
      .eq('girl_row_id', girlRowId)
      .single()

    // אם יש שגיאת 406, נעדכן את המונה ונדלג על הבדיקה
    if (error && (error.code === 'PGRST301' || error.message?.includes('406') || error.message?.includes('Not Acceptable'))) {
      proposal406ErrorCount++
      console.warn(`⚠️ שגיאת 406 במתקדם (${proposal406ErrorCount}/${MAX_406_ERRORS}) - מדלג על בדיקה`)
      return null
    }

    if (error) {
      if (error.code === 'PGRST116') {
        // לא נמצאה הצעה - זה תקין
        console.log('✅ ההצעה לא קיימת במערכת - ניתן להוסיף')
        return null
      }
      
      // שגיאת 406 או שגיאות אימות אחרות
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth') || error.message?.includes('406')) {
        if (error.message?.includes('406')) {
          proposal406ErrorCount++
          console.warn(`🔐 שגיאת 406 נוספת במתקדם (${proposal406ErrorCount}/${MAX_406_ERRORS})`)
        }
        console.warn('⚠️ מדלג על בדיקה ומתיר הוספה')
        return null // במקום לזרוק שגיאה, פשוט נחזיר null
      }
      
      // שגיאות אחרות - נחזיר null כדי לא לחסום
      console.warn('⚠️ שגיאה בבדיקת הצעה במתקדם:', error)
      return null
    }

    if (data) {
      console.log(`💡 הצעה קיימת נמצאה: ${data.id}, סטטוס: ${data.status}, נוצרה: ${data.created_at}`)
      return data
    }

    console.log('✅ ההצעה לא קיימת - ניתן להוסיף')
    return null
  } catch (error) {
    console.error('❌ שגיאה בבדיקת קיימות הצעה:', error)
    return null
  }
}

const checkIfProposalExists = async (shadchanId: string, boyRowId: string, girlRowId: string): Promise<boolean> => {
  try {
    console.log(`🔍 בודק קיימות הצעה: shadchan=${shadchanId}, boy=${boyRowId}, girl=${girlRowId}`)
    
    // בדיקת אימות לפני ביצוע השאילתה
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.warn('⚠️ בעיה באימות בזמן בדיקת הצעה:', userError)
      throw new Error('שגיאה באימות - אנא התחבר מחדש')
    }

    let { data, error } = await supabase
      .from('match_proposals')
      .select('id, status, created_at')
      .eq('shadchan_id', shadchanId)
      .eq('boy_row_id', boyRowId)
      .eq('girl_row_id', girlRowId)
      .single()

    // אם יש שגיאת 406, ננסה לרענן טוקן ולנסות שוב
    if (error && (error.code === 'PGRST301' || error.message?.includes('406') || error.message?.includes('Not Acceptable'))) {
      console.log('🔄 שגיאת 406 - מנסה לרענן טוקן ולנסות שוב...')
      
      try {
        const refreshed = await refreshAuthToken()
        if (refreshed) {
          console.log('✅ טוקן רוענן, מנסה שוב...')
          
          // נסיון שני
          const retry = await supabase
            .from('match_proposals')
            .select('id, status, created_at')
            .eq('shadchan_id', shadchanId)
            .eq('boy_row_id', boyRowId)
            .eq('girl_row_id', girlRowId)
            .single()
          
          data = retry.data
          error = retry.error
        }
      } catch (refreshError) {
        console.error('❌ שגיאה ברענון טוקן:', refreshError)
      }
    }

    if (error) {
      console.log('📋 תגובת שגיאה מ-Supabase:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      if (error.code === 'PGRST116') {
        // לא נמצאה הצעה - זה תקין
        console.log('✅ ההצעה לא קיימת במערכת - ניתן להוסיף')
        return false
      }
      
      // שגיאת 406 או שגיאות אימות אחרות (גם אחרי רענון)
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth') || error.message?.includes('406')) {
        console.error('🔐 שגיאת הרשאות/אימות (גם אחרי רענון):', error)
        throw new Error('שגיאה באימות או הרשאות - אנא התחבר מחדש')
      }
      
      // שגיאות אחרות - נחזיר false כדי לא לחסום
      console.warn('⚠️ שגיאה לא מוכרת בבדיקת הצעה:', error)
      console.warn('⚠️ ממשיכים בהוספה למרות השגיאה')
      return false
    }

    if (data) {
      console.log(`💡 הצעה כבר קיימת: ${data.id}, סטטוס: ${data.status}, נוצרה: ${data.created_at}`)
      return true
    }

    console.log('✅ ההצעה לא קיימת - ניתן להוסיף')
    return false
  } catch (error) {
    console.error('❌ שגיאה בבדיקת קיימות הצעה:', error)
    
    // אם זה שגיאת אימות, נזרוק אותה הלאה
    if (error instanceof Error && error.message.includes('אימות')) {
      throw error
    }
    
    // במקרה של שגיאה אחרת, נחזיר false כדי לא לחסום את התהליך
    console.warn('⚠️ ממשיכים בהוספה למרות השגיאה')
    return false
  }
}

// העברת התאמה להצעות (עם בדיקת קיימות מראש)
export const moveMatchToProposals = async (match: MatchProposal): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('לא מחובר למערכת')

    const { data: shadchan, error: shadchanError } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (shadchanError) throw new Error('לא נמצא פרופיל שדכן')

    // בדיקת קיימות מראש עם הודעה ברורה
    const boyRowId = match.boy_row_id || match.maleId || 'unknown'
    const girlRowId = match.girl_row_id || match.femaleId || 'unknown'

    console.log('🔍 מזהי שורות:', {
      'match.boy_row_id': match.boy_row_id,
      'match.maleId': match.maleId,
      'boyRowId מחושב': boyRowId,
      'match.girl_row_id': match.girl_row_id,
      'match.femaleId': match.femaleId,
      'girlRowId מחושב': girlRowId,
      'match.id': match.id,
      'match.maleName': match.maleName,
      'match.femaleName': match.femaleName
    })

    try {
      // בדיקה מתקדמת יותר - נבדוק אם יש הצעה קיימת שנוצרה לפני יותר מ-5 שניות
      const existingProposal = await checkIfProposalExistsAdvanced(shadchan.id, boyRowId, girlRowId)
      if (existingProposal) {
        const timeDiff = Date.now() - new Date(existingProposal.created_at).getTime()
        
        // אם ההצעה נוצרה לפני יותר מ-5 שניות, זו הצעה אמיתית קיימת
        if (timeDiff > 5000) {
          const boyDisplayName = match.maleName || 'בחור לא ידוע'
          const girlDisplayName = match.femaleName || 'בחורה לא ידועה'
          
          console.log(`💡 ההצעה כבר קיימת (נוצרה לפני ${Math.round(timeDiff/1000)} שניות): ${boyDisplayName} ו${girlDisplayName}`)
          
          alert(`💡 ההצעה הזו כבר מאושרת!\n\n` +
                `${boyDisplayName} ו${girlDisplayName} כבר מופיעים ברשימת ההצעות הפעילות שלך.\n\n` +
                `ניתן לעבור לטאב "הצעות פעילות" כדי לראות את הסטטוס הנוכחי.`)
          
          console.log('✅ ההצעה כבר קיימת - מדלג על הוספה')
          return
        } else {
          // אם ההצעה נוצרה זה עתה (פחות מ-5 שניות), זה כנראה race condition
          console.log(`⚠️ נמצאה הצעה שנוצרה זה עתה (לפני ${Math.round(timeDiff/1000)} שניות) - מדלג על בדיקה`)
        }
      }
    } catch (error) {
      // אם זה שגיאת אימות או 406, נטפל בזה בנפרד
      if (error instanceof Error && error.message.includes('אימות')) {
        console.error('🔐 שגיאת אימות בבדיקת קיימות:', error)
        alert('⚠️ יש בעיה באימות המערכת. אנא רענן את הדף והתחבר מחדש.')
        throw new Error('שגיאת אימות - נדרש רענון')
      }
      
      // שגיאות אחרות - נמשיך בתהליך
      console.warn('⚠️ לא הצלחנו לבדוק קיימות הצעה, ממשיכים בהוספה:', error)
    }

    // המשך הפונקציה כרגיל...
    const score = Math.round(match.finalScore * 10) / 100 // המרה מ-0-10 ל-0.00-1.00

    // קבלת הסשן הפעיל (לחיבור ההצעה)
    const activeSession = await getActiveSession()

    // יצירת ai_reasoning מפורט עם כל המידע
    const detailedReasoning = createDetailedReasoning(match)
    
    // נתונים בסיסיים שקיימים במסד הנתונים
    const basicProposalData = {
      shadchan_id: shadchan.id,
      boy_row_id: boyRowId,
      girl_row_id: girlRowId,
      match_score: score,
      ai_reasoning: detailedReasoning,
      status: 'approved',
      original_session_id: activeSession?.id || null
    }

    console.log('מנסה להוסיף הצעה עם הנתונים הבסיסיים:', basicProposalData)
    console.log('⏰ זמן נוכחי:', new Date().toISOString())

    const { error } = await supabase
      .from('match_proposals')
      .insert(basicProposalData)

    if (error) {
      console.error('שגיאה בהוספת הצעה:', error)
      console.error('פרטי השגיאה המלאים:', JSON.stringify(error, null, 2))
      
      // אם זה עדיין שגיאת 409 אחרי הבדיקה, זה יכול להיות race condition
      if (error.code === '23505') { // UNIQUE constraint violation
        alert(`⚠️ נראה שההצעה נוספה זה עתה על ידי פעולה אחרת.\n\nמומלץ לרענן את הדף ולבדוק בטאב "הצעות פעילות".`)
        throw new Error('ההצעה כבר קיימת (race condition)')
      }
      
      // שגיאות נוספות
      if (error.code === '23502') { // NOT NULL constraint violation
        throw new Error('חסרים נתונים חובה בהצעה')
      }
      
      if (error.code === '23514') { // CHECK constraint violation
        throw new Error('סטטוס ההצעה לא תקין')
      }
      
      throw error
    }

    console.log('✅ הצעה הועברה בהצלחה להצעות פעילות')

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

// פונקציה לבדיקת חיבור למערכת
export const checkAuthConnection = async (): Promise<{ isConnected: boolean, shadchanId?: string, error?: string }> => {
  try {
    let { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // אם יש שגיאה, ננסה לרענן את הטוקן
    if (userError) {
      console.warn('⚠️ שגיאה באימות, מנסה לרענן טוקן...')
      const refreshed = await refreshAuthToken()
      
      if (refreshed) {
        // ננסה שוב אחרי הרענון
        const { data: { user: refreshedUser }, error: refreshError } = await supabase.auth.getUser()
        if (refreshError) {
          console.error('❌ שגיאה באימות גם אחרי רענון:', refreshError)
          return { 
            isConnected: false, 
            error: 'שגיאה באימות המשתמש. אנא התחבר מחדש.' 
          }
        }
        user = refreshedUser
      } else {
        console.error('❌ שגיאה באימות:', userError)
        return { 
          isConnected: false, 
          error: 'שגיאה באימות המשתמש. אנא התחבר מחדש.' 
        }
      }
    }
    
    if (!user) {
      console.warn('⚠️ משתמש לא מחובר')
      return { 
        isConnected: false, 
        error: 'משתמש לא מחובר. אנא התחבר למערכת.' 
      }
    }

    const { data: shadchan, error: shadchanError } = await supabase
      .from('shadchanim')
      .select('id, name')
      .eq('auth_user_id', user.id)
      .single()

    if (shadchanError) {
      console.error('❌ שגיאה בטעינת פרטי שדכן:', shadchanError)
      if (shadchanError.code === 'PGRST116') {
        return { 
          isConnected: false, 
          error: 'לא נמצא פרופיל שדכן. אנא צור פרופיל חדש.' 
        }
      }
      return { 
        isConnected: false, 
        error: 'שגיאה בטעינת פרטי השדכן' 
      }
    }

    if (!shadchan) {
      return { 
        isConnected: false, 
        error: 'לא נמצא פרופיל שדכן' 
      }
    }

    console.log(`✅ מחובר בהצלחה כ-${shadchan.name}`)
    return { 
      isConnected: true, 
      shadchanId: shadchan.id 
    }

  } catch (error) {
    console.error('❌ שגיאה בבדיקת חיבור:', error)
    return { 
      isConnected: false, 
      error: 'שגיאה כללית בחיבור למערכת' 
    }
  }
} 