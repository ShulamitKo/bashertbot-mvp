import { supabase } from './supabase'
import { AdvancedMatchingSettings, getDefaultAdvancedMatchingSettings, SimplifiedShadchanSettings, simplifyAdvancedSettings } from '@/types'

// ************ פונקציות ניהול הגדרות במסד הנתונים ************

// טעינת הגדרות השדכן מהמסד (עם יצירה אוטומטית אם לא קיימות)
export const loadShadchanSettings = async (shadchanId: string): Promise<AdvancedMatchingSettings> => {
  try {
    console.log(`🔍 [DEBUG] טוען הגדרות עבור שדכן: ${shadchanId}`)
    
    const { data: shadchan, error } = await supabase
      .from('shadchanim')
      .select('advanced_matching_settings')
      .eq('id', shadchanId)
      .single()

    if (error) {
      console.warn('⚠️ [DEBUG] שגיאה בטעינת הגדרות, משתמש בברירת מחדל:', error.message)
      await initializeDefaultSettingsForShadchan(shadchanId)
      return getDefaultAdvancedMatchingSettings()
    }

    console.log(`📋 [DEBUG] נתונים גולמיים מהמסד:`, shadchan)

    // אם יש הגדרות שמורות, החזר אותן
    if (shadchan?.advanced_matching_settings) {
      console.log('✅ [DEBUG] נטענו הגדרות מותאמות אישית')
      const loadedSettings = {
        ...getDefaultAdvancedMatchingSettings(),
        ...shadchan.advanced_matching_settings
      }
      console.log(`📝 [DEBUG] הגדרות שנטענו:`, {
        maxMatches: loadedSettings.maxMatches,
        model: loadedSettings.gptSettings.model,
        temperature: loadedSettings.gptSettings.temperature,
        maxTokens: loadedSettings.gptSettings.maxTokens,
        focusAreas: loadedSettings.customGptSettings.focusAreas,
        analysisDepth: loadedSettings.customGptSettings.analysisDepth,
        weights: loadedSettings.weights
      })
      return loadedSettings
    }

    // אם אין הגדרות שמורות, ניצור אותן ונחזיר ברירת מחדל
    console.log('🚀 [DEBUG] לא נמצאו הגדרות, יוצר הגדרות ברירת מחדל...')
    await initializeDefaultSettingsForShadchan(shadchanId)
    
    const defaultSettings = getDefaultAdvancedMatchingSettings()
    console.log(`🔧 [DEBUG] הגדרות ברירת מחדל נוצרו:`, {
      maxMatches: defaultSettings.maxMatches,
      model: defaultSettings.gptSettings.model,
      temperature: defaultSettings.gptSettings.temperature,
      focusAreas: defaultSettings.customGptSettings.focusAreas
    })
    return defaultSettings

  } catch (error) {
    console.error('❌ [DEBUG] שגיאה בטעינת הגדרות השדכן:', error)
    return getDefaultAdvancedMatchingSettings()
  }
}

// פונקציה פנימית ליצירת הגדרות ברירת מחדל
const initializeDefaultSettingsForShadchan = async (shadchanId: string): Promise<void> => {
  try {
    console.log(`🛠️ [DEBUG] יוצר הגדרות ברירת מחדל עבור שדכן ${shadchanId}`)
    
    const defaultSettings = getDefaultAdvancedMatchingSettings()
    await saveShadchanSettings(shadchanId, defaultSettings)
    
    console.log(`✅ [DEBUG] הגדרות ברירת מחדל נוצרו והושמרו במסד הנתונים`)
  } catch (error) {
    console.error('❌ [DEBUG] שגיאה ביצירת הגדרות ברירת מחדל:', error)
    // לא נזרוק שגיאה כי אנחנו עדיין יכולים להמשיך עם הגדרות זמניות
  }
}

