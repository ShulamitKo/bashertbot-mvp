// טיפוסי נתונים עבור באשערטבוט

// פרופיל שדכן
export interface Shadchan {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  google_oauth_token?: string;
  openai_api_key?: string;
  google_sheet_id?: string;
  sheet_boys_tab_name: string;
  sheet_girls_tab_name: string;
  min_age_gap: number;
  max_age_gap: number;
  matching_prompt: string;
  created_at: string;
  updated_at: string;
  
  // הגדרות התאמה מתקדמות - חדש!
  advanced_matching_settings?: AdvancedMatchingSettings;
}

// מועמד (נתונים מגיליון Google Sheets)
export interface Candidate {
  rowId: string; // מזהה השורה בגיליון
  name: string;
  age: number;
  city: string;
  edah: string;
  education: string;
  profession: string;
  familyBackground: string;
  lookingFor: string;
  notes?: string;
  status?: 'זמין' | 'בתהליך' | 'לא זמין';
  // שדות נוספים יתווספו לפי צרכים
  [key: string]: any;
}

// הצעת שידוך (משופרת עם ציונים מפורטים)
export interface MatchProposal {
  id: string;
  shadchan_id?: string;
  shadchanId?: string; // תמיכה לשתי הוריאנטים
  
  // מזהי המועמדים
  maleId: string;
  femaleId: string;
  maleName: string;
  femaleName: string;
  
  // ציונים מפורטים - הגישה החדשה
  logicalScore: number; // ציון לוגי 0-10 (שלב 2)
  gptScore: number;     // ציון GPT 1-10 (שלב 3)
  finalScore: number;   // ציון סופי (ממוצע)
  
  // פירוט ההתאמה
  summary: string;      // סיכום מ-GPT
  strengths: string[];  // נקודות חוזק
  concerns: string[];   // נקודות לתשומת לב
  
  // ציונים ישנים (לתמיכה לאחור)
  match_score?: number;
  ai_reasoning?: string;
  
  // מצב וניהול - זרימה מתקדמת חדשה
  status: 'pending' | 'ready_for_processing' | 'rejected' | 'in_meeting_process' | 'ready_for_contact' | 'contacting' | 'awaiting_response' | 'rejected_by_candidate' | 'schedule_meeting' | 'meeting_scheduled' | 'meeting_completed' | 'completed' | 'closed';
  notes?: string;
  contact_attempts?: number;
  last_contact_date?: string;
  meeting_scheduled?: boolean;
  meeting_date?: string;
  
  // מעקב יצירת קשר מתקדם - חדש!
  boy_contacted?: boolean;
  girl_contacted?: boolean;
  boy_response?: 'pending' | 'interested' | 'not_interested' | 'needs_time';
  girl_response?: 'pending' | 'interested' | 'not_interested' | 'needs_time';
  contact_method?: 'email' | 'whatsapp' | 'phone' | 'mixed';
  rejection_reason?: string;
  rejection_side?: 'boy' | 'girl' | 'both' | 'shadchan';
  
  created_at?: string;
  createdAt?: string; // תמיכה לשתי הוריאנטים
  updated_at?: string;
  
  // נתונים מורחבים (יטענו בזמן אמת מהגיליון)
  boy_data?: DetailedCandidate;
  girl_data?: DetailedCandidate;
  boy_row_id?: string;
  girl_row_id?: string;
}

// דחייה
export interface Rejection {
  id: string;
  shadchan_id: string;
  boy_row_id: string;
  girl_row_id: string;
  reason?: string;
  rejected_at: string;
}

