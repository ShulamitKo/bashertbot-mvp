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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('משתמש לא מחובר')
    }

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id, google_sheet_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) {
      throw new Error('לא נמצא פרופיל שדכן')
    }

    // טעינת הצעות פעילות - כולל את כל הסטטוסים הרלוונטיים
    const { data: proposals, error } = await supabase
      .from('match_proposals')
      .select('*, notes_history')
      .eq('shadchan_id', shadchan.id)
              .in('status', ['ready_for_processing', 'ready_for_contact', 'contacting', 'awaiting_response', 'schedule_meeting', 'meeting_scheduled', 'meeting_completed', 'completed', 'rejected_by_candidate', 'closed', 'in_meeting_process']) // עדכון רשימת הסטטוסים הפעילים (לא כולל pending)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
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
        }

        // אם נטענו נתונים חדשים מהגיליון, נעדכן את boy_data ו-girl_data עם הנתונים החדשים
        const updatedBoyData = boyDetails || proposal.boy_data
        const updatedGirlData = girlDetails || proposal.girl_data



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

    return enhancedProposals

  } catch (error) {
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
    if (!user) {
      throw new Error('משתמש לא מחובר')
    }

    // קבלת פרטי השדכן והנתונים הנוכחיים של ההצעה בשאילתה אחת
    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) {
      throw new Error('לא נמצא פרופיל שדכן')
    }

    // קבלת הנתונים הנוכחיים של ההצעה
    const { data: currentProposal } = await supabase
      .from('match_proposals')
      .select('status, notes_history, shadchan_id')
      .eq('id', proposalId)
      .single()

    if (!currentProposal) {
      throw new Error('הצעה לא נמצאה')
    }

    // בדיקת הרשאה
    if (currentProposal.shadchan_id !== shadchan.id) {
      throw new Error('אין הרשאה לעדכן הצעה זו')
    }

    // הכנת היסטוריית הערות מעודכנת
    let updatedNotesHistory = currentProposal.notes_history || []
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

    // עדכון הסטטוס בטבלה הראשית - פעולה אחת
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
      throw updateError
    }

    return true

  } catch (error) {
    console.error('❌ [updateProposalStatus] שגיאה בעדכון סטטוס הצעה:', error)
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
  rejectionReason?: string,
  boyName?: string,
  girlName?: string
): Promise<boolean> => {
  try {
    // בדיקה שההצעה שייכת לשדכן וקבלת הנתונים הנוכחיים
    const { data: proposal } = await supabase
      .from('match_proposals')
      .select('shadchan_id, boy_response, girl_response, boy_row_id, girl_row_id, notes_history')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      throw new Error('הצעה לא נמצאה')
    }

    if (proposal.shadchan_id !== shadchanId) {
      throw new Error('אין הרשאה לעדכן הצעה זו')
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
    } else if (response === 'interested') {
      // צד אחד מעוניין - ממתינים לתגובת הצד השני
      updateData.status = 'awaiting_response'
    } else if (response === 'needs_time') {
      // צריך זמן - נשאר בהמתנה
      updateData.status = 'awaiting_response'
    }

    // הוספת הערה אוטומטית על השינוי - עם שמות שהועברו או מזהים כגיבוי
    let autoNote = ''
    
    // שימוש בשמות שהועברו כפרמטרים, או מזהים כגיבוי
    const finalBoyName = boyName || `בן #${proposal.boy_row_id}`
    const finalGirlName = girlName || `בת #${proposal.girl_row_id}`
    
    if (side === 'boy') {
      const responseText = response === 'interested' ? 'מעוניין' : 
                          response === 'not_interested' ? 'לא מעוניין' : 'צריך זמן'
      
      if (response === 'not_interested') {
        autoNote = `${finalBoyName} ענה: ${responseText} - ההצעה נדחתה${rejectionReason ? ` (סיבה: ${rejectionReason})` : ''}`
      } else if (response === 'interested' && otherResponse === 'interested') {
        autoNote = `${finalBoyName} ענה: ${responseText} - שני הצדדים מעוניינים! יש לקבוע פגישה`
      } else if (response === 'interested') {
        autoNote = `${finalBoyName} ענה: ${responseText} - ממתינים לתגובת ${finalGirlName}`
      } else if (response === 'needs_time') {
        autoNote = `${finalBoyName} ענה: ${responseText} - ממתינים להחלטה`
      }
    } else {
      const responseText = response === 'interested' ? 'מעוניינת' : 
                          response === 'not_interested' ? 'לא מעוניינת' : 'צריכה זמן'
      
      if (response === 'not_interested') {
        autoNote = `${finalGirlName} ענתה: ${responseText} - ההצעה נדחתה${rejectionReason ? ` (סיבה: ${rejectionReason})` : ''}`
      } else if (response === 'interested' && otherResponse === 'interested') {
        autoNote = `${finalGirlName} ענתה: ${responseText} - שני הצדדים מעוניינים! יש לקבוע פגישה`
      } else if (response === 'interested') {
        autoNote = `${finalGirlName} ענתה: ${responseText} - ממתינים לתגובת ${finalBoyName}`
      } else if (response === 'needs_time') {
        autoNote = `${finalGirlName} ענתה: ${responseText} - ממתינים להחלטה`
      }
    }

    // הוספת ההערה האוטומטית להיסטוריה
    let updatedNotesHistory = proposal.notes_history || []
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

    // עדכון במסד הנתונים - פעולה אחת
    const { error: updateError } = await supabase
      .from('match_proposals')
      .update(updateData)
      .eq('id', proposalId)

    if (updateError) {
      throw updateError
    }

    // עדכון גם בטבלת פעולות הקשר - נעשה זאת באופן אסינכרוני
    supabase
      .from('contact_actions')
      .update({
        response: response,
        response_date: new Date().toISOString()
      })
      .eq('proposal_id', proposalId)
      .eq('candidate_side', side)
      .is('response_date', null)
      .then(({ error }) => {
        if (error) {
          console.warn('⚠️ [updateCandidateResponse] שגיאה בעדכון טבלת פעולות קשר:', error)
        }
      })

    return true

  } catch (error) {
    console.error('❌ [updateCandidateResponse] שגיאה בעדכון תגובת מועמד:', error)
    return false
  }
} 