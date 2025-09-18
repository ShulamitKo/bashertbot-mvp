-- Migration: הוספת טבלאות מועמדים חדשות
-- תאריך: 2025-01-03

-- טבלת בנים
CREATE TABLE IF NOT EXISTS candidates_boys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    
    -- מזהה ייחודי פנימי
    internal_id TEXT NOT NULL,
    
    -- נתונים בסיסיים
    name TEXT NOT NULL,
    birth_date DATE,
    age INTEGER NOT NULL,
    preferred_age_range TEXT,
    marital_status TEXT NOT NULL,
    open_to_other_sectors TEXT,
    sector TEXT,
    community TEXT,
    religious_level TEXT,
    religious_stream TEXT,
    siblings INTEGER,
    birth_order INTEGER,
    location TEXT NOT NULL,
    
    -- השכלה ומקצוע
    education TEXT,
    profession TEXT,
    languages TEXT,
    
    -- מראה חיצוני
    height TEXT,
    appearance TEXT,
    dress_style TEXT,
    smoking TEXT,
    
    -- טקסט מורחב
    hobbies TEXT,
    values_and_beliefs TEXT,
    personality TEXT,
    lifestyle TEXT,
    flexibility TEXT,
    internet_usage TEXT,
    education_views TEXT,
    about_me TEXT,
    looking_for TEXT,
    important_qualities TEXT,
    deal_breakers TEXT,
    additional_notes TEXT,
    
    -- ניהול
    status TEXT DEFAULT 'זמין' CHECK (status IN ('זמין', 'בתהליך', 'לא זמין', 'מחוק')),
    
    -- תיעוד
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shadchan_id, internal_id)
);

-- טבלת בנות (זהה)
CREATE TABLE IF NOT EXISTS candidates_girls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    
    internal_id TEXT NOT NULL,
    
    name TEXT NOT NULL,
    birth_date DATE,
    age INTEGER NOT NULL,
    preferred_age_range TEXT,
    marital_status TEXT NOT NULL,
    open_to_other_sectors TEXT,
    sector TEXT,
    community TEXT,
    religious_level TEXT,
    religious_stream TEXT,
    siblings INTEGER,
    birth_order INTEGER,
    location TEXT NOT NULL,
    
    education TEXT,
    profession TEXT,
    languages TEXT,
    
    height TEXT,
    appearance TEXT,
    dress_style TEXT,
    smoking TEXT,
    
    hobbies TEXT,
    values_and_beliefs TEXT,
    personality TEXT,
    lifestyle TEXT,
    flexibility TEXT,
    internet_usage TEXT,
    education_views TEXT,
    about_me TEXT,
    looking_for TEXT,
    important_qualities TEXT,
    deal_breakers TEXT,
    additional_notes TEXT,
    
    status TEXT DEFAULT 'זמין' CHECK (status IN ('זמין', 'בתהליך', 'לא זמין', 'מחוק')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shadchan_id, internal_id)
);

-- טבלת פרטי קשר
CREATE TABLE IF NOT EXISTS candidates_contact (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shadchan_id UUID REFERENCES shadchanim(id) ON DELETE CASCADE,
    candidate_id UUID,
    candidate_type TEXT NOT NULL CHECK (candidate_type IN ('boy', 'girl')),
    
    email TEXT,
    phone TEXT,
    currently_proposed TEXT,
    previously_proposed TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(candidate_id, candidate_type)
);

-- הגדרת RLS
ALTER TABLE candidates_boys ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates_girls ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates_contact ENABLE ROW LEVEL SECURITY;

-- מדיניויות RLS
CREATE POLICY "בנים של השדכן בלבד" ON candidates_boys
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

CREATE POLICY "בנות של השדכן בלבד" ON candidates_girls
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

CREATE POLICY "פרטי קשר של השדכן בלבד" ON candidates_contact
    FOR ALL USING (shadchan_id IN (SELECT id FROM shadchanim WHERE auth_user_id = auth.uid()));

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_candidates_boys_shadchan ON candidates_boys(shadchan_id);
CREATE INDEX IF NOT EXISTS idx_candidates_boys_status ON candidates_boys(status);
CREATE INDEX IF NOT EXISTS idx_candidates_boys_age ON candidates_boys(age);
CREATE INDEX IF NOT EXISTS idx_candidates_boys_location ON candidates_boys(location);

CREATE INDEX IF NOT EXISTS idx_candidates_girls_shadchan ON candidates_girls(shadchan_id);
CREATE INDEX IF NOT EXISTS idx_candidates_girls_status ON candidates_girls(status);
CREATE INDEX IF NOT EXISTS idx_candidates_girls_age ON candidates_girls(age);
CREATE INDEX IF NOT EXISTS idx_candidates_girls_location ON candidates_girls(location);

CREATE INDEX IF NOT EXISTS idx_candidates_contact_candidate ON candidates_contact(candidate_id, candidate_type);

-- טריגרים לעדכון updated_at
CREATE TRIGGER update_candidates_boys_updated_at BEFORE UPDATE ON candidates_boys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_girls_updated_at BEFORE UPDATE ON candidates_girls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_contact_updated_at BEFORE UPDATE ON candidates_contact
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- עדכון טבלת הצעות לתמוך במקורות שונים
ALTER TABLE match_proposals 
ADD COLUMN IF NOT EXISTS boy_candidate_id UUID REFERENCES candidates_boys(id),
ADD COLUMN IF NOT EXISTS girl_candidate_id UUID REFERENCES candidates_girls(id),
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'google_sheets' CHECK (data_source IN ('google_sheets', 'supabase'));

-- אינדקסים לטבלת הצעות
CREATE INDEX IF NOT EXISTS idx_match_proposals_boy_candidate ON match_proposals(boy_candidate_id);
CREATE INDEX IF NOT EXISTS idx_match_proposals_girl_candidate ON match_proposals(girl_candidate_id);