// רשומת פעילות
export interface ActivityLog {
  id: string;
  shadchan_id: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

// הגדרות Google Sheets
export interface SheetConfig {
  spreadsheetId: string;
  boysSheetName: string;
  girlsSheetName: string;
  headerRow: number;
}

// תוצאת התאמה מ-AI
export interface AIMatchResult {
  score: number; // 0-1
  reasoning: string;
  pros: string[];
  cons: string[];
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
}

// סינון והתאמה
export interface MatchingFilters {
  minAge?: number;
  maxAge?: number;
  cities?: string[];
  edot?: string[];
  excludeMatched?: boolean;
  excludeRejected?: boolean;
}

// סטטוס Google OAuth
export interface GoogleAuthStatus {
  isAuthenticated: boolean;
  email?: string;
  accessToken?: string;
  error?: string;
}

// פרמטרי חיפוש
export interface SearchParams {
  query?: string;
  status?: MatchProposal['status'];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'match_score' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// תגובת API
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// הגדרות משתמש
export interface UserSettings {
  shadchan: Shadchan;
  googleAuth: GoogleAuthStatus;
  sheetConfig?: SheetConfig;
}

// מועמד מפורט (מהגיליון עם כל השדות) - עדכון לתמיכה במייל וטלפון נפרדים
export interface DetailedCandidate {
  id: string;
  name: string;
  age: number;
  
  // נתונים בסיסיים
  maritalStatus?: string;
  religiousLevel?: string;
  community?: string;
  location?: string;
  education?: string;
  profession?: string;
  familyBackground?: string;
  rqcMishpahti?: string;
  
  // העדפות
  preferredAgeRange?: string;
  lookingFor?: string;
  importantToMe?: string;
  dealBreakers?: string;
  
  // תחביבים וערכים
  hobbies?: string;
  valuesAndBeliefs?: string;
  personalityType?: string;
  lifeGoals?: string;
  
  // נתונים נוספים
  height?: string;
  appearance?: string;
  economicStatus?: string;
  healthStatus?: string;
  
  // פרטי קשר - עדכון חדש!
  email?: string;    // עמודה חדשה בגיליון
  phone?: string;    // עמודה חדשה בגיליון
  contact?: string;  // שדה ישן - נשאיר לתמיכה לאחור
  
  // מטאדטה
  notes?: string;
  status?: 'זמין' | 'בתהליך' | 'לא זמין';
  lastUpdated?: string;
  
  // תמיכה בשדות דינמיים
  [key: string]: any;
}

// סטטיסטיקות תהליך ההתאמה
export interface MatchingStats {
  totalPairs: number;
  hardFilterPassed: number;
  logicalScorePassed: number;
  gptAnalyzed: number;
  finalMatches: number;
  costSaving: number; // אחוז החיסכון בעלות GPT
  processingTime: number; // זמן עיבוד בשניות
}

// הגדרות שדכן מפושטות - רק מה שהשדכן בוחר במסכים
export interface SimplifiedShadchanSettings {
  // אסטרטגיה: פרופיל מוכן או מותאם אישית
  selectedProfile: 'classic' | 'professional' | 'emotional' | 'custom'
  
  // כמות התאמות לחזור מGPT
  maxMatches: number
  
  // הגדרות מותאמות אישית (רק אם selectedProfile === 'custom')
  customSettings?: {
    // תחומי התמקדות שהשדכן בחר
    focusAreas: string[]
    
    // פער גיל מקסימלי
    maxAgeDifference: number
    
    // רמת עומק הניתוח
    analysisDepth: 'basic' | 'detailed' | 'comprehensive'
    
    // פילטרים קשיחים שהשדכן בחר
    hardFilters: {
      respectReligiousLevel: boolean
      respectMaritalStatus: boolean
      respectCommunityPreference: boolean
      respectDealBreakers: boolean
      requireSameCity: boolean
    }
  }
}

// הגדרות תהליך ההתאמה - בסיסי (תמיכה לאחור)
export interface MatchingSettings {
  maxMatches: number;       // מקסימום התאמות (ברירת מחדל: 10)
  hardFilters: {
    maxAgeDifference: number; // פער גיל מקסימלי (ברירת מחדל: 5)
    respectReligiousLevel: boolean;
    respectCommunityPreference: boolean;
    respectDealBreakers: boolean;
    respectMaritalStatus: boolean; // אל תציע גרושים לרווקים
  };
  gptSettings: {
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4';
    temperature: number;
    maxTokens: number;
  };
}

// פרופיל חיפוש שמור
export interface SearchProfile {
  id: string;
  name: string;
  description: string;
  settings: Partial<AdvancedMatchingSettings>;
  created_at: string;
  is_default: boolean;
}

// הגדרות התאמה מתקדמות - חדש!
export interface AdvancedMatchingSettings extends MatchingSettings {
  // משקולות חשיבות (0-10) - מתווספות לניקוד הלוגי
  weights: {
    age: number;           // חשיבות פער גילאים
    location: number;      // חשיבות קרבה גיאוגרפית
    religiousLevel: number;// חשיבות התאמה דתית
    education: number;     // חשיבות רמת השכלה
    profession: number;    // חשיבות סוג מקצוע
    familyBackground: number; // חשיבות רקע משפחתי
    personality: number;   // חשיבות אישיות וטמפרמנט
    values: number;        // חשיבות ערכים וחזון משפחתי
  };
  
