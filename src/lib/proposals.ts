import { supabase } from './supabase'
import { loadCandidatesFromSheet, DetailedCandidate } from './google-sheets'
import { EnhancedProposal } from '../types'

// ============ פונקציות עזר לניהול הצעות ============

// פונקציה לחילוץ פרטי נימוק מהטקסט
const extractReasoningDetails = (aiReasoning: string) => {
  // חילוץ ציונים - תמיכה בפורמטים שונים
  const logicalMatch = aiReasoning.match(/(?:🧮\s*לוגי[:\s]*|לוגי[:\s]*)(\d+(?:\.\d+)?)(?:\/10)?/i)
  const gptMatch = aiReasoning.match(/(?:🤖\s*GPT[:\s]*|GPT[:\s]*)(\d+)(?:\/10)?/i)
  const finalMatch = aiReasoning.match(/(?:🎯\s*סופי[:\s]*|סופי[:\s]*|ציון כללי[:\s]*)(\d+(?:\.\d+)?)(?:\/10)?/i)
  
  // חילוץ סיכום - תמיכה בפורמטים שונים
  let summaryMatch = aiReasoning.match(/💭\s*סיכום[:\s]*(.*?)(?=\n(?:✅|⚠️)|$)/is)
  if (!summaryMatch) {
    summaryMatch = aiReasoning.match(/סיכום ההתאמה[:\s]*(.*?)(?=\n(?:✅|⚠️)|$)/is)
  }
  if (!summaryMatch) {
    // אם אין כותרת ספציפית, קח את הטקסט הראשון
    const lines = aiReasoning.split('\n').filter(line => 
      !line.match(/^(?:ציונים?|🧮|🤖|🎯|✅|⚠️|•)/) && line.trim()
    )
    if (lines.length > 0) {
      summaryMatch = ['', lines[0]] as RegExpMatchArray
    }
  }
  
  // חילוץ נקודות חוזק
  let strengthsMatch = aiReasoning.match(/✅\s*נקודות חוזק[:\s]*(.*?)(?=\n⚠️|$)/is)
  if (!strengthsMatch) {
    strengthsMatch = aiReasoning.match(/נקודות חוזק[:\s]*(.*?)(?=\n(?:⚠️|נקודות לתשומת לב)|$)/is)
  }
  const strengths = strengthsMatch ? 
    strengthsMatch[1].split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s) : []
  
  // חילוץ נקודות לתשומת לב
  let concernsMatch = aiReasoning.match(/⚠️\s*נקודות לתשומת לב[:\s]*(.*?)$/is)
  if (!concernsMatch) {
    concernsMatch = aiReasoning.match(/נקודות לתשומת לב[:\s]*(.*?)$/is)
  }
  const concerns = concernsMatch ? 
    concernsMatch[1].split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s) : []
  
  return {
    logicalScore: logicalMatch ? parseFloat(logicalMatch[1]) : null,
    gptScore: gptMatch ? parseInt(gptMatch[1]) : null,
    finalScore: finalMatch ? parseFloat(finalMatch[1]) : null,
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    strengths,
    concerns
  }
}

