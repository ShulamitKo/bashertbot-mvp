import OpenAI from 'openai'
import { MatchProposal } from '../types'
import { 
  DetailedCandidate,
  applyHardFilters, 
  calculateLogicalScore,  
} from './google-sheets'
import { supabase } from './supabase'

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

// פונקציה ליצירת פרומפט מותאם לזוג ספציפי
const createMatchPrompt = (male: DetailedCandidate, female: DetailedCandidate): string => {
  return `האם קיימת התאמה זוגית בין שני המועמדים הבאים:

**בחור:**
- שם: ${male.name}
- גיל: ${male.age}
- מצב משפחתי: ${male.maritalStatus}
- רמה דתית: ${male.religiousLevel}
- עדה: ${male.community}
- מקום מגורים: ${male.location}
- השכלה: ${male.education}
- מקצוע: ${male.profession}
- תחביבים: ${male.hobbies || 'לא צוין'}
- ערכים ואמונות: ${male.valuesAndBeliefs || 'לא צוין'}
- מה אני מחפש: ${male.lookingFor || 'לא צוין'}
- חשוב לי: ${male.importantQualities || 'לא צוין'}
- דיל ברייקרס: ${male.dealBreakers || 'אין'}

**בחורה:**
- שם: ${female.name}
- גיל: ${female.age}
- מצב משפחתי: ${female.maritalStatus}
- רמה דתית: ${female.religiousLevel}
- עדה: ${female.community}
- מקום מגורים: ${female.location}
- השכלה: ${female.education}
- מקצוע: ${female.profession}
- תחביבים: ${female.hobbies || 'לא צוין'}
- ערכים ואמונות: ${female.valuesAndBeliefs || 'לא צוין'}
- מה אני מחפשת: ${female.lookingFor || 'לא צוין'}
- חשוב לי: ${female.importantQualities || 'לא צוין'}
- דיל ברייקרס: ${female.dealBreakers || 'אין'}

בצע ניתוח עומק של ההתאמה הזוגית, תוך התחשבות ב:
1. תאימות ערכית ורוחנית
2. יכולת תקשורת וחיבור רגשי פוטנציאלי
3. התאמה בסגנון חיים ובציפיות
4. אתגרים פוטנציאליים וחוזקות

אנא החזר בפורמט JSON:
{
  "score": [מספר בין 1-10],
  "summary": "[נימוק קצר ומדויק למתן הציון]",
  "strengths": ["נקודת חוזק 1", "נקודת חוזק 2", "נקודת חוזק 3"],
  "concerns": ["אתגר 1", "אתגר 2"]
}`
}

// פונקציה לפנייה ל-GPT לזוג בודד
const analyzeMatchWithGPT = async (male: DetailedCandidate, female: DetailedCandidate): Promise<GPTMatchResponse> => {
  console.log(`🤖 שולח ל-GPT לניתוח: ${male.name} - ${female.name}`)
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // מהיר וזול יותר מ-gpt-4
      messages: [
        {
          role: 'system',
          content: 'אתה שדכן מקצועי ומנוסה המתמחה בהתאמות זוגיות במגזר הדתי. אתה מנתח בזהירות את התאימות בין מועמדים ונותן ציון מדויק.'
        },
        {
          role: 'user',
          content: createMatchPrompt(male, female)
        }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('אין תוכן בתשובה מ-GPT')
    }

    const parsed = JSON.parse(content) as GPTMatchResponse
    console.log(`✅ תשובה מ-GPT: ציון ${parsed.score}/10 - ${parsed.summary}`)
    
    return parsed
  } catch (error) {
    console.error('❌ שגיאה בפנייה ל-GPT:', error)
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
      .in('status', ['approved', 'in_progress', 'pending']) // הצעות פעילות

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
const createPotentialPairs = async (males: DetailedCandidate[], females: DetailedCandidate[], logicalThreshold: number = 4) => {
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
      
      // שלב 1: סינון קשיח
      if (applyHardFilters(male, female)) {
        hardFilterPassed++
        
        // שלב 2: ניקוד לוגי
        const logicalScore = calculateLogicalScore(male, female)
        
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
const processPairsInBatches = async (pairs: any[], batchSize: number = 3): Promise<MatchProposal[]> => {
  const matches: MatchProposal[] = []
  
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize)
    
    // עיבוד הקבוצה במקביל
    const batchPromises = batch.map(async (pair) => {
      try {
        const gptResponse = await analyzeMatchWithGPT(pair.male, pair.female)
        
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
          // הוספת נתוני המועמדים המלאים
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
  logicalThreshold: number = 5,
  maxMatches: number = 10
): Promise<MatchProposal[]> => {
  console.log(`🚀 מתחיל תהליך התאמה חכם`)
  console.log(`📊 כמות בחורים: ${males.length}, בחורות: ${females.length}`)
  console.log(`⚙️ סף לוגי: ${logicalThreshold}/10, יוחזרו ${maxMatches} הטובות ביותר`)

  // שלב 1+2: יצירת זוגות פוטנציאליים עם סינון וניקוד (עכשיו כולל בדיקת קיימות)
  const potentialPairs = await createPotentialPairs(males, females, logicalThreshold)
  
  if (potentialPairs.length === 0) {
    console.log('❌ לא נמצאו זוגות חדשים העוברים את הסינון')
    return []
  }

  // **שינוי חשוב: כל מי שעבר את הסינונים ישלח ל-GPT**
  console.log(`🎯 שולח את כל ${potentialPairs.length} הזוגות ל-GPT לניתוח מעמיק`)
  console.log(`📈 לאחר ניתוח GPT יוחזרו ${maxMatches} הטובות ביותר`)

  // שלב 3: עיבוד כל הזוגות עם GPT (ללא הגבלה מוקדמת)
  const allMatches = await processPairsInBatches(potentialPairs, 3) // 3 בקשות במקביל

  // שלב 4: מיון לפי ציון סופי והחזרת הטובות ביותר
  allMatches.sort((a, b) => b.finalScore - a.finalScore)
  
  // **החזרת רק הטובות ביותר**
  const topMatches = allMatches.slice(0, maxMatches)

  // סיכום סופי מפורט
  console.log(`\n📈 סיכום תהליך ההתאמה החכם:`)
  console.log(`   🤖 נותחו ב-GPT: ${allMatches.length} זוגות`)
  console.log(`   🎯 הוחזרו הטובות ביותר: ${topMatches.length}`)
  console.log(`   📊 טווח ציונים: ${topMatches[topMatches.length-1]?.finalScore.toFixed(1)} - ${topMatches[0]?.finalScore.toFixed(1)}`)
  console.log(`   💸 עלות משוערת: $${(allMatches.length * 0.0001).toFixed(4)}`)
  console.log(`   ⚡ זמן חסוך: ~${Math.round((males.length * females.length - allMatches.length) * 2)} שניות`)

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