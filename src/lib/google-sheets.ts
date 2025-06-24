import axios from 'axios'
import { Candidate } from '@/types'

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
    console.error('שגיאה בקבלת טאבי הגיליון:', error)
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
    console.error('שגיאה בקבלת נתוני הגיליון:', error)
    throw new Error('לא ניתן לקרוא נתונים מהגיליון')
  }
}

// המרת נתוני גיליון למועמדים
export function parseSheetToCandidates(sheetData: string[][], gender: 'male' | 'female'): Candidate[] {
  if (sheetData.length < 2) {
    return []
  }

  const headers = sheetData[0]
  const rows = sheetData.slice(1)

  return rows.map((row, index) => {
    const candidate: Candidate = {
      rowId: `${gender}_${index + 2}`, // שורה 2 ואילך (שורה 1 זה כותרות)
      name: row[0] || '',
      age: parseInt(row[1]) || 0,
      city: row[2] || '',
      edah: row[3] || '',
      education: row[4] || '',
      profession: row[5] || '',
      familyBackground: row[6] || '',
      lookingFor: row[7] || '',
      notes: row[8] || '',
      status: (row[9] as any) || 'זמין'
    }

    // הוספת שדות נוספים לפי הכותרות
    headers.forEach((header, colIndex) => {
      if (colIndex > 9 && row[colIndex]) {
        candidate[header] = row[colIndex]
      }
    })

    return candidate
  }).filter(candidate => candidate.name.trim() !== '') // סינון שורות ריקות
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
    console.error('שגיאה בעדכון סטטוס:', error)
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
    const data = await getSheetData(spreadsheetId, sheetName, accessToken, 'A1:J1')
    
    if (data.length === 0) {
      return { isValid: false, errors: ['הגיליון ריק'] }
    }

    const headers = data[0]
    const requiredHeaders = ['שם', 'גיל', 'עיר', 'עדה', 'השכלה', 'מקצוע', 'רקע משפחתי', 'מחפש/ת', 'הערות', 'סטטוס']
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

// טעינת מועמדים מכל הטאבים
export async function loadAllCandidates(
  spreadsheetId: string,
  boysSheetName: string,
  girlsSheetName: string,
  accessToken: string
): Promise<{ boys: Candidate[], girls: Candidate[], errors: string[] }> {
  const errors: string[] = []
  let boys: Candidate[] = []
  let girls: Candidate[] = []

  try {
    // טעינת בנים
    const boysData = await getSheetData(spreadsheetId, boysSheetName, accessToken)
    boys = parseSheetToCandidates(boysData, 'male')
  } catch (error) {
    errors.push(`שגיאה בטעינת טאב הבנים: ${error}`)
  }

  try {
    // טעינת בנות
    const girlsData = await getSheetData(spreadsheetId, girlsSheetName, accessToken)
    girls = parseSheetToCandidates(girlsData, 'female')
  } catch (error) {
    errors.push(`שגיאה בטעינת טאב הבנות: ${error}`)
  }

  return { boys, girls, errors }
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
  lookingFor?: string
  importantQualities?: string
  dealBreakers?: string
  additionalNotes?: string
  contact?: string
  currentlyProposed?: string
  previouslyProposed?: string
}

// פונקציה לפרסור שורת מועמד לאובייקט
const parseCandidate = (row: string[], gender: 'male' | 'female', rowIndex: number): DetailedCandidate | null => {
  if (!row || row.length < 10) return null
  
  const [
    id, name, birthDate, age, preferredAgeRange, maritalStatus, openToOtherSectors,
    sector, community, religiousLevel, religiousStream, siblings, birthOrder,
    location, education, profession, languages, height, appearance, dressStyle,
    smoking, hobbies, valuesAndBeliefs, personality, lifestyle, flexibility,
    internetUsage, educationViews, aboutMe, lookingFor, importantQualities,
    dealBreakers, additionalNotes, contact, currentlyProposed, previouslyProposed
  ] = row

  if (!name || !age) return null

  // יצירת מזהה שורה נכון - שורה 2 ואילך (שורה 1 זה כותרות)
  const actualRowId = `${gender}_${rowIndex + 2}`

  return {
    id: actualRowId, // שימוש במזהה השורה האמיתי
    name: name.trim(),
    birthDate,
    age: parseInt(age) || 0,
    preferredAgeRange,
    maritalStatus: maritalStatus || '',
    openToOtherSectors,
    sector: sector || '',
    community: community || '',
    religiousLevel: religiousLevel || '',
    religiousStream,
    siblings: siblings ? parseInt(siblings) : undefined,
    birthOrder: birthOrder ? parseInt(birthOrder) : undefined,
    location: location || '',
    education: education || '',
    profession: profession || '',
    languages,
    height,
    appearance,
    dressStyle,
    smoking,
    hobbies,
    valuesAndBeliefs,
    personality,
    lifestyle,
    flexibility,
    internetUsage,
    educationViews,
    aboutMe,
    lookingFor,
    importantQualities,
    dealBreakers,
    additionalNotes,
    contact,
    currentlyProposed,
    previouslyProposed
  }
}

// פונקציה לטעינת מועמדים מהגיליון
export const loadCandidatesFromSheet = async (
  accessToken: string, 
  spreadsheetId: string
): Promise<{ males: DetailedCandidate[], females: DetailedCandidate[] }> => {
  console.log('🔄 מתחיל טעינת מועמדים מהגיליון:', spreadsheetId)

  try {
    // הגדרת headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // טעינת בנים עם עיכוב
    console.log('📥 טוען נתוני בנים...')
    const boysResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנים!A2:AZ100`,
      { headers }
    )

    if (!boysResponse.ok) {
      if (boysResponse.status === 429) {
        console.log('⏳ Rate limit - ממתין 2 שניות...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // ניסיון נוסף
        const retryResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנים!A2:AZ100`,
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
    console.log('⏳ ממתין בין בקשות...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // טעינת בנות
    console.log('📥 טוען נתוני בנות...')
    const girlsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנות!A2:AZ100`,
      { headers }
    )

    if (!girlsResponse.ok) {
      if (girlsResponse.status === 429) {
        console.log('⏳ Rate limit - ממתין 2 שניות...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        // ניסיון נוסף
        const retryResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/בנות!A2:AZ1000`,
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

    // עיבוד הנתונים
    const males = (boysData.values || []).map((row: string[], index: number) => parseCandidate(row, 'male', index)).filter(Boolean) as DetailedCandidate[]
    const females = (girlsData.values || []).map((row: string[], index: number) => parseCandidate(row, 'female', index)).filter(Boolean) as DetailedCandidate[]

    console.log(`✅ נטענו בהצלחה: ${males.length} בנים, ${females.length} בנות`)

    return { males, females }

  } catch (error) {
    console.error('❌ שגיאה בטעינת מועמדים:', error)
    throw new Error(`Failed to fetch sheet data: ${error}`)
  }
}

// שלב 1: סינון קשיח (Hard Filters) - ללא GPT
export const applyHardFilters = (male: DetailedCandidate, female: DetailedCandidate): boolean => {
  console.log(`🔍 בודק סינון קשיח: ${male.name} - ${female.name}`)
  
  // 1. פער גיל מקסימלי: 5 שנים
  const ageDiff = Math.abs(male.age - female.age)
  if (ageDiff > 5) {
    console.log(`❌ פער גיל גדול מדי: ${ageDiff} שנים`)
    return false
  }

  // 2. שניהם רווקים (או לפחות אחד לא מתנגד לסטטוס השני)
  const maleMaritalStatus = male.maritalStatus?.toLowerCase() || ''
  const femaleMaritalStatus = female.maritalStatus?.toLowerCase() || ''
  
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

  // 3. התאמה מגזרית/עדתית
  const maleCommunity = male.community?.toLowerCase() || ''
  const femaleCommunity = female.community?.toLowerCase() || ''
  
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

  // 4. בדיקת דיל ברייקרס
  if (male.dealBreakers) {
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

  if (female.dealBreakers) {
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

// שלב 2: ניקוד לוגי (Logical Scoring) - ציון 0-10 (כמו בקוד החכם שלך)
export const calculateLogicalScore = (male: DetailedCandidate, female: DetailedCandidate): number => {
  let score = 0
  
  // 1. ניקוד גיל (עד 2 נקודות) - כמו בקוד שלך
  const ageDiff = Math.abs(male.age - female.age)
  if (ageDiff <= 2) {
    score += 2
  } else if (ageDiff <= 5) {
    score += 1
  }
  
  // 2. ניקוד רמה דתית (עד 2 נקודות) - כמו בקוד שלך
  const maleReligious = (male.religiousLevel || '').toLowerCase().trim()
  const femaleReligious = (female.religiousLevel || '').toLowerCase().trim()
  if (maleReligious === femaleReligious) {
    score += 2
  } else if (areReligiousLevelsCompatible(maleReligious, femaleReligious)) {
    score += 1
  }
  
  // 3. ניקוד תחביבים (עד 2 נקודות) - כמו בקוד שלך
  const maleHobbies = male.hobbies || ''
  const femaleHobbies = female.hobbies || ''
  const sharedHobbies = countSharedWords(maleHobbies, femaleHobbies)
  if (sharedHobbies >= 2) {
    score += 2
  } else if (sharedHobbies >= 1) {
    score += 1
  }
  
  // 4. ניקוד ערכים ואמונות (עד 2 נקודות) - כמו בקוד שלך
  const maleValues = male.valuesAndBeliefs || ''
  const femaleValues = female.valuesAndBeliefs || ''
  const sharedValues = countSharedWords(maleValues, femaleValues)
  if (sharedValues >= 2) {
    score += 2
  } else if (sharedValues >= 1) {
    score += 1
  }
  
  // 5. ניקוד מקום מגורים (עד 2 נקודות) - כמו בקוד שלך
  const maleLocation = male.location || ''
  const femaleLocation = female.location || ''
  if (maleLocation.toLowerCase().trim() === femaleLocation.toLowerCase().trim()) {
    score += 2
  } else if (areLocationsNear(maleLocation, femaleLocation)) {
    score += 1
  }
  
  return Math.min(score, 10) // מגביל ל-10 מקסימום
}

// פונקציות עזר - כמו בקוד החכם שלך

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
  const compatibleGroups = [
    ['דתי', 'דתי לאומי', 'דתי מודרני'],
    ['מסורתי', 'מסורתי מחזיק מצוות', 'מסורתי פחות'],
    ['חילוני', 'חילוני מסורתי'],
    ['חרדי', 'חרדי לאומי']
  ]
  
  for (const group of compatibleGroups) {
    if (group.some(level => level1.includes(level)) && 
        group.some(level => level2.includes(level))) {
      return true
    }
  }
  return false
}

// שלב 3: בדיקה אם זוג עובר את הסף הלוגי
export const passesLogicalThreshold = (score: number, threshold: number = 4): boolean => {
  const passed = score >= threshold
  console.log(`${passed ? '✅' : '❌'} ציון ${score.toFixed(1)} vs סף ${threshold} -> ${passed ? 'עובר' : 'נכשל'}`)
  return passed
}

// הסרת checkBasicCompatibility הישנה - נחליף אותה בפונקציות החדשות
export { applyHardFilters as checkBasicCompatibility } 