// טעינת הצעות פעילות עם פרטים מלאים
export const loadEnhancedProposals = async (accessToken: string): Promise<EnhancedProposal[]> => {
  try {
    console.log('🔄 [loadEnhancedProposals] מתחיל טעינת הצעות מורחבות...')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ [loadEnhancedProposals] משתמש לא מחובר')
      throw new Error('משתמש לא מחובר')
    }
    console.log('✅ [loadEnhancedProposals] משתמש מחובר:', user.id)

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id, google_sheet_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) {
      console.error('❌ [loadEnhancedProposals] לא נמצא פרופיל שדכן עבור המשתמש:', user.id)
      throw new Error('לא נמצא פרופיל שדכן')
    }
    console.log('✅ [loadEnhancedProposals] נמצא פרופיל שדכן:', shadchan.id)

    // טעינת הצעות פעילות - כולל את כל הסטטוסים הרלוונטיים
    const { data: proposals, error } = await supabase
      .from('match_proposals')
      .select('*, notes_history')
      .eq('shadchan_id', shadchan.id)
              .in('status', ['ready_for_processing', 'ready_for_contact', 'contacting', 'awaiting_response', 'schedule_meeting', 'meeting_scheduled', 'meeting_completed', 'completed', 'rejected_by_candidate', 'closed', 'in_meeting_process']) // עדכון רשימת הסטטוסים הפעילים (לא כולל pending)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('❌ [loadEnhancedProposals] שגיאה בטעינת הצעות:', error)
      throw error
    }
    console.log('✅ [loadEnhancedProposals] נטענו הצעות מהמסד:', proposals?.length || 0)
    
    // דיבוג סטטוסים
    if (proposals && proposals.length > 0) {
      const statusCounts = proposals.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log('📊 [loadEnhancedProposals] סטטוסים במסד:', statusCounts)
      
      // דיבוג מפורט של הצעות
      proposals.forEach(p => {
        console.log(`🔍 [loadEnhancedProposals] הצעה ${p.id.slice(-8)}: סטטוס=${p.status}, נוצרה=${p.created_at}, עודכנה=${p.updated_at}`)
      })
    }

    // טעינת מועמדים מהגיליון
    let candidatesData: { males: DetailedCandidate[], females: DetailedCandidate[] } = { males: [], females: [] }
    
    if (shadchan.google_sheet_id && accessToken) {
      try {
        candidatesData = await loadCandidatesFromSheet(accessToken, shadchan.google_sheet_id)
      } catch (error) {
        console.warn('לא ניתן לטעון מועמדים מהגיליון:', error)
      }
    }

    // שילוב נתוני הצעות עם פרטי מועמדים
    const enhancedProposals: EnhancedProposal[] = await Promise.all(
      (proposals || []).map(async (proposal) => {
        // חיפוש פרטי מועמדים
        const boyDetails = candidatesData.males.find(m => m.id === proposal.boy_row_id)
        const girlDetails = candidatesData.females.find(f => f.id === proposal.girl_row_id)

        // אין צורך בהיסטוריית קשרים כרגע

        // חישוב נתונים סטטיסטיים
        const daysInProcess = Math.floor(
          (new Date().getTime() - new Date(proposal.created_at || '').getTime()) / (1000 * 60 * 60 * 24)
        )

        const lastActivity = proposal.updated_at

        // חילוץ נתונים מפורטים מהטקסט הקיים (אם קיים)
        let strengths: string[] = []
        let concerns: string[] = []
        let logicalScore: number | undefined
        let gptScore: number | undefined
        let finalScore: number | undefined
        
        // אם יש שדות חדשים במסד הנתונים - נשתמש בהם
        if (proposal.strengths) {
          try {
            strengths = JSON.parse(proposal.strengths)
          } catch (e) {
            console.warn('שגיאה בפירוק נקודות חוזק:', e)
          }
        }
        
        if (proposal.concerns) {
          try {
            concerns = JSON.parse(proposal.concerns)
          } catch (e) {
            console.warn('שגיאה בפירוק נקודות חששות:', e)
          }
        }
        
        // אם יש ציונים מפורטים - נשתמש בהם
        logicalScore = proposal.logical_score
        gptScore = proposal.gpt_score
        finalScore = proposal.final_score
        
        // אם אין נתונים מפורטים, ננסה לחלץ מהטקסט
        if (strengths.length === 0 || concerns.length === 0 || !logicalScore || !gptScore || !finalScore) {
          const reasoningDetails = extractReasoningDetails(proposal.ai_reasoning || '')
          
          if (strengths.length === 0 && reasoningDetails.strengths.length > 0) {
            strengths = reasoningDetails.strengths
          }
          
          if (concerns.length === 0 && reasoningDetails.concerns.length > 0) {
            concerns = reasoningDetails.concerns
          }
          
          if (!logicalScore && reasoningDetails.logicalScore) {
            logicalScore = reasoningDetails.logicalScore
          }
          
          if (!gptScore && reasoningDetails.gptScore) {
            gptScore = reasoningDetails.gptScore
          }
          
          if (!finalScore && reasoningDetails.finalScore) {
            finalScore = reasoningDetails.finalScore
          }
          
          // אם אין summary נפרד, ננסה לחלץ מה-ai_reasoning
          if (!proposal.summary && reasoningDetails.summary) {
            (proposal as any).summary = reasoningDetails.summary
          }
        }

        // טיפול בהיסטוריית הערות - אם אין עדיין, ניצור מההערה הנוכחית
        let notesHistory = proposal.notes_history || []
        if (notesHistory.length === 0 && proposal.notes) {
          notesHistory = [{
            content: proposal.notes,
            created_at: proposal.updated_at || proposal.created_at || new Date().toISOString()
          }]
          console.log('📝 יצרנו היסטוריית הערות מההערה הקיימת עבור הצעה:', proposal.id)
        }
        console.log('📊 הצעה:', proposal.id, 'הערות:', { 
          notes: proposal.notes, 
          notes_history: proposal.notes_history, 
          final_notesHistory: notesHistory 
        })

        // אם נטענו נתונים חדשים מהגיליון, נעדכן את boy_data ו-girl_data עם הנתונים החדשים
        const updatedBoyData = boyDetails || proposal.boy_data
        const updatedGirlData = girlDetails || proposal.girl_data

        // דיבוג השוואה בין נתונים ישנים לחדשים
        if (boyDetails && proposal.boy_data) {
          console.log(`🔄 השוואת נתוני בן עבור הצעה ${proposal.id}:`, {
            'נתונים ישנים boy_data keys': Object.keys(proposal.boy_data),
            'נתונים חדשים boyDetails keys': Object.keys(boyDetails),
            'email ישן': proposal.boy_data.email || 'ריק',
            'email חדש': boyDetails.email || 'ריק',
            'previouslyProposed ישן': proposal.boy_data.previouslyProposed || 'ריק',
            'previouslyProposed חדש': boyDetails.previouslyProposed || 'ריק'
          })
        }

        if (girlDetails && proposal.girl_data) {
          console.log(`🔄 השוואת נתוני בת עבור הצעה ${proposal.id}:`, {
            'נתונים ישנים girl_data keys': Object.keys(proposal.girl_data),
            'נתונים חדשים girlDetails keys': Object.keys(girlDetails),
            'email ישן': proposal.girl_data.email || 'ריק',
            'email חדש': girlDetails.email || 'ריק',
            'previouslyProposed ישן': proposal.girl_data.previouslyProposed || 'ריק',
            'previouslyProposed חדש': girlDetails.previouslyProposed || 'ריק'
          })
        }

        return {
          ...proposal,
          boyDetails: updatedBoyData,
          girlDetails: updatedGirlData,
          // עדכון גם boy_data ו-girl_data עם הנתונים החדשים
          boy_data: updatedBoyData,
          girl_data: updatedGirlData,
          notesHistory, // היסטוריית הערות
          daysInProcess,
          lastActivity,
          // ציונים מפורטים
          logicalScore,
          gptScore,
          finalScore,
          // נתונים מחולצים
          strengths,
          concerns
        } as EnhancedProposal
      })
    )

    console.log('✅ [loadEnhancedProposals] הושלמה עיבוד של', enhancedProposals.length, 'הצעות מורחבות')
    return enhancedProposals

  } catch (error) {
    console.error('❌ [loadEnhancedProposals] שגיאה כללית:', error)
    console.error('שגיאה בטעינת הצעות מורחבות:', error)
    throw error
  }
}

