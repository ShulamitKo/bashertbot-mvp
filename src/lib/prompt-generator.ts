import { AdvancedMatchingSettings, DetailedCandidate } from '@/types'

// פונקציה ליצירת פרומפט מערכת (System Prompt)
export const buildSystemPrompt = (settings?: AdvancedMatchingSettings): string => {
  let systemPrompt = 'אתה שדכן מקצועי ומנוסה המתמחה בהתאמות זוגיות במגזר הדתי והחרדי. אתה מכיר היטב את הערכים, המנהגים והציפיות של הקהילה.'
  
  // הוספת התמחויות מיוחדות
  if (settings?.customGptSettings?.focusAreas?.length) {
    systemPrompt += ` אתה מתמחה במיוחד בהבנה ב${settings.customGptSettings.focusAreas.join(', ')}.`
  }
  
  // רמת ניתוח
  const analysisDepth = settings?.customGptSettings?.analysisDepth || 'detailed'
  if (analysisDepth === 'basic') {
    systemPrompt += ' תן מענה מהיר ומדויק המתמקד בנקודות המרכזיות.'
  } else if (analysisDepth === 'comprehensive') {
    systemPrompt += ' בצע ניתוח מעמיק ומקיף הכולל ממדים פסיכולוגיים, חברתיים ותרבותיים.'
  } else {
    systemPrompt += ' בצע ניתוח מפורט ומאוזן הכולל היבטים רוחניים, רגשיים ומעשיים.'
  }
  
  systemPrompt += ' אתה נותן ציונים מדויקים ומנומקים היטב, תוך הקפדה על יושרה מקצועית.'
  
  // הוספת חוקים כלליים של השדכן
  if (settings?.hardFilters || settings?.advancedFilters) {
    systemPrompt += ' אתה מכבד בקפדנות את הפילטרים והחוקים שהשדכן קבע.'
  }
  
  return systemPrompt
}

// פונקציה ליצירת תצוגה מקדימה מקוצרת לשדכן (ללא דוגמאות מועמדים)
export const createSampleMatchPrompt = (settings?: AdvancedMatchingSettings): string => {
  console.log('🎯 [DEBUG] יוצר דוגמת פרומפט עם הגדרות:', settings)
  
  // חילוץ תחומי דגש מההגדרות
  const focusAreas = settings?.customGptSettings?.focusAreas || []
  const weights = settings?.weights
  const hardFilters = settings?.hardFilters
  const advancedFilters = settings?.advancedFilters

  // בניית הפרומפט הראשי
  let prompt = `בצע ניתוח מקצועי של ההתאמה הזוגית`
  
  if (focusAreas.length > 0) {
    prompt += `, תוך התמקדות מיוחדת ב: ${focusAreas.join(', ')}`
  }
  
  prompt += `

עליך להתחשב בקריטריונים הבאים:`

  // הוספת משקולות חשיבות אם קיימות
  if (weights) {
    const labels: Record<string, string> = {
      age: 'פער גילאים',
      location: 'קרבה גיאוגרפית', 
      religiousLevel: 'התאמה דתית',
      education: 'רמת השכלה',
      profession: 'סוג מקצוע',
      familyBackground: 'רקע משפחתי',
      personality: 'אישיות וטמפרמנט',
      values: 'ערכים וחזון משפחתי'
    }

    // קריטריונים בעדיפות גבוהה (8+)
    const priorityAreas = Object.entries(weights)
      .filter(([_, weight]) => weight >= 8)
      .map(([key, weight]) => `${labels[key] || key} (${weight}/10)`)
    
    if (priorityAreas.length > 0) {
      prompt += `
**קריטריונים בעדיפות גבוהה:** ${priorityAreas.join(', ')}`
    }

    // כל המשקלים לעיון של GPT
    const allWeights = Object.entries(weights)
      .sort(([,a], [,b]) => b - a) // מיון לפי חשיבות
      .map(([key, weight]) => `${labels[key] || key}: ${weight}/10`)
    
    prompt += `
**משקלי חשיבות לכל הקריטריונים:**
${allWeights.join(', ')}`
  }

  prompt += `

**כללי ניתוח:**
1. תאימות בסיסית (רמה דתית, עדה, גיל)
2. התאמת מטרות ודרישות בסיסיות
3. זיהוי אי-התאמות חמורות
4. **חשוב:** השתמש במשקלי החשיבות לקביעת הציון הסופי - קריטריונים עם משקל גבוה יותר צריכים להשפיע יותר על הציון`

  // הוספת פילטרים קשיחים
  if (hardFilters) {
    const filterRules = []
    
    if (hardFilters.maxAgeDifference) {
      filterRules.push(`פער גיל מקסימלי: ${hardFilters.maxAgeDifference} שנים`)
    }
    
    if (hardFilters.respectReligiousLevel) {
      filterRules.push('כבד רמה דתית')
    }
    
    if (hardFilters.respectCommunityPreference) {
      filterRules.push('כבד העדפות עדתיות')
    }
    
    if (hardFilters.respectDealBreakers) {
      filterRules.push('שים לב ל"דיל ברייקרס" ופסול התאמות שמנוגדות להם')
    }
    
    if (hardFilters.respectMaritalStatus) {
      filterRules.push('אל תציע גרושים לרווקים')
    }
    
    if (filterRules.length > 0) {
      prompt += `

**חוקים נוקשים שחובה לכבד (אי עמידה בהם = פסילה מיידית):**
${filterRules.join(', ')}`
    }
  }

  // הוספת פילטרים מתקדמים
  if (advancedFilters) {
    const advancedRules = []
    
    if (advancedFilters.requireSameCity) {
      advancedRules.push('העדף זוגות מאותה עיר')
    }
    
    if (!advancedFilters.allowDivorced) {
      advancedRules.push('אל תכלול גרושים/גרושות')
    }
    
    if (advancedRules.length > 0) {
      prompt += `
- הגבלות נוספות: ${advancedRules.join(', ')}`
    }
  }

  console.log('📝 [DEBUG] תצוגה מקדימה נוצרה:', prompt.length, 'תווים')
  return prompt
}

