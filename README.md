# באשערטבוט MVP

מערכת שידוכים מבוססת בינה מלאכותית לשדכנים - חיבור ישיר לגיליונות Google Sheets עם התאמות חכמות באמצעות GPT.

## תכונות עיקריות

### 🔍 התאמות חכמות
- ניתוח אוטומטי של פרופילי מועמדים באמצעות GPT-4
- ציון התאמה מדויק (0-1) עם הסבר מפורט
- המלצות מקצועיות: מומלץ מאוד / מומלץ / שכדאי לשקול / לא מומלץ

### 📊 חיבור לגיליונות Google Sheets
- סנכרון אוטומטי עם הגיליונות הקיימים שלך
- תמיכה בטאבים נפרדים לבנים ובנות
- עדכון סטטוסים בזמן אמת
- אימות מבנה הגיליון

### 📈 ניהול הצעות שידוך
- מעקב מלא אחר כל ההצעות הפעילות
- מניעת הצעות חוזרות (blacklist אוטומטי)
- יומן פעילות מפורט
- סטטיסטיקות והתקדמות

### 🔒 פרטיות ואבטחה
- נתוני המועמדים נשארים רק בגיליונות שלכם
- במסד הנתונים נשמרים רק פרטי שדכן, סטטוסים ודחיות
- אימות מאובטח דרך Google OAuth
- RLS (Row Level Security) מלא

## דרישות מערכת

- Node.js 18 ומעלה
- חשבון Supabase
- מפתח OpenAI API
- גישה לGoogle Sheets API

## התקנה

### 1. הורדת הפרויקט
```bash
git clone <repository-url>
cd bashertbot-mvp
```

### 2. התקנת חבילות
```bash
npm install
```

### 3. הגדרת משתני סביבה
העתק את קובץ `env.example` ל-`.env` ומלא את הפרטים:

```bash
cp env.example .env
```

ערוך את קובץ `.env`:
```env
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google OAuth & Sheets API
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI
VITE_OPENAI_API_KEY=your-openai-api-key
```

### 4. הגדרת מסד נתונים Supabase
1. צור פרויקט חדש ב-[Supabase](https://supabase.com)
2. העלה את קובץ `supabase/schema.sql` למסד הנתונים:
   - Authentication → Settings → RLS policies
   - SQL Editor → New query → העתק את התוכן מ-`schema.sql`
   - Run

### 5. הגדרת Google OAuth
1. עבור ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש או בחר קיים
3. הפעל את Google Sheets API
4. צור OAuth 2.0 credentials
5. הוסף את הדומיין שלך ל-Authorized domains

### 6. השגת מפתח OpenAI
1. עבור ל-[OpenAI Platform](https://platform.openai.com)
2. API keys → Create new secret key
3. העתק את המפתח לקובץ `.env`

## הרצת האפליקציה

### Development
```bash
npm run dev
```

האפליקציה תרוץ על http://localhost:5173

### Production Build
```bash
npm run build
npm run preview
```

## מבנה הגיליון הנדרש

הגיליון צריך לכלול את העמודות הבאות (בדיוק באותו סדר):

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| שם | גיל | עיר | עדה | השכלה | מקצוע | רקע משפחתי | מחפש/ת | הערות | סטטוס |

### דוגמה:
```
| דוד כהן | 28 | ירושלים | אשכנזי | תואר ראשון | מהנדס | משפחה דתית | בחורה דתייה וחכמה | אוהב ספורט | זמין |
```

### טאבים נדרשים:
- **בנים** - רשימת המועמדים הזכרים
- **בנות** - רשימת המועמדות הנשים

## שימוש במערכת

### 1. התחברות
- השתמש בכפתור "התחברות עם Google"
- אשר הרשאות לגישה לגיליונות

### 2. חיבור הגיליון
- עבור לטאב "הגדרות"
- הזן את מזהה הגיליון (מה-URL)
- בחר את הטאבים לבנים ובנות
- לחץ "חבר גיליון"

### 3. הגדרת OpenAI
- עבור לטאב "הגדרות"
- הזן את מפתח ה-API
- הגדר פרומפט מותאם אישית (אופציונלי)

### 4. התחלת עבודה
- המערכת תטען אוטומטית את המועמדים
- עבור לטאב "התאמות חדשות"
- עיין בהצעות ואשר או דחה
- עקוב אחר ההצעות הפעילות בטאב המתאים

## מבנה הפרויקט

```
src/
├── components/
│   ├── Layout/
│   │   └── Header.tsx          # כותרת המערכת
│   └── ui/
│       ├── Button.tsx          # רכיב כפתור
│       └── Card.tsx           # רכיב כרטיס
├── lib/
│   ├── auth.ts                # פונקציות אימות
│   ├── google-sheets.ts       # עבודה עם Google Sheets
│   ├── openai.ts             # עבודה עם OpenAI
│   ├── supabase.ts           # חיבור Supabase
│   └── utils.ts              # פונקציות עזר
├── pages/
│   ├── DashboardPage.tsx     # דף הדשבורד הראשי
│   └── LoginPage.tsx         # דף התחברות
├── types/
│   └── index.ts              # הגדרות TypeScript
├── App.tsx                   # רכיב האפליקציה הראשי
└── main.tsx                  # נקודת הכניסה
```

## פתרון בעיות נפוצות

### שגיאת חיבור לגיליון
- ודא שהגיליון ציבורי או שיש לך הרשאות גישה
- בדוק שמזהה הגיליון נכון (מה-URL)
- ודא שהטאבים קיימים ובעלי השמות הנכונים

### שגיאת OpenAI
- בדוק שהמפתח תקף ויש לך יתרה
- ודא חיבור לאינטרנט יציב
- נסה להפחית את מספר הקריאות במקביל

### בעיות אימות
- נסה להתנתק ולהתחבר מחדש
- בדוק שהגדרות OAuth נכונות ב-Google Console
- ודא שהדומיין מורשה

## תמיכה

לבעיות טכניות או שאלות, פנה למפתח או צור issue בגיטהאב.

## רישיון

MIT License - ראה קובץ LICENSE לפרטים. 