  // הגדרות מתקדמות לפילטרים קשיחים
  advancedFilters: {
    maxDistanceKm: number;        // מרחק מקסימלי בק"מ
    allowedReligiousMatches: string[]; // רשימת תואמות דתיות מותרות
    customDealBreakers: string[]; // דיל ברייקרס מותאמים
    requireSameCity: boolean;     // חובת אותה עיר
    allowDivorced: boolean;       // האם לאפשר גרושים
  };
  
  // הגדרות GPT מותאמות
  customGptSettings: {
    customPrompt?: string;        // פרומפט מותאם אישית
    focusAreas: string[];         // תחומי דגש ספציפיים
    analysisDepth: 'basic' | 'detailed' | 'comprehensive'; // רמת עומק הניתוח
    includeCompatibilityScore: boolean; // האם לכלול ציון תואמות
  };
  
  // פרופילי חיפוש
  searchProfiles: SearchProfile[];
  
  // הגדרות כלליות
  preferences: {
    saveSearchHistory: boolean;   // שמירת היסטוריית חיפושים
    autoRejectPreviousMatches: boolean; // דחייה אוטומטית של זוגות קודמים
    notificationSettings: {
      urgentMatches: boolean;     // התראות על התאמות דחופות
      weeklyReports: boolean;     // דוחות שבועיים
    };
  };
}

// פרופילי התאמה מוכנים
const BUILTIN_PROFILES = {
  classic: {
    weights: { age: 8, location: 6, religiousLevel: 9, education: 5, profession: 4, familyBackground: 7, personality: 6, values: 9 },
    hardFilters: { maxAgeDifference: 4, respectReligiousLevel: true, respectCommunityPreference: true, respectDealBreakers: true, respectMaritalStatus: true },
    gptSettings: { model: 'gpt-4o-mini' as const, temperature: 0.4, maxTokens: 1000 },
    focusAreas: ['רמה דתית והלכה', 'רקע משפחתי', 'עדות וקהילה']
  },
  professional: {
    weights: { age: 6, location: 5, religiousLevel: 6, education: 9, profession: 8, familyBackground: 5, personality: 5, values: 6 },
    hardFilters: { maxAgeDifference: 6, respectReligiousLevel: false, respectCommunityPreference: false, respectDealBreakers: true, respectMaritalStatus: false },
    gptSettings: { model: 'gpt-4o-mini' as const, temperature: 0.5, maxTokens: 1200 },
    focusAreas: ['השכלה ומקצוע', 'יציבות כלכלית', 'מטרות בחיים']
  },
  emotional: {
    weights: { age: 4, location: 3, religiousLevel: 7, education: 5, profession: 4, familyBackground: 8, personality: 10, values: 9 },
    hardFilters: { maxAgeDifference: 8, respectReligiousLevel: true, respectCommunityPreference: false, respectDealBreakers: true, respectMaritalStatus: true },
    gptSettings: { model: 'gpt-4o' as const, temperature: 0.7, maxTokens: 1500 },
    focusAreas: ['אישיות ותחביבים', 'ערכים וחזון משפחתי', 'רקע משפחתי']
  }
}

// פונקציה להמרה מהגדרות מפושטות להגדרות מלאות
export const expandSimplifiedSettings = (simplified: SimplifiedShadchanSettings): AdvancedMatchingSettings => {
  // אם זה פרופיל מוכן, נשתמש בהגדרות המוכנות
  if (simplified.selectedProfile !== 'custom') {
    const profile = BUILTIN_PROFILES[simplified.selectedProfile]
    return {
      maxMatches: simplified.maxMatches,
      weights: profile.weights,
      hardFilters: profile.hardFilters,
      gptSettings: profile.gptSettings,
      customGptSettings: {
        focusAreas: profile.focusAreas,
        analysisDepth: 'detailed',
        includeCompatibilityScore: true
      },
      advancedFilters: {
        maxDistanceKm: 0,
        allowedReligiousMatches: ['דתי↔דתי', 'חרדי↔חרדי', 'מסורתי↔מסורתי', 'דתי↔מסורתי'],
        customDealBreakers: [],
        requireSameCity: false,
        allowDivorced: true
      },
      searchProfiles: [],
      preferences: {
        saveSearchHistory: true,
        autoRejectPreviousMatches: true,
        notificationSettings: {
          urgentMatches: true,
          weeklyReports: false
        }
      }
    }
  }
  
  // אם זה הגדרות מותאמות אישית
  const custom = simplified.customSettings!
  return {
    maxMatches: simplified.maxMatches,
    weights: { age: 8, location: 6, religiousLevel: 9, education: 5, profession: 4, familyBackground: 7, personality: 6, values: 9 }, // ברירת מחדל
    hardFilters: {
      maxAgeDifference: custom.maxAgeDifference,
      respectReligiousLevel: custom.hardFilters.respectReligiousLevel,
      respectCommunityPreference: custom.hardFilters.respectCommunityPreference,
      respectDealBreakers: custom.hardFilters.respectDealBreakers,
      respectMaritalStatus: custom.hardFilters.respectMaritalStatus
    },
    gptSettings: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1000 },
    customGptSettings: {
      focusAreas: custom.focusAreas,
      analysisDepth: custom.analysisDepth,
      includeCompatibilityScore: true
    },
    advancedFilters: {
      maxDistanceKm: 0,
      allowedReligiousMatches: ['דתי↔דתי', 'חרדי↔חרדי', 'מסורתי↔מסורתי', 'דתי↔מסורתי'],
      customDealBreakers: [],
      requireSameCity: custom.hardFilters.requireSameCity,
      allowDivorced: true
    },
    searchProfiles: [],
    preferences: {
      saveSearchHistory: true,
      autoRejectPreviousMatches: true,
      notificationSettings: {
        urgentMatches: true,
        weeklyReports: false
      }
    }
  }
}

// פונקציה להמרה מהגדרות מלאות להגדרות מפושטות
export const simplifyAdvancedSettings = (advanced: AdvancedMatchingSettings): SimplifiedShadchanSettings => {
  // נבדוק אם זה תואם לפרופיל מוכן (השוואה מדויקת של כל השדות החשובים)
  for (const [profileKey, profile] of Object.entries(BUILTIN_PROFILES)) {
    const focusMatch = JSON.stringify(advanced.customGptSettings.focusAreas.sort()) === JSON.stringify(profile.focusAreas.sort())
    const ageMatch = advanced.hardFilters.maxAgeDifference === profile.hardFilters.maxAgeDifference
    const modelMatch = advanced.gptSettings.model === profile.gptSettings.model
    
    if (focusMatch && ageMatch && modelMatch) {
      console.log(`🎯 [DEBUG] זוהה פרופיל מוכן: ${profileKey}`)
      return {
        selectedProfile: profileKey as 'classic' | 'professional' | 'emotional',
        maxMatches: advanced.maxMatches
      }
    }
  }
  
  console.log('🔧 [DEBUG] זוהה כהגדרות מותאמות אישית')
  // אחרת זה הגדרות מותאמות אישית
  return {
    selectedProfile: 'custom',
    maxMatches: advanced.maxMatches,
    customSettings: {
      focusAreas: advanced.customGptSettings.focusAreas,
      maxAgeDifference: advanced.hardFilters.maxAgeDifference,
      analysisDepth: advanced.customGptSettings.analysisDepth,
      hardFilters: {
        respectReligiousLevel: advanced.hardFilters.respectReligiousLevel,
        respectMaritalStatus: advanced.hardFilters.respectMaritalStatus,
        respectCommunityPreference: advanced.hardFilters.respectCommunityPreference,
        respectDealBreakers: advanced.hardFilters.respectDealBreakers,
        requireSameCity: advanced.advancedFilters.requireSameCity
      }
    }
  }
}

// פונקציות עזר להגדרות ברירת מחדל
export const getDefaultAdvancedMatchingSettings = (): AdvancedMatchingSettings => ({
  // הגדרות בסיסיות (תמיכה לאחור)
  maxMatches: 10,
  hardFilters: {
    maxAgeDifference: 5,
    respectReligiousLevel: true,
    respectCommunityPreference: true,
    respectDealBreakers: true,
    respectMaritalStatus: true,
  },
  gptSettings: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
  },
  
  // הגדרות מתקדמות
  weights: {
    age: 8,              // פער גילאים חשוב מאוד
    location: 6,         // מיקום בינוני-גבוה
    religiousLevel: 9,   // רמה דתית קריטית
    education: 5,        // השכלה בינונית
    profession: 4,       // מקצוע פחות חשוב
    familyBackground: 7, // רקע משפחתי חשוב
    personality: 8,      // אישיות וטמפרמנט חשובים מאוד
    values: 9,           // ערכים וחזון משפחתי קריטיים
  },
  
  advancedFilters: {
    maxDistanceKm: 0, // 0 = ללא הגבלה, רק משקל
    allowedReligiousMatches: ['דתי↔דתי', 'חרדי↔חרדי', 'מסורתי↔מסורתי', 'דתי↔מסורתי'],
    customDealBreakers: [],
    requireSameCity: false,
    allowDivorced: true,
  },
  
  customGptSettings: {
    focusAreas: ['רמה דתית והלכה', 'רקע משפחתי', 'השכלה ומקצוע'],
    analysisDepth: 'detailed',
    includeCompatibilityScore: true,
  },
  
  searchProfiles: [],
  
  preferences: {
    saveSearchHistory: true,
    autoRejectPreviousMatches: true,
    notificationSettings: {
      urgentMatches: true,
      weeklyReports: false,
    },
  },
})