// פונקציה מלאה ליצירת פרומפט עם נתוני זוג לדוגמה (לשימוש בקוד בלבד)
export const createFullSampleMatchPrompt = (settings?: AdvancedMatchingSettings): string => {
  // יצירת דוגמאות מועמדים
  const sampleMale: DetailedCandidate = {
    id: 'sample_male',
    name: 'דוד כהן',
    age: 28,
    maritalStatus: 'רווק',
    religiousLevel: 'דתי',
    community: 'אשכנזי',
    location: 'ירושלים',
    education: 'תואר ראשון',
    profession: 'מהנדס תוכנה',
    familyBackground: 'משפחה דתית, 4 ילדים',
    lookingFor: 'בחורה דתייה, משכילה, רוצה משפחה',
    importantToMe: 'יושרה, הומור, חזון משותף',
    dealBreakers: 'עישון, חוסר מחויבות דתית',
    hobbies: 'קריאה, טיולים, מוזיקה',
    personalityType: 'חברותי, אחראי, אופטימי'
  }

  const sampleFemale: DetailedCandidate = {
    id: 'sample_female',
    name: 'שרה לוי',
    age: 25,
    maritalStatus: 'רווקה',
    religiousLevel: 'דתייה',
    community: 'ספרדי',
    location: 'תל אביב',
    education: 'תואר ראשון',
    profession: 'מורה',
    familyBackground: 'משפחה דתייה, 3 ילדים',
    lookingFor: 'בחור דתי, יציב, רוצה משפחה',
    importantToMe: 'כנות, ערכים, חינוך ילדים',
    dealBreakers: 'חוסר יציבות, התנהגות לא הולמת',
    hobbies: 'אמנות, בישול, חינוך',
    personalityType: 'רגישה, מסורה, יצירתית'
  }

  return createMatchPrompt(sampleMale, sampleFemale, settings)
}

