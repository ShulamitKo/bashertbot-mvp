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

// הצעת שידוך
export interface MatchProposal {
  id: string;
  shadchan_id: string;
  boy_row_id: string;
  girl_row_id: string;
  match_score?: number;
  ai_reasoning?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'closed';
  notes?: string;
  contact_attempts: number;
  last_contact_date?: string;
  meeting_scheduled: boolean;
  meeting_date?: string;
  created_at: string;
  updated_at: string;
  
  // נתונים מורחבים (יטענו בזמן אמת מהגיליון)
  boy_data?: Candidate;
  girl_data?: Candidate;
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