// ============ טיפוסים חדשים לניהול הצעות מתקדם ============

// הערה פשוטה עם תאריך
export interface ProposalNote {
  content: string;
  created_at: string;
  status?: string; // הסטטוס שהיה בזמן יצירת ההערה
  edited_at?: string; // תאריך עריכה אחרונה
}

// הצעה מורחבת עם כל הפרטים
export interface EnhancedProposal extends MatchProposal {
  // פרטי מועמדים מלאים
  boyDetails?: DetailedCandidate;
  girlDetails?: DetailedCandidate;
  
  // היסטוריית הערות
  notesHistory?: ProposalNote[];
  
  // נתונים סטטיסטיים בסיסיים
  daysInProcess?: number;
  lastActivity?: string;
}

// פילטרים לטאב הצעות פעילות
export interface ProposalsFilter {
  status?: MatchProposal['status'][];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'last_activity' | 'match_score' | 'days_in_process';
  sortOrder?: 'asc' | 'desc';
  searchTerm?: string; // חיפוש בשמות
}

// ============ טיפוסים חדשים לניהול קשר ============

// פעולת יצירת קשר
export interface ContactAction {
  id: string;
  proposal_id: string;
  candidate_side: 'boy' | 'girl';
  contact_method: 'email' | 'whatsapp' | 'phone';
  contact_details: string; // מייל או טלפון
  message_content?: string;
  contacted_at: string;
  response?: 'pending' | 'interested' | 'not_interested' | 'needs_time';
  response_date?: string;
  notes?: string;
}

// סטטוסי זרימת הצעה
export interface ProposalStatusFlow {
  current_status: MatchProposal['status'];
  next_possible_statuses: MatchProposal['status'][];
  required_actions?: string[];
  auto_transitions?: { condition: string; next_status: MatchProposal['status'] }[];
}

 