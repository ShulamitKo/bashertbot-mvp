-- בטבלת משתמשים אנו שומרים רק פרטי השדכנים, לא את נתוני המועמדים
-- נתוני המועמדים יישארו ב-Google Sheets בלבד

-- טבלת שדכנים
CREATE TABLE shadchanim (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    google_oauth_token TEXT,
    openai_api_key TEXT,
    google_sheet_id TEXT,
    sheet_boys_tab_name TEXT DEFAULT 'בנים',
    sheet_girls_tab_name TEXT DEFAULT 'בנות',
    
    -- הגדרות התאמה
    min_age_gap INTEGER DEFAULT -5,
    max_age_gap INTEGER DEFAULT 10,
    matching_prompt TEXT DEFAULT 'בדוק התאמה בין הזוגות לפי עדות, רקע משפחתי, השכלה ועבודה, נתני דירה ואזור מגורים רצוי',
    
    -- הגדרות התאמה מתקדמות - חדש!
    advanced_matching_settings JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת סשני התאמות (חדש!)
CREATE TABLE matching_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0, -- 0=פעיל, 1-10=היסטוריה
    total_matches INTEGER DEFAULT 0,
    processed_matches INTEGER DEFAULT 0,
    session_data JSONB DEFAULT '[]'::jsonb, -- מערך של ההתאמות
    
    -- מניעת כפילות בסשן פעיל
    UNIQUE(shadchan_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- טבלת הצעות שידוך (סטטוסים בלבד)
CREATE TABLE match_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    
    -- מזהי המועמדים (רק מזהה השורה מהגיליון, לא הנתונים עצמם)
    boy_row_id TEXT NOT NULL,
    girl_row_id TEXT NOT NULL,
    
    -- פרטי הצעה
    match_score DECIMAL(3,2), -- ציון התאמה 0.00-1.00 (ישן)
    ai_reasoning TEXT, -- הסבר של ה-AI (ישן)
    
    -- ציונים מפורטים (חדש)
    logical_score DECIMAL(3,1), -- ציון לוגי 0.0-10.0
    gpt_score INTEGER, -- ציון GPT 1-10
    final_score DECIMAL(3,1), -- ציון סופי 0.0-10.0
    
    -- פירוט מפורט (חדש)
    summary TEXT, -- סיכום מפורט
    strengths TEXT, -- נקודות חוזק (JSON array)
    concerns TEXT, -- נקודות לתשומת לב (JSON array)
    
    status TEXT DEFAULT 'ready_for_processing' CHECK (status IN ('ready_for_processing', 'rejected', 'in_meeting_process', 'ready_for_contact', 'contacting', 'awaiting_response', 'rejected_by_candidate', 'schedule_meeting', 'meeting_scheduled', 'meeting_completed', 'completed', 'closed')),
    
    -- חיבור לסשן מקורי
    original_session_id UUID REFERENCES matching_sessions(id),
    
    -- תיעוד
    notes TEXT,
    notes_history JSONB DEFAULT '[]'::jsonb, -- מערך של {content: string, created_at: string}
    contact_attempts INTEGER DEFAULT 0,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    meeting_scheduled BOOLEAN DEFAULT FALSE,
    meeting_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
          -- מניעת כפילויות
      UNIQUE(shadchan_id, boy_row_id, girl_row_id)
);

-- הוספת עמודות לתמיכה בזרימת הצעות מתקדמת
ALTER TABLE match_proposals 
ADD COLUMN IF NOT EXISTS boy_contacted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS girl_contacted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS boy_response TEXT CHECK (boy_response IN ('pending', 'interested', 'not_interested', 'needs_time')),
ADD COLUMN IF NOT EXISTS girl_response TEXT CHECK (girl_response IN ('pending', 'interested', 'not_interested', 'needs_time')),
ADD COLUMN IF NOT EXISTS contact_method TEXT CHECK (contact_method IN ('email', 'whatsapp', 'phone', 'mixed')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_side TEXT CHECK (rejection_side IN ('boy', 'girl', 'both', 'shadchan'));

-- עדכון סוגי הסטטוס
ALTER TABLE match_proposals 
DROP CONSTRAINT IF EXISTS match_proposals_status_check;

ALTER TABLE match_proposals 
ADD CONSTRAINT match_proposals_status_check 
CHECK (status IN ('ready_for_processing', 'rejected', 'in_meeting_process', 'ready_for_contact', 'contacting', 'awaiting_response', 'rejected_by_candidate', 'schedule_meeting', 'meeting_scheduled', 'meeting_completed', 'completed', 'closed'));

-- טבלת דחיות (למניעת הצעות חוזרות)
CREATE TABLE rejections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    boy_row_id TEXT NOT NULL,
    girl_row_id TEXT NOT NULL,
    reason TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shadchan_id, boy_row_id, girl_row_id)
);

