import OpenAI from 'openai'
import { MatchProposal, AdvancedMatchingSettings } from '../types'
import { 
  DetailedCandidate,
  applyHardFilters, 
  calculateLogicalScore,  
} from './google-sheets'
import { supabase } from './supabase'
import { buildSystemPrompt, createMatchPrompt } from './prompt-generator'

const openai = new OpenAI({
  apiKey: (import.meta as any).env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

// טיפוס לתשובת GPT
interface GPTMatchResponse {
  score: number
  summary: string
  strengths?: string[]
  concerns?: string[]
}

// פונקציה כללית להפעלת GPT
export const generateCompletion = async (
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<string> => {
  const { model = 'gpt-4o-mini', temperature = 0.7, max_tokens = 1000 } = options;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature,
      max_tokens,
      messages: [{ role: 'user', content: prompt }]
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('שגיאה ב-GPT:', error);
    throw new Error(`שגיאה ב-GPT: ${error}`);
  }
}

// פונקציה לפנייה ל-GPT לזוג בודד
const analyzeMatchWithGPT = async (
  male: DetailedCandidate, 
  female: DetailedCandidate,
  gptSettings?: { model: string, temperature: number, maxTokens: number },
  customPrompt?: string,
  advancedSettings?: AdvancedMatchingSettings
): Promise<GPTMatchResponse> => {
  console.log(`🤖 שולח ל-GPT לניתוח: ${male.name} - ${female.name}`)
  
  // ברירת מחדל להגדרות GPT
  const model = gptSettings?.model || 'gpt-4o-mini'
  const temperature = gptSettings?.temperature || 0.6
  const maxTokens = gptSettings?.maxTokens || 1000
  
  // 🟦 DEBUG: הגדרות GPT
  console.log(`🔧 [DEBUG] הגדרות GPT:`, {
    model,
    temperature,
    maxTokens,
    focusAreas: advancedSettings?.customGptSettings?.focusAreas,
    analysisDepth: advancedSettings?.customGptSettings?.analysisDepth,
    weights: advancedSettings?.weights
  })
  
  // בניית הפרומפטים - שימוש בפונקציה המשותפת
  const systemPrompt = customPrompt || buildSystemPrompt(advancedSettings)
  const userPrompt = createMatchPrompt(male, female, advancedSettings)
  
  // 🟦 DEBUG: פרומפטים שנשלחים
  console.log(`📝 [DEBUG] System Prompt:`)
  console.log(systemPrompt)
  console.log(`📝 [DEBUG] User Prompt:`)
  console.log(userPrompt)
  console.log(`📝 [DEBUG] אורך פרומפט: ${userPrompt.length} תווים`)
  
  try {
    const requestPayload = {
      model,
      messages: [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: userPrompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" as const }
    }
    
    // 🟦 DEBUG: בקשה שנשלחת ל-OpenAI
    console.log(`📡 [DEBUG] בקשה ל-OpenAI:`, {
      model: requestPayload.model,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      messagesCount: requestPayload.messages.length,
      totalChars: requestPayload.messages.reduce((sum, msg) => sum + msg.content.length, 0)
    })

    const response = await openai.chat.completions.create(requestPayload)

    // 🟦 DEBUG: תשובה גולמית
    console.log(`📨 [DEBUG] תשובה גולמית מ-OpenAI:`, {
      choices: response.choices.length,
      usage: response.usage,
      model: response.model,
      finishReason: response.choices[0]?.finish_reason
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('אין תוכן בתשובה מ-GPT')
    }

    // 🟦 DEBUG: תוכן התשובה
    console.log(`📄 [DEBUG] תוכן התשובה מ-GPT:`)
    console.log(content)

    const parsed = JSON.parse(content) as GPTMatchResponse
    
    // 🟦 DEBUG: תשובה מפוענחת
    console.log(`🎯 [DEBUG] תשובה מפוענחת:`, {
      score: parsed.score,
      summaryLength: parsed.summary?.length || 0,
      strengthsCount: parsed.strengths?.length || 0,
      concernsCount: parsed.concerns?.length || 0,
      strengths: parsed.strengths,
      concerns: parsed.concerns
    })
    
    console.log(`✅ תשובה מ-GPT: ציון ${parsed.score}/10 - ${parsed.summary}`)
    
    return parsed
  } catch (error) {
    console.error('❌ שגיאה בפנייה ל-GPT:', error)
    if (error instanceof Error) {
      console.error('❌ פרטי השגיאה:', error.message)
      console.error('❌ Stack trace:', error.stack)
    }
    throw new Error(`שגיאה בניתוח ההתאמה: ${error}`)
  }
}

// פונקציה לבדיקת הצעות קיימות במסד הנתונים
const getExistingProposals = async (): Promise<Set<string>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Set()

    const { data: shadchan } = await supabase
      .from('shadchanim')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!shadchan) return new Set()

    const { data: existingProposals, error } = await supabase
      .from('match_proposals')
      .select('boy_row_id, girl_row_id')
      .eq('shadchan_id', shadchan.id)
              .in('status', ['ready_for_processing']) // הצעות פעילות (לא כולל pending)

    if (error) {
      console.error('שגיאה בקבלת הצעות קיימות:', error)
      return new Set()
    }

    // יצירת Set של מפתחות יחודיים
    const existingKeys = new Set<string>()
    existingProposals?.forEach(proposal => {
      existingKeys.add(`${proposal.boy_row_id}-${proposal.girl_row_id}`)
    })

    console.log(`🔍 נמצאו ${existingKeys.size} הצעות קיימות פעילות`)
    return existingKeys

  } catch (error) {
    console.error('שגיאה בבדיקת הצעות קיימות:', error)
    return new Set()
  }
}

// יצירת זוגות פוטנציאליים עם ניקוד לוגי וסינון הצעות קיימות
const createPotentialPairs = async (
  males: DetailedCandidate[], 
  females: DetailedCandidate[], 
  logicalThreshold: number = 4,
  weights?: { age: number, location: number, religiousLevel: number, education: number, profession: number, familyBackground: number },
  hardFilters?: { maxAgeDifference: number, respectReligiousLevel: boolean, respectCommunityPreference: boolean, respectDealBreakers: boolean }
) => {
  const pairs = []
  let totalPairs = 0
  let hardFilterPassed = 0
  let logicalScorePassed = 0
  let alreadyExists = 0

  // קבלת הצעות קיימות
  const existingProposals = await getExistingProposals()

  for (const male of males) {
    for (const female of females) {
      totalPairs++
      
      // בדיקה ראשונה: האם ההצעה כבר קיימת במסד הנתונים
      const pairKey = `${male.id}-${female.id}`
      if (existingProposals.has(pairKey)) {
        alreadyExists++
        continue // דלג על ההצעה הקיימת
      }
      
      // שלב 1: סינון קשיח (עם הגדרות מותאמות)
      if (applyHardFilters(male, female, hardFilters)) {
        hardFilterPassed++
        
        // שלב 2: ניקוד לוגי (עם משקולות מותאמות)
        const logicalScore = calculateLogicalScore(male, female, weights)
        
        // רק זוגות עם ציון גבוה ישלחו ל-GPT
        if (logicalScore >= logicalThreshold) {
          logicalScorePassed++
          pairs.push({ 
            male, 
            female, 
            logicalScore,
            willSendToGPT: true
          })
        }
      }
    }
  }

  console.log(`📊 סטטיסטיקות סינון:`)
  console.log(`   - סה"כ התאמות אפשריות: ${totalPairs}`)
  console.log(`   - הצעות שכבר קיימות (דולגו): ${alreadyExists}`)
  console.log(`   - עברו סינון קשיח: ${hardFilterPassed}`)
  console.log(`   - יישלחו ל-GPT (ציון ≥${logicalThreshold}): ${logicalScorePassed}`)
  console.log(`   - חיסכון בעלות: ${((totalPairs - logicalScorePassed)/totalPairs*100).toFixed(1)}%`)

  return pairs
}

// עיבוד זוגות במקביל (מהיר יותר!)
const processPairsInBatches = async (
  pairs: any[], 
  batchSize: number = 3,
  gptSettings?: { model: string, temperature: number, maxTokens: number },
  customPrompt?: string,
  advancedSettings?: AdvancedMatchingSettings
): Promise<MatchProposal[]> => {
  const matches: MatchProposal[] = []
  
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize)
    
    // עיבוד הקבוצה במקביל
    const batchPromises = batch.map(async (pair) => {
      try {
        const gptResponse = await analyzeMatchWithGPT(
          pair.male, 
          pair.female, 
          gptSettings, 
          customPrompt,
          advancedSettings
        )
        
        return {
          id: `${pair.male.name}-${pair.female.name}-${Date.now()}`,
          maleId: pair.male.id,
          femaleName: pair.female.name,
          maleName: pair.male.name,
          femaleId: pair.female.id,
          logicalScore: pair.logicalScore,
          gptScore: gptResponse.score,
          finalScore: (pair.logicalScore + gptResponse.score) / 2,
          summary: gptResponse.summary,
          strengths: gptResponse.strengths || [],
          concerns: gptResponse.concerns || [],
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          shadchanId: 'current-user',
          // הוספת מזהי שורות לשמירה במסד הנתונים
          boy_row_id: pair.male.id,
          girl_row_id: pair.female.id,
          // הוספת נתוני המועמדים המלאים עם הסדר החדש והתקין
          boy_data: pair.male,
          girl_data: pair.female
        } as MatchProposal
      } catch (error) {
        console.error(`❌ שגיאה בניתוח GPT לזוג ${pair.male.name}-${pair.female.name}:`, error)
        return null
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    const validResults = batchResults.filter(result => result !== null) as MatchProposal[]
    matches.push(...validResults)
    
    console.log(`✅ עובד קבוצה ${Math.floor(i/batchSize) + 1}/${Math.ceil(pairs.length/batchSize)} - ${validResults.length} התאמות נוספו`)
    
    // השהייה קצרה בין קבוצות למניעת Rate Limiting
    if (i + batchSize < pairs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return matches
}

// הפונקציה הראשית המשופרת - מבוססת על הגישה החכמה שלך
export const generateMatches = async (
  males: DetailedCandidate[], 
  females: DetailedCandidate[],
  settings?: AdvancedMatchingSettings
): Promise<MatchProposal[]> => {
  // הגדרות קבועות ומותאמות אישית
  const LOGICAL_THRESHOLD = 5  // סף לוגי קבוע איכותי (5/10)
  const maxGptCandidates = settings?.maxMatches || 20  // כמות זוגות מובילים (שעברו בדיקת היתכנות) לשליחה ל-GPT
  const maxMatches = maxGptCandidates  // מחזיר את כל מה שחוזר מ-GPT (ללא הגבלה נוספת)
  const weights = settings?.weights
  const hardFilters = settings?.hardFilters
  const gptSettings = settings?.gptSettings
  const customPrompt = settings?.customGptSettings?.customPrompt
  console.log(`🚀 מתחיל תהליך התאמה חכם משופר`)
  console.log(`📊 כמות בחורים: ${males.length}, בחורות: ${females.length}`)
  console.log(`⚙️ סף לוגי קבוע: ${LOGICAL_THRESHOLD}/10, מקסימום ל-GPT: ${maxGptCandidates}, יוחזרו: ${maxMatches}`)

  // שלב 1+2: יצירת זוגות פוטנציאליים עם סינון וניקוד (עכשיו כולל בדיקת קיימות)
  const potentialPairs = await createPotentialPairs(males, females, LOGICAL_THRESHOLD, weights, hardFilters)
  
  // 🟦 DEBUG: פירוט הזוגות שנמצאו
  console.log(`🔍 [DEBUG] פירוט זוגות פוטנציאליים:`)
  potentialPairs.slice(0, 5).forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.male.name} (${pair.male.age}) + ${pair.female.name} (${pair.female.age}) = ציון לוגי: ${pair.logicalScore}/10`)
  })
  if (potentialPairs.length > 5) {
    console.log(`... ועוד ${potentialPairs.length - 5} זוגות`)
  }
  
  if (potentialPairs.length === 0) {
    console.log('❌ לא נמצאו זוגות חדשים העוברים את הסינון')
    return []
  }

  // **חידוש: מיון לפי ציון לוגי והגבלת כמות לפני GPT**
  console.log(`📊 נמצאו ${potentialPairs.length} זוגות פוטנציאליים`)
  
  // מיון לפי ציון לוגי (מהגבוה לנמוך)
  potentialPairs.sort((a, b) => b.logicalScore - a.logicalScore)
  
  // 🟦 DEBUG: טווח ציונים לוגיים
  console.log(`📈 [DEBUG] טווח ציונים לוגיים: ${potentialPairs[potentialPairs.length-1]?.logicalScore} - ${potentialPairs[0]?.logicalScore}`)
  
  // הגבלה למספר המקסימלי שקבע המשתמש (זוגות שעברו בדיקת היתכנות באלגוריתם)
  const selectedPairs = potentialPairs.slice(0, maxGptCandidates)
  
  // 🟦 DEBUG: הזוגות שנבחרו ל-GPT
  console.log(`🎯 [DEBUG] הזוגות שנבחרו לניתוח GPT:`)
  selectedPairs.forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.male.name} + ${pair.female.name} (ציון לוגי: ${pair.logicalScore})`)
  })
  
  console.log(`🎯 נבחרו ${selectedPairs.length} הזוגות הטובים ביותר לניתוח GPT מתוך ${potentialPairs.length}`)
  console.log(`📈 לאחר ניתוח GPT יוחזרו ${maxMatches} הטובות ביותר`)
  console.log(`💰 חיסכון בעלות: ${((potentialPairs.length - selectedPairs.length) / potentialPairs.length * 100).toFixed(1)}%`)

  // שלב 3: עיבוד הזוגות הנבחרים עם GPT
  const allMatches = await processPairsInBatches(selectedPairs, 3, gptSettings, customPrompt, settings) // 3 בקשות במקביל

  // שלב 4: מיון לפי ציון סופי והחזרת הטובות ביותר
  allMatches.sort((a, b) => b.finalScore - a.finalScore)
  
  // 🟦 DEBUG: כל ההתאמות שחזרו מ-GPT
  console.log(`🎯 [DEBUG] כל ההתאמות שחזרו מ-GPT:`)
  allMatches.forEach((match, index) => {
    console.log(`${index + 1}. ${match.maleName} + ${match.femaleName}:`)
    console.log(`   ציון לוגי: ${match.logicalScore}, ציון GPT: ${match.gptScore}, ציון סופי: ${match.finalScore.toFixed(1)}`)
    console.log(`   סיכום: ${match.summary}`)
    console.log(`   חוזקות: ${match.strengths.join(', ')}`)
    console.log(`   חששות: ${match.concerns.join(', ')}`)
    console.log('---')
  })
  
  // **החזרת כל התוצאות מ-GPT (לא מגביל יותר)**
  const topMatches = allMatches  // מחזיר הכל כמו שהמשתמש ביקש

  // 🟦 DEBUG: ההתאמות הסופיות שנבחרו
  console.log(`✨ [DEBUG] ההתאמות הסופיות שנבחרו (${topMatches.length}):`)
  topMatches.forEach((match, index) => {
    console.log(`${index + 1}. ${match.maleName} + ${match.femaleName} (ציון סופי: ${match.finalScore.toFixed(1)})`)
  })

  // סיכום סופי מפורט
  console.log(`\n📈 סיכום תהליך ההתאמה החכם המשופר:`)
  console.log(`   📊 זוגות פוטנציאליים שעברו סינון: ${potentialPairs.length}`)
  console.log(`   🎯 נבחרו לניתוח GPT: ${selectedPairs.length}`)
  console.log(`   🤖 נותחו בפועל ב-GPT: ${allMatches.length} זוגות`)
  console.log(`   ✨ הוחזרו הטובות ביותר: ${topMatches.length}`)
  console.log(`   📊 טווח ציונים: ${topMatches[topMatches.length-1]?.finalScore.toFixed(1)} - ${topMatches[0]?.finalScore.toFixed(1)}`)
  console.log(`   💰 עלות משוערת: $${(allMatches.length * 0.0001).toFixed(4)} (במקום $${(potentialPairs.length * 0.0001).toFixed(4)})`)
  console.log(`   ⚡ זמן חסוך: ~${Math.round((potentialPairs.length - selectedPairs.length) * 2)} שניות`)

  return topMatches
}

