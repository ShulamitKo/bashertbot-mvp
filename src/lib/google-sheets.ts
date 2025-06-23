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