-- טבלת יומן פעילות
CREATE TABLE activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת פעולות יצירת קשר (חדש!)
CREATE TABLE IF NOT EXISTS contact_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES match_proposals(id) ON DELETE CASCADE,
  candidate_side TEXT NOT NULL CHECK (candidate_side IN ('boy', 'girl')),
  contact_method TEXT NOT NULL CHECK (contact_method IN ('email', 'whatsapp', 'phone')),
  contact_details TEXT NOT NULL, -- מייל או טלפון
  message_content TEXT,
  contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response TEXT CHECK (response IN ('pending', 'interested', 'not_interested', 'needs_time')),
  response_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים לטבלת פעולות קשר
CREATE INDEX IF NOT EXISTS idx_contact_actions_proposal_id ON contact_actions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contact_actions_candidate_side ON contact_actions(candidate_side);
CREATE INDEX IF NOT EXISTS idx_contact_actions_contacted_at ON contact_actions(contacted_at);

-- מדיניות אבטחה לטבלת פעולות קשר
ALTER TABLE contact_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contact actions" ON contact_actions
  FOR SELECT USING (
    proposal_id IN (
      SELECT id FROM match_proposals 
      WHERE shadchan_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own contact actions" ON contact_actions
  FOR INSERT WITH CHECK (
    proposal_id IN (
      SELECT id FROM match_proposals 
      WHERE shadchan_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own contact actions" ON contact_actions
  FOR UPDATE USING (
    proposal_id IN (
      SELECT id FROM match_proposals 
      WHERE shadchan_id = auth.uid()
    )
  );

-- תפקיד אוטומטי לעדכון updated_at
CREATE OR REPLACE FUNCTION update_contact_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_actions_updated_at
  BEFORE UPDATE ON contact_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_actions_updated_at();

-- הגדרת RLS (Row Level Security)
ALTER TABLE shadchanim ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- מדיניויות RLS - משתמש יכול לגשת רק לנתונים שלו
CREATE POLICY "משתמשים יכולים לגשת רק לנתונים שלהם" ON shadchanim
    FOR ALL USING (auth.uid() = auth_user_id);

CREATE POLICY "סשני התאמות של השדכן בלבד" ON matching_sessions
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

CREATE POLICY "הצעות של השדכן בלבד" ON match_proposals
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

CREATE POLICY "דחיות של השדכן בלבד" ON rejections
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

CREATE POLICY "יומן פעילות של השדכן בלבד" ON activity_log
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

-- אינדקסים לביצועים
CREATE INDEX idx_matching_sessions_active ON matching_sessions(shadchan_id, is_active) WHERE is_active = true;
CREATE INDEX idx_matching_sessions_position ON matching_sessions(shadchan_id, position);
CREATE INDEX idx_match_proposals_status ON match_proposals(status);
CREATE INDEX idx_match_proposals_created_at ON match_proposals(created_at);
CREATE INDEX idx_rejections_lookup ON rejections(shadchan_id, boy_row_id, girl_row_id);

-- פונקציה לעדכון timestamp אוטומטי
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגרים לעדכון updated_at
CREATE TRIGGER update_shadchanim_updated_at BEFORE UPDATE ON shadchanim
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_proposals_updated_at BEFORE UPDATE ON match_proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- פונקציה לניהול סשנים (דחיקה אוטומטית)
CREATE OR REPLACE FUNCTION manage_matching_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- כשיוצרים סשן חדש פעיל, דחיקת הישנים
    IF NEW.is_active = true THEN
        -- הזזת כל הסשנים במיקום אחד
        UPDATE matching_sessions 
        SET position = position + 1
        WHERE shadchan_id = NEW.shadchan_id;
        
        -- מחיקת סשן מעל 10
        DELETE FROM matching_sessions 
        WHERE shadchan_id = NEW.shadchan_id AND position > 10;
        
        -- הגדרת המיקום של הסשן החדש
        NEW.position = 0;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגר לניהול סשנים
CREATE TRIGGER manage_sessions_trigger 
    BEFORE INSERT ON matching_sessions
    FOR EACH ROW EXECUTE FUNCTION manage_matching_sessions();

-- הטבלאות הבסיסיות מספיקות לצרכים הנוכחיים
-- ניתן להוסיף טבלאות נוספות בעתיד לפי הצורך 