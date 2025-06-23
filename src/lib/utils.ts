import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// פונקציות עזר עבור תאריכים
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// פונקציה לחישוב גיל
export function calculateAge(birthDate: string | Date): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

// פונקציה לבדיקת גיל תקין
export function isValidAge(age: number): boolean {
  return age >= 18 && age <= 120
}

// פונקציה לטיהור נתונים
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ')
}

// פונקציה להמרת ציון התאמה לאחוזים
export function scoreToPercentage(score: number): number {
  return Math.round(score * 100)
}

// פונקציה לקבלת צבע לפי ציון
export function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.6) return 'text-blue-600'
  if (score >= 0.4) return 'text-yellow-600'
  return 'text-red-600'
}

// פונקציה לקבלת תרגום סטטוס
export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'ממתין לבדיקה',
    'approved': 'אושר',
    'rejected': 'נדחה',
    'in_progress': 'בתהליך',
    'completed': 'הושלם',
    'closed': 'סגור'
  }
  return statusMap[status] || status
}

// פונקציה לטיפול בשגיאות
export function handleError(error: any): string {
  if (error?.message) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'אירעה שגיאה לא צפויה'
} 