// הפונקציות הקשורות לקשרים הוסרו - אין צורך בהן כרגע

// עדכון סטטוס הצעה
export const updateProposalStatus = async (
  proposalId: string, 
  newStatus: string, 
  notes?: string
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    // קבלת פרטי השדכן
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    // קבלת הסטטוס הנוכחי
    const { data: currentProposal } = await supabase
      .from('match_proposals')
      .select('status')
      .eq('id', proposalId)
      .single()

    if (!currentProposal) throw new Error('הצעה לא נמצאה')

    console.log(`📝 מעדכן הצעה ${proposalId}: ${currentProposal.status} → ${newStatus}`)

    // קבלת ההיסטוריה הנוכחית של ההערות
    const { data: currentData } = await supabase
      .from('match_proposals')
      .select('notes_history')
      .eq('id', proposalId)
      .single()

    // הכנת היסטוריית הערות מעודכנת
    let updatedNotesHistory = currentData?.notes_history || []
    if (notes && notes.trim()) {
      updatedNotesHistory = [
        ...updatedNotesHistory,
        {
          content: notes.trim(),
          created_at: new Date().toISOString(),
          status: newStatus // שמירת הסטטוס יחד עם ההערה
        }
      ]
    }

    // עדכון הסטטוס בטבלה הראשית
    const { error: updateError } = await supabase
      .from('match_proposals')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        notes: notes || null, // ההערה האחרונה (לתצוגה מהירה)
        notes_history: updatedNotesHistory // כל ההיסטוריה
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('❌ שגיאה בעדכון הצעה:', updateError)
      throw updateError
    }

    console.log('✅ הצעה עודכנה בהצלחה במסד הנתונים')

    console.log(`✅ סטטוס הצעה ${proposalId} עודכן ל-${newStatus}`)
    return true

  } catch (error) {
    console.error('❌ שגיאה בעדכון סטטוס הצעה:', error)
    return false
  }
}

