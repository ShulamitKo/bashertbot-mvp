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
  
  // מצב וניהול
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'closed';
  notes?: string;
  contact_attempts?: number;
  last_contact_date?: string;
  meeting_scheduled?: boolean;
  meeting_date?: string;
  created_at?: string;
  createdAt?: string; // תמיכה לשתי הוריאנטים
  updated_at?: string;
  
  // נתונים מורחבים (יטענו בזמן אמת מהגיליון)
  boy_data?: Candidate;
  girl_data?: Candidate;
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

// מועמד מפורט (מהגיליון עם כל השדות)
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
  familyBackground?: string;
  economicStatus?: string;
  healthStatus?: string;
  
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

// הגדרות תהליך ההתאמה
export interface MatchingSettings {
  logicalThreshold: number; // סף הניקוד הלוגי (ברירת מחדל: 4)
  maxMatches: number;       // מקסימום התאמות (ברירת מחדל: 25)
  hardFilters: {
    maxAgeDifference: number; // פער גיל מקסימלי (ברירת מחדל: 5)
    respectReligiousLevel: boolean;
    respectCommunityPreference: boolean;
    respectDealBreakers: boolean;
  };
  gptSettings: {
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4';
    temperature: number;
    maxTokens: number;
  };
} 