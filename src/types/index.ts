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

 