// עריכת הערה
export const editProposalNote = async (
  proposalId: string,
  noteIndex: number,
  newContent: string
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    // קבלת פרטי השדכן
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    // קבלת ההיסטוריה הנוכחית
    const { data: currentData } = await supabase
      .from('match_proposals')
      .select('notes_history')
      .eq('id', proposalId)
      .single()

    if (!currentData) throw new Error('הצעה לא נמצאה')

    let updatedNotesHistory = currentData.notes_history || []
    
    // בדיקה שהאינדקס תקין
    if (noteIndex < 0 || noteIndex >= updatedNotesHistory.length) {
      throw new Error('אינדקס הערה לא תקין')
    }

    // עדכון ההערה
    updatedNotesHistory[noteIndex] = {
      ...updatedNotesHistory[noteIndex],
      content: newContent.trim(),
      edited_at: new Date().toISOString()
    }

    // עדכון העמודה notes להערה האחרונה (הכי חדשה)
    const latestNote = updatedNotesHistory[updatedNotesHistory.length - 1]?.content || null

    // שמירה במסד הנתונים
    const { error: updateError } = await supabase
      .from('match_proposals')
      .update({
        notes_history: updatedNotesHistory,
        notes: latestNote, // עדכון ההערה האחרונה
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('❌ שגיאה בעדכון הערה:', updateError)
      throw updateError
    }

    console.log(`✅ הערה ${noteIndex} עודכנה בהצעה ${proposalId}`)
    return true

  } catch (error) {
    console.error('❌ שגיאה בעריכת הערה:', error)
    return false
  }
}

// מחיקת הערה
export const deleteProposalNote = async (
  proposalId: string,
  noteIndex: number
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    // קבלת פרטי השדכן
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    // קבלת ההיסטוריה הנוכחית
    const { data: currentData } = await supabase
      .from('match_proposals')
      .select('notes_history')
      .eq('id', proposalId)
      .single()

    if (!currentData) throw new Error('הצעה לא נמצאה')

    let updatedNotesHistory = currentData.notes_history || []
    
    // בדיקה שהאינדקס תקין
    if (noteIndex < 0 || noteIndex >= updatedNotesHistory.length) {
      throw new Error('אינדקס הערה לא תקין')
    }

    // מחיקת ההערה
    updatedNotesHistory.splice(noteIndex, 1)

    // עדכון העמודה notes להערה האחרונה (הכי חדשה) או null אם אין הערות
    const latestNote = updatedNotesHistory.length > 0 
      ? updatedNotesHistory[updatedNotesHistory.length - 1]?.content || null 
      : null

    // שמירה במסד הנתונים
    const { error: updateError } = await supabase
      .from('match_proposals')
      .update({
        notes_history: updatedNotesHistory,
        notes: latestNote, // עדכון ההערה האחרונה או null
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('❌ שגיאה במחיקת הערה:', updateError)
      throw updateError
    }

    console.log(`✅ הערה ${noteIndex} נמחקה מהצעה ${proposalId}`)
    return true

  } catch (error) {
    console.error('❌ שגיאה במחיקת הערה:', error)
    return false
  }
}

// ============ פונקציות יצירת קשר ומעקב תגובות ============