// פונקציה ליצירת אימייל התאמה (נשארת כמו שהיא)
export const generateMatchEmail = async (match: MatchProposal): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'אתה עוזר לשדכן לכתוב אימיילים מקצועיים להצעת שידוכים. כתוב באופן חם ומכבד.'
        },
        {
          role: 'user',
          content: `כתוב אימייל להצעת שידוך בין ${match.maleName} ל${match.femaleName}.
          
ציון ההתאמה: ${match.finalScore.toFixed(1)}/10
סיכום: ${match.summary}
נקודות חוזק: ${match.strengths.join(', ')}
${match.concerns.length > 0 ? `נקודות לתשומת לב: ${match.concerns.join(', ')}` : ''}

האימייל צריך להיות מקצועי ומעודד, תוך הדגשת נקודות החוזק של ההתאמה.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    return response.choices[0]?.message?.content || 'שגיאה ביצירת האימייל'
  } catch (error) {
    console.error('שגיאה ביצירת אימייל:', error)
    throw error
  }
}

// פונקציה פשוטה ליצירת אימייל מהיר ללא GPT (חסכון)
export const createQuickMatchEmail = (match: MatchProposal): string => {
  return `שלום,

אני מבקש להציע בפניכם שידוך בין ${match.maleName} ל${match.femaleName}.

ציון התאמה: ${match.finalScore.toFixed(1)}/10

סיכום ההתאמה: ${match.summary}

נקודות חוזק:
${match.strengths.map(s => `• ${s}`).join('\n')}

${match.concerns.length > 0 ? `נקודות לתשומת לב:\n${match.concerns.map(c => `• ${c}`).join('\n')}\n` : ''}

אשמח לקבל את הסכמתכם להמשך התהליך.

בברכה,
המערכת`
} 