import { supabase } from './supabase'
import { loadCandidatesFromSheet, DetailedCandidate } from './google-sheets'
import { EnhancedProposal, ProposalNote } from '../types'

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
    if (!user) throw new Error('משתמש לא מחובר')

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id, google_sheet_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) throw new Error('לא נמצא פרופיל שדכן')

    // טעינת הצעות פעילות
    const { data: proposals, error } = await supabase
      .from('match_proposals')
      .select('*, notes_history')
      .eq('shadchan_id', shadchan.id)
      .in('status', ['approved', 'in_progress', 'completed'])
      .order('updated_at', { ascending: false })

    if (error) throw error

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

        return {
          ...proposal,
          boyDetails,
          girlDetails,
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
  notes?: string,
  reason?: string
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
          created_at: new Date().toISOString()
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

// פונקציות נוספות יתווספו לפי הצורך בעתיד 