// יצירת קשר עם מועמד
export const contactCandidate = async (
  proposalId: string,
  side: 'boy' | 'girl',
  method: 'email' | 'whatsapp' | 'phone',
  contactDetails: string
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('משתמש לא מחובר')

    // בדיקה שההצעה שייכת לשדכן
    const { data: proposal } = await supabase
      .from('match_proposals')
      .select('shadchan_id')
      .eq('id', proposalId)
      .single()

    if (!proposal) throw new Error('הצעה לא נמצאה')

    // קבלת פרטי השדכן
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan || proposal.shadchan_id !== shadchan.id) {
      throw new Error('אין הרשאה לעדכן הצעה זו')
    }

    // עדכון סטטוס יצירת קשר בהצעה
    const updateData: any = {
      [`${side}_contacted`]: true,
      [`${side}_response`]: 'pending',
      contact_method: method,
      last_contact_date: new Date().toISOString(),
      contact_attempts: 1, // נתחיל מ-1
      updated_at: new Date().toISOString()
    }

    // אם זה הקשר הראשון, נשנה את הסטטוס ל-contacting
    const { data: currentStatus } = await supabase
      .from('match_proposals')
      .select('status, boy_contacted, girl_contacted')
      .eq('id', proposalId)
      .single()

    if (currentStatus && (currentStatus.status === 'ready_for_processing' || currentStatus.status === 'ready_for_contact')) {
      updateData.status = 'contacting'
    }

    const { error: updateError } = await supabase
      .from('match_proposals')
      .update(updateData)
      .eq('id', proposalId)

    if (updateError) throw updateError

    // הוספת רשומה לטבלת פעולות הקשר
    const { error: contactError } = await supabase
      .from('contact_actions')
      .insert({
        proposal_id: proposalId,
        candidate_side: side,
        contact_method: method,
        contact_details: contactDetails,
        response: 'pending'
      })

    if (contactError) throw contactError

    console.log(`✅ יצירת קשר נרשמה: ${side} via ${method}`)
    return true

  } catch (error) {
    console.error('❌ שגיאה ביצירת קשר:', error)
    return false
  }
}