// שמירת הגדרות השדכן במסד
export const saveShadchanSettings = async (
  shadchanId: string, 
  settings: AdvancedMatchingSettings
): Promise<void> => {
  try {
    console.log(`💾 [DEBUG] שומר הגדרות עבור שדכן: ${shadchanId}`)
    console.log(`📝 [DEBUG] הגדרות לשמירה:`, {
      maxMatches: settings.maxMatches,
      model: settings.gptSettings.model,
      temperature: settings.gptSettings.temperature,
      maxTokens: settings.gptSettings.maxTokens,
      focusAreas: settings.customGptSettings.focusAreas,
      analysisDepth: settings.customGptSettings.analysisDepth,
      weights: settings.weights,
      hardFilters: settings.hardFilters,
      advancedFilters: settings.advancedFilters
    })

    const { error } = await supabase
      .from('shadchanim')
      .update({
        advanced_matching_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', shadchanId)

    if (error) {
      console.error('❌ [DEBUG] שגיאה בשמירת הגדרות:', error)
      throw error
    }

    console.log('✅ [DEBUG] הגדרות נשמרו בהצלחה במסד הנתונים')
  } catch (error) {
    console.error('❌ [DEBUG] שגיאה בשמירת הגדרות השדכן:', error)
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

  if (settings.advancedFilters.maxDistanceKm > 0 && (settings.advancedFilters.maxDistanceKm < 1 || settings.advancedFilters.maxDistanceKm > 500)) {
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
        familyBackground: 'רקע משפחתי',
        personality: 'אישיות וטמפרמנט',
        values: 'ערכים וחזון משפחתי'
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

// ************ פונקציות להגדרות מפושטות ************

// שמירת הגדרות מפושטות של השדכן
export const saveSimplifiedShadchanSettings = async (
  shadchanId: string, 
  simplified: SimplifiedShadchanSettings
): Promise<void> => {
  try {
    console.log(`💾 [DEBUG] שומר הגדרות מפושטות עבור שדכן: ${shadchanId}`)
    console.log(`📝 [DEBUG] הגדרות מפושטות לשמירה:`, simplified)

    const { error } = await supabase
      .from('shadchanim')
      .update({
        advanced_matching_settings: simplified, // שמירה בטור הקיים עם נתונים נקיים
        updated_at: new Date().toISOString()
      })
      .eq('id', shadchanId)

    if (error) {
      console.error('❌ [DEBUG] שגיאה בשמירת הגדרות מפושטות:', error)
      throw error
    }

    console.log(`✅ [DEBUG] הגדרות מפושטות נשמרו בהצלחה במסד הנתונים`)
  } catch (error) {
    console.error('❌ שגיאה בשמירת הגדרות מפושטות:', error)
    throw error
  }
}

// טעינת הגדרות מפושטות של השדכן
export const loadSimplifiedShadchanSettings = async (shadchanId: string): Promise<SimplifiedShadchanSettings> => {
  try {
    console.log(`📥 [DEBUG] טוען הגדרות מפושטות עבור שדכן: ${shadchanId}`)
    
    const { data, error } = await supabase
      .from('shadchanim')
      .select('advanced_matching_settings')
      .eq('id', shadchanId)
      .single()

    if (error) {
      console.error('❌ [DEBUG] שגיאה בטעינת הגדרות מפושטות:', error)
      throw error
    }

    if (data?.advanced_matching_settings) {
      // בדיקה אם זה כבר הגדרות מפושטות (חדש) או הגדרות מלאות (ישן)
      const settings = data.advanced_matching_settings
      if (settings.selectedProfile !== undefined) {
        // זה הגדרות מפושטות
        console.log('📋 [DEBUG] הגדרות מפושטות נטענו מהמסד:', settings)
        return settings
      } else {
        // זה הגדרות מלאות ישנות - נמיר להגדרות מפושטות
        console.log('🔄 [DEBUG] מגלה הגדרות ישנות, ממיר להגדרות מפושטות')
        const simplified = simplifyAdvancedSettings(settings)
        // נשמור את ההגדרות המפושטות
        await saveSimplifiedShadchanSettings(shadchanId, simplified)
        return simplified
      }
    }

    // אם אין הגדרות מפושטות, נחזיר ברירת מחדל
    console.log('⚙️ [DEBUG] לא נמצאו הגדרות מפושטות, יוצר ברירת מחדל')
    const defaultSimplified: SimplifiedShadchanSettings = {
      selectedProfile: 'classic',
      maxMatches: 10
    }
    
    // נשמור את ברירת המחדל
    await saveSimplifiedShadchanSettings(shadchanId, defaultSimplified)
    
    return defaultSimplified
  } catch (error) {
    console.error('❌ שגיאה בטעינת הגדרות מפושטות:', error)
    throw error
  }
}