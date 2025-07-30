import { supabase } from './supabase'
import { AdvancedMatchingSettings, getDefaultAdvancedMatchingSettings } from '@/types'

// ************ פונקציות ניהול הגדרות במסד הנתונים ************

// טעינת הגדרות השדכן מהמסד
export const loadShadchanSettings = async (shadchanId: string): Promise<AdvancedMatchingSettings> => {
  try {
    console.log(`🔍 טוען הגדרות עבור שדכן: ${shadchanId}`)
    
    const { data: shadchan, error } = await supabase
      .from('shadchanim')
      .select('advanced_matching_settings')
      .eq('id', shadchanId)
      .single()

    if (error) {
      console.warn('⚠️ שגיאה בטעינת הגדרות, משתמש בברירת מחדל:', error.message)
      return getDefaultAdvancedMatchingSettings()
    }

    // אם יש הגדרות שמורות, החזר אותן
    if (shadchan?.advanced_matching_settings) {
      console.log('✅ נטענו הגדרות מותאמות אישית')
      return {
        ...getDefaultAdvancedMatchingSettings(),
        ...shadchan.advanced_matching_settings
      }
    }

    // אחרת החזר ברירת מחדל
    console.log('📝 משתמש בהגדרות ברירת מחדל')
    return getDefaultAdvancedMatchingSettings()

  } catch (error) {
    console.error('❌ שגיאה בטעינת הגדרות השדכן:', error)
    return getDefaultAdvancedMatchingSettings()
  }
}

// שמירת הגדרות השדכן במסד
export const saveShadchanSettings = async (
  shadchanId: string, 
  settings: AdvancedMatchingSettings
): Promise<void> => {
  try {
    console.log(`💾 שומר הגדרות עבור שדכן: ${shadchanId}`)

    const { error } = await supabase
      .from('shadchanim')
      .update({
        advanced_matching_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', shadchanId)

    if (error) {
      console.error('❌ שגיאה בשמירת הגדרות:', error)
      throw error
    }

    console.log('✅ הגדרות נשמרו בהצלחה')
  } catch (error) {
    console.error('❌ שגיאה בשמירת הגדרות השדכן:', error)
    throw error
  }
}

// ************ פונקציות עזר להגדרות ************

// בדיקה אם ההגדרות שונות מברירת המחדל
export const hasCustomSettings = (settings: AdvancedMatchingSettings): boolean => {
  const defaultSettings = getDefaultAdvancedMatchingSettings()
  return JSON.stringify(settings) !== JSON.stringify(defaultSettings)
}

// מיזוג הגדרות עם ברירת מחדל (למקרים של הגדרות חלקיות)
export const mergeWithDefaults = (
  customSettings: Partial<AdvancedMatchingSettings>
): AdvancedMatchingSettings => {
  const defaults = getDefaultAdvancedMatchingSettings()
  
  return {
    ...defaults,
    ...customSettings,
    weights: {
      ...defaults.weights,
      ...customSettings.weights
    },
    hardFilters: {
      ...defaults.hardFilters,
      ...customSettings.hardFilters
    },
    advancedFilters: {
      ...defaults.advancedFilters,
      ...customSettings.advancedFilters
    },
    gptSettings: {
      ...defaults.gptSettings,
      ...customSettings.gptSettings
    },
    customGptSettings: {
      ...defaults.customGptSettings,
      ...customSettings.customGptSettings
    },
    preferences: {
      ...defaults.preferences,
      ...customSettings.preferences,
      notificationSettings: {
        ...defaults.preferences.notificationSettings,
        ...customSettings.preferences?.notificationSettings
      }
    }
  }
}

// ************ פונקציות ולידציה ************

// ולידציה של הגדרות
export const validateSettings = (settings: AdvancedMatchingSettings): string[] => {
  const errors: string[] = []

  // בדיקות בסיסיות
  if (settings.maxMatches < 1 || settings.maxMatches > 100) {
    errors.push('מספר התאמות מקסימלי חייב להיות בין 1 ל-100')
  }

  if (settings.hardFilters.maxAgeDifference < 1 || settings.hardFilters.maxAgeDifference > 20) {
    errors.push('פער גיל מקסימלי חייב להיות בין 1 ל-20 שנים')
  }

  if (settings.advancedFilters.maxDistanceKm < 1 || settings.advancedFilters.maxDistanceKm > 500) {
    errors.push('מרחק מקסימלי חייב להיות בין 1 ל-500 ק"מ')
  }

  // בדיקת משקולות
  Object.entries(settings.weights).forEach(([key, value]) => {
    if (value < 0 || value > 10) {
      const labels: Record<string, string> = {
        age: 'פער גילאים',
        location: 'מיקום',
        religiousLevel: 'רמה דתית',
        education: 'השכלה',
        profession: 'מקצוע',
        familyBackground: 'רקע משפחתי'
      }
      errors.push(`משקל ${labels[key]} חייב להיות בין 0 ל-10`)
    }
  })

  // בדיקת GPT
  if (settings.gptSettings.temperature < 0 || settings.gptSettings.temperature > 2) {
    errors.push('טמפרטורת GPT חייבת להיות בין 0 ל-2')
  }

  if (settings.gptSettings.maxTokens < 100 || settings.gptSettings.maxTokens > 4000) {
    errors.push('מספר טוקנים מקסימלי חייב להיות בין 100 ל-4000')
  }

  return errors
}

// ************ פונקציות למעקב ושיפור ************

// שמירת לוג של שימוש בהגדרות (לשיפור עתידי)
export const logSettingsUsage = async (
  shadchanId: string,
  _settingsUsed: AdvancedMatchingSettings,
  matchesFound: number,
  processingTime: number
) => {
  try {
    // ניתן להוסיף טבלת לוגים בעתיד
    console.log(`📊 נתוני שימוש - שדכן: ${shadchanId}, התאמות: ${matchesFound}, זמן: ${processingTime}ms`)
  } catch (error) {
    console.warn('⚠️ שגיאה בשמירת לוג שימוש:', error)
  }
}

// יצוא הגדרות לקובץ JSON (לגיבוי)
export const exportSettings = (settings: AdvancedMatchingSettings): string => {
  return JSON.stringify(settings, null, 2)
}

// ייבוא הגדרות מקובץ JSON
export const importSettings = (jsonString: string): AdvancedMatchingSettings => {
  try {
    const imported = JSON.parse(jsonString)
    const merged = mergeWithDefaults(imported)
    
    const errors = validateSettings(merged)
    if (errors.length > 0) {
      throw new Error(`הגדרות לא תקינות: ${errors.join(', ')}`)
    }
    
    return merged
  } catch (error) {
    console.error('❌ שגיאה בייבוא הגדרות:', error)
    throw error
  }
}