// עדכון תגובת מועמד
export const updateCandidateResponse = async (
  proposalId: string,
  side: 'boy' | 'girl',
  response: 'interested' | 'not_interested' | 'needs_time',
  shadchanId: string,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    // אין צורך ב-getUser() או ב-select shadchanim, כי shadchanId כבר הועבר
    // ובדיקת הרשאה תתבצע באמצעות השוואת shadchanId עם shadchan_id של ההצעה

    // בדיקה שההצעה שייכת לשדכן
    const { data: proposal } = await supabase
      .from('match_proposals')
      .select('shadchan_id, boy_response, girl_response, boy_row_id, girl_row_id')
      .eq('id', proposalId)
      .single()

    if (!proposal) throw new Error('הצעה לא נמצאה')

    if (proposal.shadchan_id !== shadchanId) {
      throw new Error('אין הרשאה לעדכן הצעה זו')
    }

    // טעינת השמות מהגיליון
    let boyName = 'הבן'
    let girlName = 'הבת'
    
    try {
      // קבלת פרטי השדכן לגישה לגיליון
      const { data: shadchan } = await supabase
        .from('shadchanim')
        .select('google_sheet_id, sheet_boys_tab_name, sheet_girls_tab_name')
        .eq('id', shadchanId)
        .single()

      if (shadchan?.google_sheet_id) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.provider_token) {
          const { loadCandidatesFromSheet } = await import('./google-sheets')
          const candidates = await loadCandidatesFromSheet(
            session.provider_token,
            shadchan.google_sheet_id
          )
          
          // חיפוש השמות לפי row_id
          const boyCandidate = candidates.males.find(m => m.id === proposal.boy_row_id)
          const girlCandidate = candidates.females.find(f => f.id === proposal.girl_row_id)
          
          if (boyCandidate) boyName = boyCandidate.name
          if (girlCandidate) girlName = girlCandidate.name
        }
      }
    } catch (error) {
      console.warn('לא הצלחנו לטעון שמות מהגיליון, נשתמש בטקסט כללי:', error)
    }

    // עדכון התגובה
    const updateData: any = {
      [`${side}_response`]: response,
      updated_at: new Date().toISOString()
    }

    // בדיקה אם צריך לעדכן סטטוס כללי
    const otherSide = side === 'boy' ? 'girl' : 'boy'
    const otherResponse = proposal[`${otherSide}_response` as keyof typeof proposal]

    // עדכון סטטוס לפי התגובות
    if (response === 'not_interested') {
      updateData.status = 'rejected_by_candidate'
      updateData.rejection_side = side
      updateData.rejection_reason = rejectionReason || 'מועמד לא מעוניין'
    } else if (response === 'interested' && otherResponse === 'interested') {
      // שני הצדדים מעוניינים - מעבר לשלב קביעת פגישה
      updateData.status = 'schedule_meeting'
      console.log('🎉 שני הצדדים מעוניינים - מעבר לשלב קביעת פגישה!')
    } else if (response === 'interested') {
      // צד אחד מעוניין - ממתינים לתגובת הצד השני
      updateData.status = 'awaiting_response'
      console.log(`✅ ${side} מעוניין/ת - ממתינים לתגובת הצד השני`)
    } else if (response === 'needs_time') {
      // צריך זמן - נשאר בהמתנה
      updateData.status = 'awaiting_response'
      console.log(`⏰ ${side} צריך/ה זמן לחשוב`)
    }

    // הוספת הערה אוטומטית על השינוי
    let autoNote = ''
    
    if (side === 'boy') {
      // לשון זכר
      const responseText = response === 'interested' ? 'מעוניין' : 
                          response === 'not_interested' ? 'לא מעוניין' : 'צריך זמן'
      
      if (response === 'not_interested') {
        autoNote = `${boyName} ענה: ${responseText} - ההצעה נדחתה${rejectionReason ? ` (סיבה: ${rejectionReason})` : ''}`
      } else if (response === 'interested' && otherResponse === 'interested') {
        autoNote = `${boyName} ענה: ${responseText} - שני הצדדים מעוניינים! יש לקבוע פגישה`
      } else if (response === 'interested') {
        autoNote = `${boyName} ענה: ${responseText} - ממתינים לתגובת ${girlName}`
      } else if (response === 'needs_time') {
        autoNote = `${boyName} ענה: ${responseText} - ממתינים להחלטה`
      }
    } else {
      // לשון נקבה
      const responseText = response === 'interested' ? 'מעוניינת' : 
                          response === 'not_interested' ? 'לא מעוניינת' : 'צריכה זמן'
      
      if (response === 'not_interested') {
        autoNote = `${girlName} ענתה: ${responseText} - ההצעה נדחתה${rejectionReason ? ` (סיבה: ${rejectionReason})` : ''}`
      } else if (response === 'interested' && otherResponse === 'interested') {
        autoNote = `${girlName} ענתה: ${responseText} - שני הצדדים מעוניינים! יש לקבוע פגישה`
      } else if (response === 'interested') {
        autoNote = `${girlName} ענתה: ${responseText} - ממתינים לתגובת ${boyName}`
      } else if (response === 'needs_time') {
        autoNote = `${girlName} ענתה: ${responseText} - ממתינים להחלטה`
      }
    }

    // קבלת ההיסטוריה הנוכחית של ההערות
    const { data: currentData } = await supabase
      .from('match_proposals')
      .select('notes_history')
      .eq('id', proposalId)
      .single()

    // הוספת ההערה האוטומטית להיסטוריה
    let updatedNotesHistory = currentData?.notes_history || []
    if (autoNote) {
      updatedNotesHistory = [
        ...updatedNotesHistory,
        {
          content: autoNote,
          created_at: new Date().toISOString(),
          status: updateData.status
        }
      ]
      updateData.notes_history = updatedNotesHistory
      updateData.notes = autoNote // עדכון ההערה האחרונה
    }

    const { error: updateError } = await supabase
      .from('match_proposals')
      .update(updateData)
      .eq('id', proposalId)

    if (updateError) throw updateError

    // עדכון גם בטבלת פעולות הקשר
    const { error: contactUpdateError } = await supabase
      .from('contact_actions')
      .update({
        response: response,
        response_date: new Date().toISOString()
      })
      .eq('proposal_id', proposalId)
      .eq('candidate_side', side)
      .is('response_date', null) // עדכון רק של הפעולה האחרונה שעדיין לא נענתה

    if (contactUpdateError) {
      console.warn('שגיאה בעדכון טבלת פעולות קשר:', contactUpdateError)
    }

    console.log(`✅ תגובת ${side} עודכנה ל-${response}`)
    return true

  } catch (error) {
    console.error('❌ שגיאה בעדכון תגובת מועמד:', error)
    return false
  }
} 