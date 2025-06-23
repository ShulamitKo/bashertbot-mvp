import axios from 'axios'
import { Candidate, AIMatchResult } from '@/types'

// פונקציות עבודה עם OpenAI GPT

interface OpenAIResponse {
  choices: {
    message: {
      content: string
    }
  }[]
}

// יצירת התאמה באמצעות GPT
export async function generateMatch(
  boy: Candidate,
  girl: Candidate,
  customPrompt: string,
  apiKey: string
): Promise<AIMatchResult> {
  try {
    const prompt = createMatchingPrompt(boy, girl, customPrompt)
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'אתה שדכן מקצועי ומנוסה שמתמחה בהתאמות לקהילה הדתית. אתה מנתח פרופילים ומעריך את רמת ההתאמה בין זוגות לפי קריטריונים רלוונטיים.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data: OpenAIResponse = response.data
    const result = data.choices[0]?.message?.content

    if (!result) {
      throw new Error('לא התקבלה תגובה מ-GPT')
    }

    return parseGPTResponse(result)
  } catch (error: any) {
    console.error('שגיאה בקריאה ל-OpenAI:', error)
    
    if (error.response?.status === 401) {
      throw new Error('מפתח OpenAI לא תקין')
    } else if (error.response?.status === 429) {
      throw new Error('חרגת ממכסת הקריאות ל-OpenAI')
    } else {
      throw new Error('שגיאה בחיבור ל-OpenAI: ' + (error.message || 'שגיאה לא ידועה'))
    }
  }
}

// יצירת פרומפט להתאמה
function createMatchingPrompt(boy: Candidate, girl: Candidate, customPrompt: string): string {
  return `
נתח את ההתאמה בין שני המועמדים הבאים ותן ציון התאמה מ-0 עד 1:

**הבחור:**
- שם: ${boy.name}
- גיל: ${boy.age}
- עיר: ${boy.city}
- עדה: ${boy.edah}
- השכלה: ${boy.education}
- מקצוע: ${boy.profession}
- רקע משפחתי: ${boy.familyBackground}
- מחפש: ${boy.lookingFor}
- הערות: ${boy.notes || 'אין'}

**הבחורה:**
- שם: ${girl.name}
- גיל: ${girl.age}
- עיר: ${girl.city}
- עדה: ${girl.edah}
- השכלה: ${girl.education}
- מקצוע: ${girl.profession}
- רקע משפחתי: ${girl.familyBackground}
- מחפשת: ${girl.lookingFor}
- הערות: ${girl.notes || 'אין'}

**קריטריונים להתאמה:**
${customPrompt}

אנא החזר תגובה במבנה הבא:
SCORE: [ציון בין 0.0 ל-1.0]
RECOMMENDATION: [highly_recommended/recommended/consider/not_recommended]
REASONING: [הסבר מפורט על הציון]
PROS: [יתרונות ההתאמה, מופרדים בפסיקים]
CONS: [חסרונות או אתגרים, מופרדים בפסיקים]
`
}

// פענוח תגובת GPT
function parseGPTResponse(response: string): AIMatchResult {
  try {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line)
    
    let score = 0
    let recommendation: AIMatchResult['recommendation'] = 'not_recommended'
    let reasoning = ''
    let pros: string[] = []
    let cons: string[] = []

    lines.forEach(line => {
      if (line.startsWith('SCORE:')) {
        const scoreStr = line.replace('SCORE:', '').trim()
        score = Math.max(0, Math.min(1, parseFloat(scoreStr) || 0))
      } else if (line.startsWith('RECOMMENDATION:')) {
        const rec = line.replace('RECOMMENDATION:', '').trim()
        if (['highly_recommended', 'recommended', 'consider', 'not_recommended'].includes(rec)) {
          recommendation = rec as AIMatchResult['recommendation']
        }
      } else if (line.startsWith('REASONING:')) {
        reasoning = line.replace('REASONING:', '').trim()
      } else if (line.startsWith('PROS:')) {
        const prosStr = line.replace('PROS:', '').trim()
        pros = prosStr.split(',').map(p => p.trim()).filter(p => p)
      } else if (line.startsWith('CONS:')) {
        const consStr = line.replace('CONS:', '').trim()
        cons = consStr.split(',').map(c => c.trim()).filter(c => c)
      }
    })

    return {
      score,
      reasoning: reasoning || 'לא סופק הסבר',
      pros: pros.length > 0 ? pros : ['לא צוינו יתרונות'],
      cons: cons.length > 0 ? cons : ['לא צוינו חסרונות'],
      recommendation
    }
  } catch (error) {
    console.error('שגיאה בפענוח תגובת GPT:', error)
    return {
      score: 0,
      reasoning: 'שגיאה בפענוח התגובה מ-GPT',
      pros: [],
      cons: ['לא ניתן לנתח את התגובה'],
      recommendation: 'not_recommended'
    }
  }
}

// בדיקת תקינות מפתח OpenAI
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'בדיקה' }],
        max_tokens: 5
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )
    return true
  } catch (error: any) {
    console.error('בדיקת מפתח OpenAI נכשלה:', error)
    return false
  }
}

// יצירת הצעת מייל
export async function generateProposalEmail(
  boyName: string,
  girlName: string,
  matchReasoning: string,
  apiKey: string
): Promise<string> {
  try {
    const prompt = `
צור הצעת מייל מקצועית ונעימה לשדכן שרוצה להציע שידוך.

פרטי ההתאמה:
- שם הבחור: ${boyName}
- שם הבחורה: ${girlName}
- סיבת ההתאמה: ${matchReasoning}

כתב מייל קצר, מקצועי ומנומס שמציג את ההצעה באופן חיובי.
החזר רק את תוכן המייל ללא נושא.
`

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'אתה עוזר בכתיבת מיילים מקצועיים לשדכנים'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.8
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data: OpenAIResponse = response.data
    return data.choices[0]?.message?.content || 'שגיאה ביצירת המייל'
  } catch (error) {
    console.error('שגיאה ביצירת מייל:', error)
    throw new Error('לא ניתן ליצור מייל אוטומטי')
  }
} 