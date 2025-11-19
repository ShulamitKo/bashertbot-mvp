-- 🔧 תיקון דחוף: הוספת עמודות חסרות ל-matching_sessions
-- הרץ סקריפט זה ב-Supabase Dashboard → SQL Editor
--
-- שלבים:
-- 1. לך ל-https://supabase.com/dashboard/project/pxvlxmdzyizicmizmclt/sql
-- 2. העתק את הקוד הזה
-- 3. לחץ RUN

-- בדיקה אם העמודות קיימות
DO $$
BEGIN
    -- הוספת gpt_analyzed_count אם לא קיים
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'matching_sessions'
        AND column_name = 'gpt_analyzed_count'
    ) THEN
        ALTER TABLE matching_sessions
        ADD COLUMN gpt_analyzed_count INTEGER DEFAULT 0;

        RAISE NOTICE '✅ עמודה gpt_analyzed_count נוספה בהצלחה';
    ELSE
        RAISE NOTICE '⚠️ עמודה gpt_analyzed_count כבר קיימת';
    END IF;

    -- הוספת available_to_load אם לא קיים
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'matching_sessions'
        AND column_name = 'available_to_load'
    ) THEN
        ALTER TABLE matching_sessions
        ADD COLUMN available_to_load INTEGER DEFAULT 0;

        RAISE NOTICE '✅ עמודה available_to_load נוספה בהצלחה';
    ELSE
        RAISE NOTICE '⚠️ עמודה available_to_load כבר קיימת';
    END IF;
END $$;

-- הוספת הערות לעמודות (לתיעוד)
COMMENT ON COLUMN matching_sessions.gpt_analyzed_count IS 'כמה זוגות נותחו ב-GPT בסך הכל';
COMMENT ON COLUMN matching_sessions.available_to_load IS 'כמה זוגות פוטנציאליים נוספים זמינים לטעינה';

-- בדיקת תוצאה סופית
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'matching_sessions'
AND column_name IN ('gpt_analyzed_count', 'available_to_load')
ORDER BY column_name;
