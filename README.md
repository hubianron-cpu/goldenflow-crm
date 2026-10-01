# Coach CRM

CRM בסיסי למאמנים עם Next.js, Supabase ו-Tailwind.

## מה יש בפנים

- אימות משתמשים עם Supabase Auth
- ניהול לידים
- ניהול משימות
- פייפליין מכירה
- ממשק בעברית עם RTL
- עיצוב שחור / לבן / זהב

## הרצה מקומית

1. התקינו תלויות:

```bash
npm install
```

2. העתיקו את `.env.example` ל-`.env.local` והגדירו:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3. הריצו את הסכמה מקובץ [supabase/schema.sql](/C:/Users/Ron/OneDrive/מסמכים/New%20project/supabase/schema.sql) בתוך פרויקט ה-Supabase שלכם.

4. הפעילו את השרת:

```bash
npm run dev
```

## מבנה

- `app/` מסכי האפליקציה
- `components/` רכיבי UI משותפים
- `lib/` Supabase actions ו-helper functions
- `supabase/schema.sql` סכמת בסיס הנתונים

## קריאת מנויים עבור הלוח השבועי

`GET /api/integrations/weekly-dashboard` מחזיר מצבת מנויים פעילים נוכחית בלבד, ללא פרטי חשבונות. דורש כותרת `Authorization: Bearer <key>` ומפתח שרת ייעודי `WEEKLY_DASHBOARD_READ_KEY` באורך 32 תווים לפחות. אין להשתמש במפתח Supabase, לשמור את הערך ב־Git או להוסיף `NEXT_PUBLIC_` לשמו. ללא הגדרה הנתיב מחזיר 503; ללא אימות הוא מחזיר 401 לפני גישה למסד. הספירה אינה הוכחת גבייה ואינה משנה מנויים או סכמות.

בדיקת החיבור המבודדת: `node --test tests/weekly-dashboard.test.mjs`.
