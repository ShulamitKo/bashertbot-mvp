import axios from 'axios'

// פונקציות עבודה עם Google Sheets API

interface SheetData {
  values: string[][]
}

interface SheetResponse {
  sheets: {
    properties: {
      title: string
      sheetId: number
    }
  }[]
}

// קבלת רשימת טאבים בגיליון
export async function getSheetTabs(spreadsheetId: string, accessToken: string): Promise<string[]> {
  try {
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    const data: SheetResponse = response.data
    return data.sheets?.map(sheet => sheet.properties.title) || []
  } catch (error) {
    // console.error('שגיאה בקבלת טאבי הגיליון:', error)
    throw new Error('לא ניתן לגשת לגיליון. בדוק את ההרשאות.')
  }
}

// קבלת נתונים מטאב בגיליון
export async function getSheetData(
  spreadsheetId: string, 
  sheetName: string, 
  accessToken: string,
  range = 'A:Z'
): Promise<string[][]> {
  try {
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    const data: SheetData = response.data
    return data.values || []
  } catch (error) {
    // console.error('שגיאה בקבלת נתוני הגיליון:', error)
    throw new Error('לא ניתן לקרוא נתונים מהגיליון')
  }
}

// עדכון סטטוס בגיליון
export async function updateCandidateStatus(
  spreadsheetId: string,
  sheetName: string,
  rowId: string,
  status: string,
  accessToken: string
): Promise<boolean> {
  try {
    // חילוץ מספר השורה מהrowId
    const rowNumber = parseInt(rowId.split('_')[1])
    const statusColumn = 'J' // עמודה J = סטטוס

    await axios.put(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${statusColumn}${rowNumber}`,
      {
        values: [[status]]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          valueInputOption: 'USER_ENTERED'
        }
      }
    )

    return true
  } catch (error) {
    // console.error('שגיאה בעדכון סטטוס:', error)
    return false
  }
}

// בדיקת תקינות גיליון
export async function validateSheetStructure(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ isValid: boolean, errors: string[] }> {
  try {
    const data = await getSheetData(spreadsheetId, sheetName, accessToken, 'A1:AK1')
    
    if (data.length === 0) {
      return { isValid: false, errors: ['הגיליון ריק'] }
    }

    const headers = data[0]
    const requiredHeaders = ['מזהה מספרי', 'שם', 'תאריך לידה', 'גיל', 'טווח גיל מועדף', 'מצב משפחתי', 'האם פתוחה להצעות בסטטוס או עדה אחרת?', 'מגזר', 'עדה', 'רמה דתית', 'השתייכות לזרם דתי', 'מספר אחים ואחיות', 'סדר לידה במשפחה', 'מקום מגורים', 'השכלה', 'מקצוע', 'שפות מדוברות', 'גובה', 'מראה חיצוני', 'סגנון לבוש', 'עישון', 'תחביבים', 'ערכים ואמונות', 'מאפייני אישיות', 'סגנון חיים', 'גמישות לשינויים', 'שימוש באינטרנט ורשתות חברתית', 'השקפתך בנושא חינוך ילדים', 'כמה משפטים על עצמי', 'כמה משפטים על מה אני מחפש', 'דברים שחשובים לי שיהיו בבן/ת זוגי', 'דברים שחשובים לי שלא יהיו בבן/ת זוגי', 'העדפות נוספות/הערות', 'מוצע עכשיו', 'הוצעו בעבר', 'כתובת מייל ליצירת קשר', 'טלפון ליצירת קשר']
    const errors: string[] = []

    requiredHeaders.forEach((requiredHeader, index) => {
      if (!headers[index] || headers[index].trim() === '') {
        errors.push(`חסרה כותרת בעמודה ${String.fromCharCode(65 + index)}: ${requiredHeader}`)
      }
    })

    return { 
      isValid: errors.length === 0,
      errors
    }
  } catch (error) {
    return {
      isValid: false,
      errors: ['לא ניתן לגשת לגיליון או לקרוא ממנו']
    }
  }
}

// הגדרת מבנה המועמד על פי הגיליון החדש
export interface DetailedCandidate {
  id: string
  name: string
  birthDate?: string
  age: number
  preferredAgeRange?: string
  maritalStatus: string
  openToOtherSectors?: string
  sector: string
  community: string // עדה
  religiousLevel: string
  religiousStream?: string
  siblings?: number
  birthOrder?: number
  location: string
  education: string
  profession: string
  languages?: string
  height?: string
  appearance?: string
  dressStyle?: string
  smoking?: string
  hobbies?: string
  valuesAndBeliefs?: string
  personality?: string
  lifestyle?: string
  flexibility?: string
  internetUsage?: string
  educationViews?: string
  aboutMe?: string
  familyBackground?: string
  rqcMishpahti?: string
  lookingFor?: string
  importantQualities?: string
  dealBreakers?: string
  additionalNotes?: string
  // contact?: string // השדה הזה הוסר לפי התבנית הקבועה החדשה
  currentlyProposed?: string
  previouslyProposed?: string
  // שדות חדשים עבור יצירת קשר
  email?: string
  phone?: string
}

interface ColumnMapping {
  id: number;
  name: number;
  birthDate: number;
  age: number;
  preferredAgeRange: number;
  maritalStatus: number;
  openToOtherSectors: number;
  sector: number;
  community: number;
  religiousLevel: number;
  religiousStream: number;
  siblings: number;
  birthOrder: number;
  location: number;
  education: number;
  profession: number;
  languages: number;
  height: number;
  appearance: number;
  dressStyle: number;
  smoking: number;
  hobbies: number;
  valuesAndBeliefs: number;
  personality: number;
  lifestyle: number;
  flexibility: number;
  internetUsage: number;
  educationViews: number;
  aboutMe: number;
  lookingFor: number;
  importantQualities: number;
  dealBreakers: number;
  additionalNotes: number;
  // השדה 'contact' הוסר מכיוון שאינו מופיע בתבנית הקבועה החדשה
  currentlyProposed: number;
  previouslyProposed: number;
  email: number;
  phone: number;
}

// פונקציה עוזרת לקריאה בטוחה של ערכים מהמערך
const safeGetValue = (row: string[], index: number): string => {
  return row[index]?.trim() || ''
}

const safeGetNumber = (row: string[], index: number): number | undefined => {
  const value = safeGetValue(row, index)
  const parsed = parseInt(value)
  return isNaN(parsed) ? undefined : parsed
}

// מיפוי עמודות דינמי לפי כותרות
const createColumnMapping = (): ColumnMapping => {
  // console.log('🗂️ יוצר מיפוי עמודות קבוע לפי תבנית מוגדרת מראש.')

  const mapping: ColumnMapping = {
    // שדות בסיסיים - מיקומים קבועים בתבנית החדשה
    id: 0, // מזהה מספרי
    name: 1, // שם
    birthDate: 2, // תאריך לידה
    age: 3, // גיל
    preferredAgeRange: 4, // טווח גיל מועדף
    maritalStatus: 5, // מצב משפחתי
    openToOtherSectors: 6, // האם פתוחה להצעות בסטטוס או עדה אחרת?
    sector: 7, // מגזר
    community: 8, // עדה
    religiousLevel: 9, // רמה דתית
    religiousStream: 10, // השתייכות לזרם דתי
    siblings: 11, // מספר אחים ואחיות
    birthOrder: 12, // סדר לידה במשפחה
    location: 13, // מקום מגורים
    education: 14, // השכלה
    profession: 15, // מקצוע
    languages: 16, // שפות מדוברות
    height: 17, // גובה
    appearance: 18, // מראה חיצוני
    dressStyle: 19, // סגנון לבוש
    smoking: 20, // עישון
    
    // שדות טקסט מורחבים - מיקומים קבועים
    hobbies: 21, // תחביבים
    valuesAndBeliefs: 22, // ערכים ואמונות
    personality: 23, // מאפייני אישיות
    lifestyle: 24, // סגנון חיים
    flexibility: 25, // גמישות לשינויים
    internetUsage: 26, // שימוש באינטרנט ורשתות חברתיות
    educationViews: 27, // השקפתך בנושא חינוך ילדים
    aboutMe: 28, // כמה משפטים על עצמי
    lookingFor: 29, // כמה משפטים על מה אני מחפש
    importantQualities: 30, // דברים שחשובים לי שיהיו בבן/ת זוגי
    dealBreakers: 31, // דברים שחשובים לי שלא יהיו בבן/ת זוגי
    additionalNotes: 32, // העדפות נוספות/הערות
    
    // שדות קשר וניהול - מיקומים קבועים
    currentlyProposed: 33, // מוצע עכשיו
    previouslyProposed: 34, // הוצעו בעבר
    email: 35, // כתובת מייל ליצירת קשר
    phone: 36, // טלפון ליצירת קשר
  }
  
  // console.log('📋 מיפוי עמודות קבוע שנוצר:')
  // אין צורך להדפיס את הכותרות כי המיפוי קבוע לפי אינדקס
  // console.log({
  //   email: `עמודה ${mapping.email}`,
  //   phone: `עמודה ${mapping.phone}`,
  //   previouslyProposed: `עמודה ${mapping.previouslyProposed}`,
  //   currentlyProposed: `עמודה ${mapping.currentlyProposed}`
  // })
  
  return mapping
}

const parseCandidateFixed = (row: string[], _gender: 'male' | 'female', _rowIndex: number, _headers: string[] = []): DetailedCandidate | null => {
  if (!row || row.length < 5) return null
  
  // יצירת מיפוי קבוע
  const cols = createColumnMapping()

  // קריאת שם וגיל בסיסיים
  const name = safeGetValue(row, cols.name)
  const age = safeGetNumber(row, cols.age) || 0

  if (!name || !age) return null

  // מיפוי קבוע לפי אינדקס העמודה
  const candidate: DetailedCandidate = {
    id: safeGetValue(row, cols.id),
    name: name,
    birthDate: safeGetValue(row, cols.birthDate),
    age: age,
    preferredAgeRange: safeGetValue(row, cols.preferredAgeRange),
    maritalStatus: safeGetValue(row, cols.maritalStatus),
    openToOtherSectors: safeGetValue(row, cols.openToOtherSectors),
    sector: safeGetValue(row, cols.sector),
    community: safeGetValue(row, cols.community),
    religiousLevel: safeGetValue(row, cols.religiousLevel),
    religiousStream: safeGetValue(row, cols.religiousStream),
    siblings: safeGetNumber(row, cols.siblings),
    birthOrder: safeGetNumber(row, cols.birthOrder),
    location: safeGetValue(row, cols.location),
    education: safeGetValue(row, cols.education),
    profession: safeGetValue(row, cols.profession),
    languages: safeGetValue(row, cols.languages),
    height: safeGetValue(row, cols.height),
    appearance: safeGetValue(row, cols.appearance),
    dressStyle: safeGetValue(row, cols.dressStyle),
    smoking: safeGetValue(row, cols.smoking),
    hobbies: safeGetValue(row, cols.hobbies),
    valuesAndBeliefs: safeGetValue(row, cols.valuesAndBeliefs),
    personality: safeGetValue(row, cols.personality),
    lifestyle: safeGetValue(row, cols.lifestyle),
    flexibility: safeGetValue(row, cols.flexibility),
    internetUsage: safeGetValue(row, cols.internetUsage),
    educationViews: safeGetValue(row, cols.educationViews),
    aboutMe: safeGetValue(row, cols.aboutMe),
    lookingFor: safeGetValue(row, cols.lookingFor),
    importantQualities: safeGetValue(row, cols.importantQualities),
    dealBreakers: safeGetValue(row, cols.dealBreakers),
    additionalNotes: safeGetValue(row, cols.additionalNotes),
    currentlyProposed: safeGetValue(row, cols.currentlyProposed),
    previouslyProposed: safeGetValue(row, cols.previouslyProposed),
    email: safeGetValue(row, cols.email),
    phone: safeGetValue(row, cols.phone)
  }



  return candidate
}

// פונקציה לטעינת מועמדים מהגיליון - עם טעינת כותרות לפרסור נכון
export const loadCandidatesFromSheet = async (
  accessToken: string, 
  spreadsheetId: string
): Promise<{ males: DetailedCandidate[], females: DetailedCandidate[] }> => {
  // console.log('🔄 מתחיל טעינת מועמדים מהגיליון:', spreadsheetId)

  try {
    // הגדרת headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // טעינת כותרות בנים
    // console.log('📥 טוען כותרות בנים...')
    const boysHeadersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנים!A1:AK1`,
      { headers }
    )

    if (!boysHeadersResponse.ok) {
      throw new Error(`שגיאה בטעינת כותרות בנים: ${boysHeadersResponse.status} ${boysHeadersResponse.statusText}`)
    }

    const boysHeadersData = await boysHeadersResponse.json()
    const boysHeaders = boysHeadersData.values?.[0] || []

    // המתנה בין הבקשות
    // console.log('⏳ ממתין בין בקשות...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // טעינת בנים - טווח A עד AK
    // console.log('📥 טוען נתוני בנים...')
    const boysResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנים!A2:AK100`,
      { headers }
    )

    if (!boysResponse.ok) {
      if (boysResponse.status === 429) {
        // console.log('⏳ Rate limit - ממתין 2 שניות...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // ניסיון נוסף
        const retryResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנים!A2:AK100`,
          { headers }
        )
        if (!retryResponse.ok) {
          throw new Error(`שגיאה בטעינת נתוני בנים: ${retryResponse.status} ${retryResponse.statusText}`)
        }
        var boysData = await retryResponse.json()
      } else {
        throw new Error(`שגיאה בטעינת נתוני בנים: ${boysResponse.status} ${boysResponse.statusText}`)
      }
    } else {
      var boysData = await boysResponse.json()
    }

    // המתנה בין הבקשות
    // console.log('⏳ ממתין בין בקשות...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // טעינת כותרות בנות
    // console.log('📥 טוען כותרות בנות...')
    const girlsHeadersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנות!A1:AK1`,
      { headers }
    )

    if (!girlsHeadersResponse.ok) {
      throw new Error(`שגיאה בטעינת כותרות בנות: ${girlsHeadersResponse.status} ${girlsHeadersResponse.statusText}`)
    }

    const girlsHeadersData = await girlsHeadersResponse.json()
    const girlsHeaders = girlsHeadersData.values?.[0] || []

    // המתנה בין הבקשות
    // console.log('⏳ ממתין בין בקשות...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // טעינת בנות
    // console.log('📥 טוען נתוני בנות...')
    const girlsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנות!A2:AK100`,
      { headers }
    )

    if (!girlsResponse.ok) {
      if (girlsResponse.status === 429) {
        // console.log('⏳ Rate limit - ממתין 2 שניות...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // ניסיון נוסף
        const retryResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנות!A2:AK100`,
          { headers }
        )
        if (!retryResponse.ok) {
          throw new Error(`שגיאה בטעינת נתוני בנות: ${retryResponse.status} ${retryResponse.statusText}`)
        }
        var girlsData = await retryResponse.json()
      } else {
        throw new Error(`שגיאה בטעינת נתוני בנות: ${girlsResponse.status} ${girlsResponse.statusText}`)
      }
    } else {
      var girlsData = await girlsResponse.json()
    }

    // עיבוד הנתונים לפי מיקום עמודות קבוע
    const males = (boysData.values || []).map((row: string[], index: number) => 
      parseCandidateFixed(row, 'male', index, boysHeaders)
    ).filter(Boolean) as DetailedCandidate[]
    
    const females = (girlsData.values || []).map((row: string[], index: number) => 
      parseCandidateFixed(row, 'female', index, girlsHeaders)
    ).filter(Boolean) as DetailedCandidate[]

    // console.log(`✅ נטענו בהצלחה: ${males.length} בנים, ${females.length} בנות`)

    return { males, females }

  } catch (error) {
    // console.error('❌ שגיאה בטעינת מועמדים:', error)
    throw new Error(`Failed to fetch sheet data: ${error}`)
  }
}

// שלב 1: סינון קשיח (Hard Filters) - ללא GPT
export const applyHardFilters = (
  male: DetailedCandidate, 
  female: DetailedCandidate,
  hardFilters?: { maxAgeDifference: number, respectReligiousLevel: boolean, respectCommunityPreference: boolean, respectDealBreakers: boolean }
): boolean => {
  console.log(`🔍 בודק סינון קשיח: ${male.name} - ${female.name}`)
  
  // ברירת מחדל אם לא מועברות הגדרות
  const maxAgeDiff = hardFilters?.maxAgeDifference || 5
  const respectCommunityPreference = hardFilters?.respectCommunityPreference ?? true
  const respectReligiousLevel = hardFilters?.respectReligiousLevel ?? true
  const respectDealBreakers = hardFilters?.respectDealBreakers ?? true
  
  // 1. פער גיל מקסימלי (מותאם לפי הגדרות)
  const ageDiff = Math.abs(male.age - female.age)
  if (ageDiff > maxAgeDiff) {
    console.log(`❌ פער גיל גדול מדי: ${ageDiff} שנים (מקסימום: ${maxAgeDiff})`)
    return false
  }

  // משתנים לשימוש בבדיקות שונות
  const maleMaritalStatus = male.maritalStatus?.toLowerCase() || ''
  const femaleMaritalStatus = female.maritalStatus?.toLowerCase() || ''
  const maleCommunity = male.community?.toLowerCase() || ''
  const femaleCommunity = female.community?.toLowerCase() || ''

  // 2. סטטוס משפחתי (מותאם לפי הגדרות)
  if (respectReligiousLevel) {
    // אם המועמדת מחפשת רק רווק והבחור גרוש
    if (female.lookingFor?.includes('רווק') && maleMaritalStatus.includes('גרוש')) {
      console.log(`❌ המועמדת מחפשת רווק והבחור גרוש`)
      return false
    }
    
    // אם הבחור מחפש רק רווקה והמועמדת גרושה
    if (male.lookingFor?.includes('רווק') && femaleMaritalStatus.includes('גרוש')) {
      console.log(`❌ הבחור מחפש רווקה והמועמדת גרושה`)
      return false
    }
  }

  // 3. התאמה מגזרית/עדתית (מותאם לפי הגדרות)
  if (respectCommunityPreference) {
    
    // אם המועמדת מחפשת ספציפית אשכנזי והבחור ספרדי
    if (female.lookingFor?.includes('אשכנזי') && maleCommunity.includes('ספרדי')) {
      console.log(`❌ המועמדת מחפשת אשכנזי והבחור ספרדי`)
      return false
    }
    
    // אם המועמדת מחפשת ספציפית ספרדי והבחור אשכנזי
    if (female.lookingFor?.includes('ספרדי') && maleCommunity.includes('אשכנזי')) {
      console.log(`❌ המועמדת מחפשת ספרדי והבחור אשכנזי`)
      return false
    }
    
    // אם הבחור מחפש ספציפית אשכנזית והמועמדת ספרדית
    if (male.lookingFor?.includes('אשכנזי') && femaleCommunity.includes('ספרדי')) {
      console.log(`❌ הבחור מחפש אשכנזית והמועמדת ספרדית`)
      return false
    }
  }

  // 4. בדיקת דיל ברייקרס (מותאם לפי הגדרות)
  if (respectDealBreakers && male.dealBreakers) {
    const dealBreakers = male.dealBreakers.toLowerCase()
    if (dealBreakers.includes('ספרדי') && femaleCommunity.includes('ספרדי')) {
      console.log(`❌ הבחור לא רוצה ספרדית והמועמדת ספרדית`)
      return false
    }
    if (dealBreakers.includes('גרוש') && femaleMaritalStatus.includes('גרוש')) {
      console.log(`❌ הבחור לא רוצה גרושה והמועמדת גרושה`)
      return false
    }
  }

  if (respectDealBreakers && female.dealBreakers) {
    const dealBreakers = female.dealBreakers.toLowerCase()
    if (dealBreakers.includes('ספרדי') && maleCommunity.includes('ספרדי')) {
      console.log(`❌ המועמדת לא רוצה ספרדי והבחור ספרדי`)
      return false
    }
    if (dealBreakers.includes('גרוש') && maleMaritalStatus.includes('גרוש')) {
      console.log(`❌ המועמדת לא רוצה גרוש והבחור גרוש`)
      return false
    }
  }

  console.log(`✅ עבר סינון קשיח: ${male.name} - ${female.name}`)
  return true
}

// שלב 2: ניקוד לוגי (Logical Scoring) - ציון 0-10 עם משקולות מותאמות
export const calculateLogicalScore = (
  male: DetailedCandidate,
  female: DetailedCandidate,
  weights?: { age: number, location: number, religiousLevel: number, education: number, profession: number, familyBackground: number }
): number => {
  // ברירת מחדל של משקולות אם לא מועברות
  const defaultWeights = { age: 8, location: 6, religiousLevel: 9, education: 5, profession: 4, familyBackground: 7 }
  const w = weights || defaultWeights
  let score = 0

  // 1. ניקוד גיל (עם משקל מותאם)
  const ageDiff = Math.abs(male.age - female.age)
  let ageScore = 0
  if (ageDiff <= 2) {
    ageScore = 2
  } else if (ageDiff <= 5) {
    ageScore = 1
  }
  score += (ageScore * w.age) / 5 // נורמליזציה ל-10 נקודות

  // 2. ניקוד רמה דתית (עם משקל מותאם)
  const maleReligious = (male.religiousLevel || '').toLowerCase().trim()
  const femaleReligious = (female.religiousLevel || '').toLowerCase().trim()
  let religiousScore = 0
  if (maleReligious === femaleReligious) {
    religiousScore = 2
  } else if (areReligiousLevelsCompatible(maleReligious, femaleReligious)) {
    religiousScore = 1
  }
  score += (religiousScore * w.religiousLevel) / 5

  // 3. ניקוד מקום מגורים (עם משקל מותאם)
  const maleLocation = male.location || ''
  const femaleLocation = female.location || ''
  let locationScore = 0
  if (maleLocation.toLowerCase().trim() === femaleLocation.toLowerCase().trim()) {
    locationScore = 2
  } else if (areLocationsNear(maleLocation, femaleLocation)) {
    locationScore = 1
  }
  score += (locationScore * w.location) / 5

  // 4. ניקוד השכלה (עם משקל מותאם)
  const maleEducation = (male.education || '').toLowerCase().trim()
  const femaleEducation = (female.education || '').toLowerCase().trim()
  let educationScore = 0
  if (maleEducation === femaleEducation) {
    educationScore = 2
  } else if (areEducationLevelsCompatible(maleEducation, femaleEducation)) {
    educationScore = 1
  }
  score += (educationScore * w.education) / 5

  // 5. ניקוד מקצוע (עם משקל מותאם)
  const maleProfession = (male.profession || '').toLowerCase().trim()
  const femaleProfession = (female.profession || '').toLowerCase().trim()
  let professionScore = 0
  if (maleProfession === femaleProfession) {
    professionScore = 2
  } else if (areProfessionsCompatible(maleProfession, femaleProfession)) {
    professionScore = 1
  }
  score += (professionScore * w.profession) / 5

  // 6. ניקוד רקע משפחתי (עם משקל מותאם)
  const maleFamilyBackground = (male.familyBackground || '').toLowerCase().trim()
  const femaleFamilyBackground = (female.familyBackground || '').toLowerCase().trim()
  let familyScore = 0
  if (maleFamilyBackground === femaleFamilyBackground) {
    familyScore = 2
  } else if (countSharedWords(maleFamilyBackground, femaleFamilyBackground) >= 1) {
    familyScore = 1
  }
  score += (familyScore * w.familyBackground) / 5

  return Math.min(score, 10) // מגביל ל-10 מקסימום
}

// פונקציה מפורטת שמחזירה גם פירוט החישוב (לדיבוג)
export const calculateLogicalScoreDetailed = (
  male: DetailedCandidate,
  female: DetailedCandidate,
  weights?: { age: number, location: number, religiousLevel: number, education: number, profession: number, familyBackground: number }
): { score: number, breakdown: any } => {
  const defaultWeights = { age: 8, location: 6, religiousLevel: 9, education: 5, profession: 4, familyBackground: 7 }
  const w = weights || defaultWeights
  let score = 0
  const breakdown: any = {}

  // 1. גיל
  const ageDiff = Math.abs(male.age - female.age)
  let ageScore = 0
  if (ageDiff <= 2) ageScore = 2
  else if (ageDiff <= 5) ageScore = 1
  const agePoints = (ageScore * w.age) / 5
  score += agePoints
  breakdown.age = {
    malAge: male.age,
    femaleAge: female.age,
    diff: ageDiff,
    baseScore: ageScore,
    weight: w.age,
    points: agePoints.toFixed(2)
  }

  // 2. רמה דתית
  const maleReligious = (male.religiousLevel || '').toLowerCase().trim()
  const femaleReligious = (female.religiousLevel || '').toLowerCase().trim()
  let religiousScore = 0
  if (maleReligious === femaleReligious) religiousScore = 2
  else if (areReligiousLevelsCompatible(maleReligious, femaleReligious)) religiousScore = 1
  const religiousPoints = (religiousScore * w.religiousLevel) / 5
  score += religiousPoints
  breakdown.religious = {
    male: maleReligious || 'לא צוין',
    female: femaleReligious || 'לא צוין',
    baseScore: religiousScore,
    weight: w.religiousLevel,
    points: religiousPoints.toFixed(2)
  }

  // 3. מיקום
  const maleLocation = male.location || ''
  const femaleLocation = female.location || ''
  let locationScore = 0
  if (maleLocation.toLowerCase().trim() === femaleLocation.toLowerCase().trim()) locationScore = 2
  else if (areLocationsNear(maleLocation, femaleLocation)) locationScore = 1
  const locationPoints = (locationScore * w.location) / 5
  score += locationPoints
  breakdown.location = {
    male: maleLocation || 'לא צוין',
    female: femaleLocation || 'לא צוין',
    baseScore: locationScore,
    weight: w.location,
    points: locationPoints.toFixed(2)
  }

  // 4. השכלה
  const maleEducation = (male.education || '').toLowerCase().trim()
  const femaleEducation = (female.education || '').toLowerCase().trim()
  let educationScore = 0
  if (maleEducation === femaleEducation) educationScore = 2
  else if (areEducationLevelsCompatible(maleEducation, femaleEducation)) educationScore = 1
  const educationPoints = (educationScore * w.education) / 5
  score += educationPoints
  breakdown.education = {
    male: maleEducation || 'לא צוין',
    female: femaleEducation || 'לא צוין',
    baseScore: educationScore,
    weight: w.education,
    points: educationPoints.toFixed(2)
  }

  // 5. מקצוע
  const maleProfession = (male.profession || '').toLowerCase().trim()
  const femaleProfession = (female.profession || '').toLowerCase().trim()
  let professionScore = 0
  if (maleProfession === femaleProfession) professionScore = 2
  else if (areProfessionsCompatible(maleProfession, femaleProfession)) professionScore = 1
  const professionPoints = (professionScore * w.profession) / 5
  score += professionPoints
  breakdown.profession = {
    male: maleProfession || 'לא צוין',
    female: femaleProfession || 'לא צוין',
    baseScore: professionScore,
    weight: w.profession,
    points: professionPoints.toFixed(2)
  }

  // 6. רקע משפחתי
  const maleFamilyBackground = (male.familyBackground || '').toLowerCase().trim()
  const femaleFamilyBackground = (female.familyBackground || '').toLowerCase().trim()
  let familyScore = 0
  if (maleFamilyBackground === femaleFamilyBackground) familyScore = 2
  else if (countSharedWords(maleFamilyBackground, femaleFamilyBackground) >= 1) familyScore = 1
  const familyPoints = (familyScore * w.familyBackground) / 5
  score += familyPoints
  breakdown.family = {
    male: maleFamilyBackground || 'לא צוין',
    female: femaleFamilyBackground || 'לא צוין',
    baseScore: familyScore,
    weight: w.familyBackground,
    points: familyPoints.toFixed(2)
  }

  return { score: Math.min(score, 10), breakdown }
}

// פונקציות עזר מתקדמות

// פונקציית עזר - סופרת מילים משותפות בין שני מחרוזות
const countSharedWords = (stringA: string, stringB: string): number => {
  if (!stringA || !stringB) return 0
  
  const wordsA = stringA.toLowerCase().split(/[\s,]+/).filter(word => word.length > 2)
  const wordsB = stringB.toLowerCase().split(/[\s,]+/).filter(word => word.length > 2)
  
  const sharedWords = wordsA.filter(word => wordsB.includes(word))
  return sharedWords.length
}

// פונקציית עזר - בודקת אם שני מיקומים קרובים זה לזה
const areLocationsNear = (locationA: string, locationB: string): boolean => {
  if (!locationA || !locationB) return false
  
  const locA = locationA.toLowerCase().trim()
  const locB = locationB.toLowerCase().trim()
  
  // מיפוי אזורים סמוכים - כמו בקוד שלך
  const nearbyAreas: Record<string, string[]> = {
    'ירושלים': ['בית שמש', 'מעלה אדומים', 'גבעת זאב'],
    'בית שמש': ['ירושלים', 'מודיעין', 'בית שמש'],
    'תל אביב': ['גבעתיים', 'רמת גן', 'בני ברק', 'חולון', 'בת ים'],
    'גבעתיים': ['תל אביב', 'רמת גן'],
    'רמת גן': ['תל אביב', 'גבעתיים', 'בני ברק'],
    'בני ברק': ['תל אביב', 'רמת גן', 'פתח תקווה'],
    'פתח תקווה': ['בני ברק', 'רמת גן'],
    'חיפה': ['קרית אתא', 'קרית ביאליק', 'קרית ים'],
    'נתניה': ['רעננה', 'כפר סבא', 'הרצליה'],
    'רעננה': ['נתניה', 'כפר סבא', 'הרצליה'],
    'כפר סבא': ['נתניה', 'רעננה', 'הרצליה'],
    'מודיעין': ['בית שמש', 'ירושלים']
  }
  
  return nearbyAreas[locA]?.includes(locB) || nearbyAreas[locB]?.includes(locA) || false
}

// פונקציית עזר - בודקת תואמות רמות דתיות
const areReligiousLevelsCompatible = (level1: string, level2: string): boolean => {
  // נרמול - הכל לאותיות קטנות
  const l1 = level1.toLowerCase()
  const l2 = level2.toLowerCase()

  // מיפוי מילות מפתח לקטגוריות
  const religiousKeywords = {
    charedi: ['חרדי', 'חרד', 'ישיבתי', 'ישיב', 'קולל', 'שמרני מאוד'],
    dati: ['דתי', 'דת', 'לאומי', 'מודרני', 'ציוני', 'כיפה'],
    masorti: ['מסורתי', 'מסורת', 'מחזיק מצוות', 'שומר מסורת'],
    chiloni: ['חילוני', 'חילונ', 'לא דתי', 'פתוח', 'פתיח', 'לא שמרני', 'לא שמרנ'],
    flexible: ['גמיש', 'פתוח', 'מתון', 'בראש טוב', 'לא מידאי', 'במידה']
  }

  // זיהוי הקטגוריה של כל רמה
  const detectCategory = (text: string): string[] => {
    const categories: string[] = []
    if (religiousKeywords.charedi.some(kw => text.includes(kw))) categories.push('charedi')
    if (religiousKeywords.dati.some(kw => text.includes(kw))) categories.push('dati')
    if (religiousKeywords.masorti.some(kw => text.includes(kw))) categories.push('masorti')
    if (religiousKeywords.chiloni.some(kw => text.includes(kw))) categories.push('chiloni')
    if (religiousKeywords.flexible.some(kw => text.includes(kw))) categories.push('flexible')
    return categories
  }

  const cats1 = detectCategory(l1)
  const cats2 = detectCategory(l2)

  // אם שניהם גמישים - תואם
  if (cats1.includes('flexible') && cats2.includes('flexible')) return true

  // אם אחד גמיש והשני לא קיצוני - תואם
  if (cats1.includes('flexible') || cats2.includes('flexible')) {
    // גמיש תואם לכולם חוץ מחרדי קיצוני
    const nonFlexible = cats1.includes('flexible') ? cats2 : cats1
    if (!nonFlexible.includes('charedi')) return true
  }

  // קבוצות תואמות
  const compatibleGroups = [
    ['charedi'],
    ['dati', 'masorti'],
    ['masorti', 'chiloni'],
    ['chiloni']
  ]

  for (const group of compatibleGroups) {
    const in1 = cats1.some(cat => group.includes(cat))
    const in2 = cats2.some(cat => group.includes(cat))
    if (in1 && in2) return true
  }

  return false
}

// שלב 3: בדיקה אם זוג עובר את הסף הלוגי
export const passesLogicalThreshold = (score: number, threshold: number = 4): boolean => {
  const passed = score >= threshold
  // console.log(`${passed ? '✅' : '❌'} ציון ${score.toFixed(1)} vs סף ${threshold} -> ${passed ? 'עובר' : 'נכשל'}`)
  return passed
}

// פונקציות עזר נוספות להתאמה מתקדמת

// בדיקת תואמות רמות השכלה
const areEducationLevelsCompatible = (education1: string, education2: string): boolean => {
  const compatibleGroups = [
    ['תיכון', 'תעודת בגרות', 'סיום תיכון'],
    ['תעודה', 'קורס מקצועי', 'הכשרה מקצועית'],
    ['תואר ראשון', 'בוגר אוניברסיטה', 'תואר'],
    ['תואר שני', 'מוסמך', 'מגיסטר'],
    ['תואר שלישי', 'דוקטור', 'פרופסור']
  ]
  
  for (const group of compatibleGroups) {
    if (group.some(level => education1.includes(level)) && 
        group.some(level => education2.includes(level))) {
      return true
    }
  }
  return false
}

// בדיקת תואמות מקצועות
const areProfessionsCompatible = (profession1: string, profession2: string): boolean => {
  const compatibleGroups = [
    ['רופא', 'רפואה', 'רפואי'],
    ['עורך דין', 'משפטי', 'משפטים'],
    ['מהנדס', 'הנדסה', 'טכנולוגיה'],
    ['מורה', 'חינוך', 'הוראה'],
    ['רו"ח', 'כלכלה', 'חשבונאות'],
    ['מעצב', 'אמנות', 'יצירה'],
    ['מחשבים', 'תוכנה', 'היי-טק']
  ]
  
  for (const group of compatibleGroups) {
    if (group.some(prof => profession1.includes(prof)) && 
        group.some(prof => profession2.includes(prof))) {
      return true
    }
  }
  return false
}

// הסרת checkBasicCompatibility הישנה - נחליף אותה בפונקציות החדשות
export { applyHardFilters as checkBasicCompatibility } 