// הפונקציה המקורית מ-openai.ts (מועתקת לכאן לשימוש בתצוגה מקדימה)
export const createMatchPrompt = (
  male: DetailedCandidate, 
  female: DetailedCandidate, 
  settings?: AdvancedMatchingSettings
): string => {
  
  // חילוץ תחומי דגש מההגדרות
  const focusAreas = settings?.customGptSettings?.focusAreas || []
  console.log('🎯 [DEBUG] תחומי התמקדות שנבחרו:', focusAreas)
  const analysisDepth = settings?.customGptSettings?.analysisDepth || 'detailed'
  const weights = settings?.weights
  const hardFilters = settings?.hardFilters
  const advancedFilters = settings?.advancedFilters
  
  // בניית סקירת נתונים בהתאם לרמת העומק
  const getPersonalitySection = (candidate: DetailedCandidate, gender: 'male' | 'female') => {
    const pronouns = gender === 'male' ? { 
      seeking: 'מחפש', 
      important: 'חשוב לו', 
      dealBreaker: 'דיל ברייקרס שלו'
    } : { 
      seeking: 'מחפשת', 
      important: 'חשוב לה', 
      dealBreaker: 'דיל ברייקרס שלה'
    }
    
    let section = `
**${gender === 'male' ? 'בחור' : 'בחורה'}:**
- שם: ${candidate.name}
- גיל: ${candidate.age}
- מצב משפחתי: ${candidate.maritalStatus || 'לא צוין'}
- רמה דתית: ${candidate.religiousLevel || 'לא צוין'}
- עדה/קהילה: ${candidate.community || 'לא צוין'}
- מקום מגורים: ${candidate.location || 'לא צוין'}
- השכלה: ${candidate.education || 'לא צוין'}
- מקצוע: ${candidate.profession || 'לא צוין'}`

    if (analysisDepth === 'detailed' || analysisDepth === 'comprehensive') {
      section += `
- רקע משפחתי: ${candidate.familyBackground || 'לא צוין'}
- ${pronouns.seeking}: ${candidate.lookingFor || 'לא צוין'}
- ${pronouns.important}: ${candidate.importantToMe || 'לא צוין'}
- ${pronouns.dealBreaker}: ${candidate.dealBreakers || 'לא צוין'}`
    }

    if (analysisDepth === 'comprehensive') {
      section += `
- תחביבים: ${candidate.hobbies || 'לא צוין'}
- סוג אישיות: ${candidate.personalityType || 'לא צוין'}`
    }

    return section
  }

  // בניית הפרומפט הראשי
  let prompt = `בצע ניתוח מקצועי של ההתאמה הזוגית`
  
  if (focusAreas.length > 0) {
    prompt += `, תוך התמקדות מיוחדת ב: ${focusAreas.join(', ')}`
  }
  
  prompt += `

עליך להתחשב בקריטריונים הבאים:`

  // הוספת משקולות חשיבות אם קיימות
  if (weights) {
    const labels: Record<string, string> = {
      age: 'פער גילאים',
      location: 'קרבה גיאוגרפית', 
      religiousLevel: 'התאמה דתית',
      education: 'רמת השכלה',
      profession: 'סוג מקצוע',
      familyBackground: 'רקע משפחתי',
      personality: 'אישיות וטמפרמנט',
      values: 'ערכים וחזון משפחתי'
    }

    // קריטריונים בעדיפות גבוהה (8+)
    const priorityAreas = Object.entries(weights)
      .filter(([_, weight]) => weight >= 8)
      .map(([key, weight]) => `${labels[key] || key} (${weight}/10)`)
    
    if (priorityAreas.length > 0) {
      prompt += `
**קריטריונים בעדיפות גבוהה:** ${priorityAreas.join(', ')}`
    }

    // כל המשקלים לעיון של GPT
    const allWeights = Object.entries(weights)
      .sort(([,a], [,b]) => b - a) // מיון לפי חשיבות
      .map(([key, weight]) => `${labels[key] || key}: ${weight}/10`)
    
    prompt += `
**משקלי חשיבות לכל הקריטריונים:**
${allWeights.join(', ')}`
  }

  prompt += `

**כללי ניתוח:**
1. תאימות בסיסית (רמה דתית, עדה, גיל)
2. התאמת מטרות ודרישות בסיסיות
3. זיהוי אי-התאמות חמורות
4. **חשוב:** השתמש במשקלי החשיבות לקביעת הציון הסופי - קריטריונים עם משקל גבוה יותר צריכים להשפיע יותר על הציון`

  // הוספת פילטרים קשיחים
  if (hardFilters) {
    const filterRules = []
    
    if (hardFilters.maxAgeDifference) {
      filterRules.push(`פער גיל מקסימלי: ${hardFilters.maxAgeDifference} שנים`)
    }
    
    if (hardFilters.respectReligiousLevel) {
      filterRules.push('כבד רמה דתית')
    }
    
    if (hardFilters.respectCommunityPreference) {
      filterRules.push('כבד העדפות עדתיות')
    }
    
    if (hardFilters.respectDealBreakers) {
      filterRules.push('שים לב ל"דיל ברייקרס" ופסול התאמות שמנוגדות להם')
    }
    
    if (hardFilters.respectMaritalStatus) {
      filterRules.push('אל תציע גרושים לרווקים')
    }
    
    if (filterRules.length > 0) {
      prompt += `

**חוקים נוקשים שחובה לכבד (אי עמידה בהם = פסילה מיידית):**
${filterRules.join(', ')}`
    }
  }

  // הוספת פילטרים מתקדמים
  if (advancedFilters) {
    const advancedRules = []
    
    if (advancedFilters.requireSameCity) {
      advancedRules.push('העדף זוגות מאותה עיר')
    }
    

    
    if (!advancedFilters.allowDivorced) {
      advancedRules.push('אל תכלול גרושים/גרושות')
    }
    
    if (advancedRules.length > 0) {
      prompt += `
- הגבלות נוספות: ${advancedRules.join(', ')}`
    }
  }

  // הוספת נתוני המועמדים
  prompt += `


${getPersonalitySection(male, 'male')}

${getPersonalitySection(female, 'female')}

**הנחיות חישוב ציון:**
חשב את הציון הסופי על בסיס משוקלל:
- כל קריטריון מקבל ציון מ-1 עד 10
- הכפל את הציון במשקל החשיבות שלו
- הציון הסופי = ממוצע משוקלל של כל הקריטריונים
- דוגמה: אם "התאמה דתית" (משקל 9) מקבלת ציון 8, והשפעתה על הציון הסופי היא 9×8=72 נקודות

**הנחיות החזרה:**
החזר תשובה מובנית בפורמט JSON עם הפרטים הבאים:
{
  "score": [מספר שלם בין 1-10 מחושב לפי המשקלים, כאשר 10 = התאמה מושלמת],
  "summary": "[סיכום קצר ומדויק של איכות ההתאמה ב-2-3 משפטים, עם התייחסות לקריטריונים החשובים ביותר]",
  "strengths": ["נקודת חוזק 1", "נקודת חוזק 2", "נקודת חוזק 3"],
  "concerns": ["אתגר או נקודת תשומת לב 1", "אתגר 2"]
}

**קריטריוני ציון:**
- 9-10: התאמה יוצאת דופן עם פוטנציאל גבוה להצלחה
- 7-8: התאמה טובה עם נקודות חוזק משמעותיות
- 5-6: התאמה בסיסית עם צורך בשיקול מעמיק
- 3-4: אתגרים משמעותיים אך אפשרי בתנאים מסוימים
- 1-2: אי-התאמה ברורה, לא מומלץ`

  return prompt
}

// פונקציה להחזרת מידע על הפרומפט
export const getPromptStats = (settings?: AdvancedMatchingSettings) => {
  const systemPrompt = buildSystemPrompt(settings)
  const userPrompt = createSampleMatchPrompt(settings)
  
  return {
    systemPrompt,
    userPrompt,
    systemLength: systemPrompt.length,
    userLength: userPrompt.length,
    totalLength: systemPrompt.length + userPrompt.length,
    estimatedTokens: Math.ceil((systemPrompt.length + userPrompt.length) / 4), // הערכה גסה
    model: settings?.gptSettings?.model || 'gpt-4o-mini',
    temperature: settings?.gptSettings?.temperature || 0.7,
    maxTokens: settings?.gptSettings?.maxTokens || 1000,
    focusAreas: settings?.customGptSettings?.focusAreas || [],
    analysisDepth: settings?.customGptSettings?.analysisDepth || 'detailed'
  }
}
