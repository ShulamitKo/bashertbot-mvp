import React, { useState, useCallback } from 'react';
import { Upload, FileText, Download, Loader2, CheckCircle, AlertCircle, Eye, ArrowRight, User, Users, RefreshCw, Plus } from 'lucide-react';
import { generateCompletion } from '../lib/openai';
import { createBoy, createGirl, generateInternalId, validateCandidateData, createCandidateContact, deleteAllCandidates } from '../lib/candidates';
import type { SupabaseCandidate } from '../types';
import * as XLSX from 'xlsx';

interface SmartImportProps {
  shadchanId: string;
  onImportComplete?: (results: ImportResults) => void;
}

type FileType = 'boys' | 'girls' | 'mixed';
type ImportMode = 'replace' | 'append';

interface ImportResults {
  totalRows: number;
  successfulImports: number;
  failures: ImportFailure[];
  boys: SupabaseCandidate[];
  girls: SupabaseCandidate[];
}

interface ImportFailure {
  rowIndex: number;
  data: any;
  errors: string[];
}

interface ParsedCandidate {
  rowIndex: number;
  type: 'boy' | 'girl';
  data: Partial<SupabaseCandidate>;
  contactData?: { email?: string; phone?: string }; // פרטי קשר
  confidence: number;
  issues: string[];
}

export const SmartImport: React.FC<SmartImportProps> = ({ 
  shadchanId, 
  onImportComplete 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>('mixed');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'tabs' | 'analyzing' | 'preview' | 'importing' | 'complete'>('upload');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<{name: string, type: 'boys' | 'girls'}[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedCandidate[]>([]);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // טעינת קובץ
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // בדיקת סוג קובץ
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      alert('אנא בחר קובץ CSV או Excel');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  }, []);

  // פרסור הקובץ
  const parseFile = async (file: File) => {
    setIsProcessing(true);
    setCurrentStep('analyzing');

    try {
      let headers: string[] = [];
      let rows: any[] = [];

      if (file.name.endsWith('.csv')) {
        // פרסור CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // פרסור Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        // בדיקה אם יש מספר טאבים
        if (workbook.SheetNames.length > 1) {
          console.log('🗂️ נמצאו מספר טאבים:', workbook.SheetNames);
          setAvailableSheets(workbook.SheetNames);
          setCurrentStep('tabs');
          setIsProcessing(false);
          return; // נעצור כאן ונתן למשתמש לבחור טאבים
        }
        
        // אם יש רק טאב אחד - נמשיך כרגיל
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // המרה ל-JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) {
          throw new Error('הקובץ ריק או לא תקין');
        }
        
        // הכותרות בשורה הראשונה
        headers = jsonData[0].map(h => String(h || '').trim());
        
        // המרת הנתונים לאובייקטים
        rows = jsonData.slice(1)
          .filter(row => row.some(cell => cell !== undefined && cell !== ''))
          .map(row => {
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[header] = String(row[i] || '').trim();
            });
            return obj;
          });
      } else {
        throw new Error('סוג קובץ לא נתמך');
      }

      console.log(`📄 נקראו ${rows.length} שורות עם ${headers.length} עמודות:`, headers);
      
      setRawData(rows);
      await analyzeWithAI(rows, headers);
      
    } catch (error) {
      console.error('שגיאה בפרסור קובץ:', error);
      alert(`שגיאה בקריאת הקובץ: ${error}`);
      setIsProcessing(false);
    }
  };

  // ניתוח עם AI
  const analyzeWithAI = async (rows: any[], headers: string[]) => {
    try {
      const sampleRows = rows.slice(0, Math.min(5, rows.length)); // 5 שורות לדוגמה
      
      // כל השדות הקיימים בסופהבייס
      const allFields = [
        'name', 'age', 'birth_date', 'preferred_age_range', 'marital_status', 'location',
        'religious_level', 'religious_stream', 'community', 'sector', 'open_to_other_sectors',
        'siblings', 'birth_order', 'education', 'profession', 'languages',
        'height', 'appearance', 'dress_style', 'smoking',
        'hobbies', 'values_and_beliefs', 'personality', 'lifestyle', 'flexibility',
        'internet_usage', 'education_views', 'about_me', 'looking_for',
        'important_qualities', 'deal_breakers', 'additional_notes',
        'email', 'phone' // פרטי קשר
      ];
      
      const analysisPrompt = `
אתה מומחה במיפוי נתוני שידוכים לבסיס נתונים.
עליך למפות כל עמודה בגליון לשדה המתאים ביותר בבסיס הנתונים.

עמודות בגליון: ${headers.join(', ')}

שדות יעד בבסיס הנתונים:
${allFields.join(', ')}

דוגמאות נתונים (${sampleRows.length} שורות):
${sampleRows.map((row, i) => `שורה ${i + 1}: ${JSON.stringify(row)}`).join('\n')}

דוגמאות למיפוי נכון:
- "שם" / "שם מלא" / "Name" → "name"
- "גיל" / "Age" → "age"
- "עיר" / "מגורים" / "מקום מגורים" → "location"
- "תחביבים" / "Hobbies" → "hobbies"
- "מה חשוב לי" / "ערכים" → "values_and_beliefs"
- "מחפש/ת" / "מה אני מחפש" → "looking_for"
- "דתיות" / "רמה דתית" → "religious_level"
- "השכלה" / "לימודים" → "education"
- "מקצוע" / "עבודה" → "profession"
- "אישיות" / "תכונות" → "personality"
- "אורח חיים" / "סגנון חיים" → "lifestyle"

חשוב: החזר רק JSON תקין, ללא markdown או טקסט נוסף.

החזר JSON בפורמט זה בלבד:
{
  "analysis": {
    "field_mapping": {
      ${allFields.map(field => `"${field}": "שם_העמודה_המתאימה_או_null"`).join(',\n      ')}
    }
  }
}

החלף "שם_העמודה_המתאימה_או_null" בשם העמודה בפועל או null אם לא קיימת.
`;

      const aiResponse = await generateCompletion(analysisPrompt, {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 1000
      });

      // ניקוי התגובה מ-markdown אם קיים
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/\n?```/g, '');
      }
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').replace(/\n?```/g, '');
      }

      const analysis = JSON.parse(cleanResponse);
      await processRowsWithMapping(rows, analysis.analysis.field_mapping);
      
    } catch (error) {
      console.error('שגיאה בניתוח AI:', error);
      console.log('תגובת AI גולמית:', aiResponse);
      
      // נסה לחלץ JSON מתוך התגובה
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          await processRowsWithMapping(rows, analysis.analysis.field_mapping);
          return;
        }
      } catch (secondError) {
        console.error('נכשל גם בחילוץ JSON:', secondError);
      }
      
      // fallback - ניסיון ידני
      console.log('מעבר לניתוח ידני...');
      await processRowsManually(rows, headers);
    }
  };

  // עיבוד שורות עם מיפוי AI
  const processRowsWithMapping = async (rows: any[], mapping: any) => {
    const parsed: ParsedCandidate[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // קביעת מין לפי בחירת המשתמש או זיהוי חכם
        const gender = fileType === 'mixed' ? detectGenderSmart(row, mapping) : fileType;
        
        // מיפוי מלא של כל הנתונים
        const candidateData: Partial<SupabaseCandidate> = {
          internal_id: '', // יוגדר אחר כך
          name: row[mapping.name] || '',
          age: parseInt(row[mapping.age]) || 0,
          birth_date: row[mapping.birth_date] || undefined,
          preferred_age_range: row[mapping.preferred_age_range] || undefined,
          marital_status: row[mapping.marital_status] || '',
          location: row[mapping.location] || '',
          religious_level: row[mapping.religious_level] || undefined,
          religious_stream: row[mapping.religious_stream] || undefined,
          community: row[mapping.community] || undefined,
          sector: row[mapping.sector] || undefined,
          open_to_other_sectors: row[mapping.open_to_other_sectors] || undefined,
          siblings: parseInt(row[mapping.siblings]) || undefined,
          birth_order: parseInt(row[mapping.birth_order]) || undefined,
          education: row[mapping.education] || undefined,
          profession: row[mapping.profession] || undefined,
          languages: row[mapping.languages] || undefined,
          height: row[mapping.height] || undefined,
          appearance: row[mapping.appearance] || undefined,
          dress_style: row[mapping.dress_style] || undefined,
          smoking: row[mapping.smoking] || undefined,
          hobbies: row[mapping.hobbies] || undefined,
          values_and_beliefs: row[mapping.values_and_beliefs] || undefined,
          personality: row[mapping.personality] || undefined,
          lifestyle: row[mapping.lifestyle] || undefined,
          flexibility: row[mapping.flexibility] || undefined,
          internet_usage: row[mapping.internet_usage] || undefined,
          education_views: row[mapping.education_views] || undefined,
          about_me: row[mapping.about_me] || undefined,
          looking_for: row[mapping.looking_for] || undefined,
          important_qualities: row[mapping.important_qualities] || undefined,
          deal_breakers: row[mapping.deal_breakers] || undefined,
          additional_notes: row[mapping.additional_notes] || undefined,
          status: 'זמין'
        };
        
        // שמירת פרטי קשר נפרדים
        const contactData = {
          email: row[mapping.email] || undefined,
          phone: row[mapping.phone] || undefined
        };

        // יצירת internal_id
        if (candidateData.name && candidateData.age && typeof candidateData.name === 'string' && typeof candidateData.age === 'number') {
          candidateData.internal_id = generateInternalId(candidateData.name, candidateData.age);
        } else {
          candidateData.internal_id = `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // ולידציה
        const validationErrors = validateCandidateData(candidateData);
        
        parsed.push({
          rowIndex: i + 1,
          type: gender as 'boy' | 'girl',
          data: candidateData,
          contactData, // הוספת פרטי קשר
          confidence: validationErrors.length === 0 ? 0.9 : 0.6,
          issues: validationErrors
        });
        
      } catch (error) {
        parsed.push({
          rowIndex: i + 1,
          type: 'boy', // ברירת מחדל
          data: {},
          confidence: 0.1,
          issues: [`שגיאה בעיבוד שורה: ${error}`]
        });
      }
    }
    
    setParsedCandidates(parsed);
    setCurrentStep('preview');
    setIsProcessing(false);
  };

  // עיבוד ידני (fallback)
  const processRowsManually = async (rows: any[], headers: string[]) => {
    const parsed: ParsedCandidate[] = [];
    
    // ניחושים בסיסיים לפי שמות עמודות
    const nameField = headers.find(h => 
      h.includes('שם') || h.toLowerCase().includes('name')
    ) || headers[0];
    
    const ageField = headers.find(h => 
      h.includes('גיל') || h.toLowerCase().includes('age')
    );
    
    const locationField = headers.find(h => 
      h.includes('עיר') || h.includes('מגורים') || h.toLowerCase().includes('city') || h.toLowerCase().includes('location')
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const candidateData: Partial<SupabaseCandidate> = {
        internal_id: '',
        name: row[nameField] || '',
        age: ageField ? parseInt(row[ageField]) || 0 : 0,
        marital_status: 'לא צוין',
        location: row[locationField] || '',
        status: 'זמין'
      };

      if (candidateData.name && candidateData.age) {
        candidateData.internal_id = generateInternalId(candidateData.name, candidateData.age);
      }

      const validationErrors = validateCandidateData(candidateData);
      
      parsed.push({
        rowIndex: i + 1,
        type: fileType === 'mixed' ? 'boy' : fileType as 'boy' | 'girl',
        data: candidateData,
        confidence: 0.5,
        issues: validationErrors
      });
    }
    
    setParsedCandidates(parsed);
    setCurrentStep('preview');
    setIsProcessing(false);
  };

  // זיהוי חכם של מין לפי סטטוס משפחתי במצב מעורב
  const detectGenderSmart = (row: any, mapping: any): 'boy' | 'girl' => {
    const maritalStatus = (row[mapping.marital_status] || '').toLowerCase().trim();
    
    // זיהוי לפי סטטוס משפחתי
    if (maritalStatus.includes('רווקה') || 
        maritalStatus.includes('גרושה') || 
        maritalStatus.includes('אלמנה') ||
        maritalStatus.includes('נשואה') ||
        maritalStatus.includes('פרודה')) {
      return 'girl';
    }
    
    if (maritalStatus.includes('רווק') || 
        maritalStatus.includes('גרוש') || 
        maritalStatus.includes('אלמן') ||
        maritalStatus.includes('נשוי') ||
        maritalStatus.includes('פרוד')) {
      return 'boy';
    }
    
    // זיהוי לפי שם (רשימה מורחבת)
    const name = (row[mapping.name] || '').toLowerCase();
    const femaleNames = [
      'שרה', 'רבקה', 'רחל', 'לאה', 'מרים', 'אסתר', 'חנה', 'דבורה',
      'יהודית', 'רות', 'נעמי', 'תמר', 'שושנה', 'אילנה', 'מיכל', 'דינה',
      'ברכה', 'שולמית', 'חיה', 'פנינה', 'גילה', 'אורית', 'נורית', 'ציפורה',
      'יפה', 'עדנה', 'מלכה', 'נחמה', 'שפרה', 'פועה', 'חוה', 'בתיה'
    ];
    
    for (const femaleName of femaleNames) {
      if (name.includes(femaleName.toLowerCase())) {
        return 'girl';
      }
    }
    
    // זיהוי לפי סיומות נשיות
    if (name.endsWith('ה') && name.length > 3) {
      const commonMaleEndings = ['משה', 'אליה', 'יהודה', 'שלמה'];
      if (!commonMaleEndings.some(ending => name.includes(ending.toLowerCase()))) {
        return 'girl';
      }
    }
    
    // ברירת מחדל - בחור
    return 'boy';
  };

  // עיבוד טאבים נבחרים
  const processSelectedSheets = async () => {
    if (!file || selectedSheets.length === 0) return;
    
    setIsProcessing(true);
    setCurrentStep('analyzing');
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      let allCandidates: ParsedCandidate[] = [];
      
      // עיבוד כל טאב נבחר
      for (const sheet of selectedSheets) {
        console.log(`🗂️ מעבד טאב: ${sheet.name} (סוג: ${sheet.type})`);
        
        const worksheet = workbook.Sheets[sheet.name];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) continue;
        
        const headers = jsonData[0].map(h => String(h || '').trim());
        const rows = jsonData.slice(1)
          .filter(row => row.some(cell => cell !== undefined && cell !== ''))
          .map(row => {
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[header] = String(row[i] || '').trim();
            });
            return obj;
          });
          
        // עיבוד טאב עם AI
        await analyzeTabWithAI(rows, headers, sheet.type, allCandidates);
      }
      
      setParsedCandidates(allCandidates);
      setCurrentStep('preview');
      
    } catch (error) {
      console.error('שגיאה בעיבוד טאבים:', error);
      alert(`שגיאה בעיבוד הטאבים: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // ניתוח טאב עם AI
  const analyzeTabWithAI = async (rows: any[], headers: string[], tabType: 'boys' | 'girls', allCandidates: ParsedCandidate[]) => {
    try {
      const sampleRows = rows.slice(0, Math.min(5, rows.length)); // 5 שורות לדוגמה
      
      // כל השדות הקיימים בסופהבייס
      const allFields = [
        'name', 'age', 'birth_date', 'preferred_age_range', 'marital_status', 'location',
        'religious_level', 'religious_stream', 'community', 'sector', 'open_to_other_sectors',
        'siblings', 'birth_order', 'education', 'profession', 'languages',
        'height', 'appearance', 'dress_style', 'smoking',
        'hobbies', 'values_and_beliefs', 'personality', 'lifestyle', 'flexibility',
        'internet_usage', 'education_views', 'about_me', 'looking_for',
        'important_qualities', 'deal_breakers', 'additional_notes',
        'email', 'phone'
      ];
      
      const analysisPrompt = `
אתה מומחה במיפוי נתוני שידוכים לבסיס נתונים.
עליך למפות כל עמודה בגליון לשדה המתאים ביותר בבסיס הנתונים.

עמודות בגליון: ${headers.join(', ')}

שדות יעד בבסיס הנתונים:
${allFields.join(', ')}

דוגמאות נתונים (${sampleRows.length} שורות):
${sampleRows.map((row, i) => `שורה ${i + 1}: ${JSON.stringify(row)}`).join('\n')}

דוגמאות למיפוי נכון:
- "שם" / "שם מלא" / "Name" → "name"
- "גיל" / "Age" → "age"
- "עיר" / "מגורים" / "מקום מגורים" → "location"
- "תחביבים" / "Hobbies" → "hobbies"
- "מה חשוב לי" / "ערכים" → "values_and_beliefs"
- "מחפש/ת" / "מה אני מחפש" → "looking_for"
- "דתיות" / "רמה דתית" → "religious_level"
- "השכלה" / "לימודים" → "education"
- "מקצוע" / "עבודה" → "profession"
- "אישיות" / "תכונות" → "personality"
- "אורח חיים" / "סגנון חיים" → "lifestyle"

חשוב: החזר רק JSON תקין, ללא markdown או טקסט נוסף.

החזר JSON בפורמט זה בלבד:
{
  "analysis": {
    "field_mapping": {
      ${allFields.map(field => `"${field}": "שם_העמודה_המתאימה_או_null"`).join(',\n      ')}
    }
  }
}

החלף "שם_העמודה_המתאימה_או_null" בשם העמודה בפועל או null אם לא קיימת.
`;

      const aiResponse = await generateCompletion(analysisPrompt, {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 1000
      });

      // ניקוי תגובת AI
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/\n?```/g, '');
      }
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').replace(/\n?```/g, '');
      }

      const analysis = JSON.parse(cleanResponse);
      await processTabRowsWithMapping(rows, analysis.analysis.field_mapping, tabType, allCandidates);
      
    } catch (error) {
      console.error('שגיאה בניתוח AI:', error);
      console.log('תגובת AI גולמית:', aiResponse);
      
      // ניסיון לחלץ JSON מתוך התגובה
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          await processTabRowsWithMapping(rows, analysis.analysis.field_mapping, tabType, allCandidates);
          return;
        }
      } catch (secondError) {
        console.error('נכשל גם בחילוץ JSON:', secondError);
      }
      
      // fallback - ניסיון ידני
      console.log('מעבר לניתוח ידני...');
      await processTabRowsManually(rows, headers, tabType, allCandidates);
    }
  };
  
  // עיבוד שורות עם מיפוי AI בטאבים
  const processTabRowsWithMapping = async (rows: any[], mapping: any, tabType: 'boys' | 'girls', allCandidates: ParsedCandidate[]) => {
    const parsed: ParsedCandidate[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // קביעת מין לפי סוג הטאב
        const gender = tabType === 'boys' ? 'boy' : 'girl';
        
        // מיפוי מלא של כל הנתונים
        const candidateData: Partial<SupabaseCandidate> = {
          internal_id: '', // יוגדר אחר כך
          name: row[mapping.name] || '',
          age: parseInt(row[mapping.age]) || 0,
          birth_date: row[mapping.birth_date] || undefined,
          preferred_age_range: row[mapping.preferred_age_range] || undefined,
          marital_status: row[mapping.marital_status] || '',
          location: row[mapping.location] || '',
          religious_level: row[mapping.religious_level] || undefined,
          religious_stream: row[mapping.religious_stream] || undefined,
          community: row[mapping.community] || undefined,
          sector: row[mapping.sector] || undefined,
          open_to_other_sectors: row[mapping.open_to_other_sectors] || undefined,
          siblings: parseInt(row[mapping.siblings]) || undefined,
          birth_order: parseInt(row[mapping.birth_order]) || undefined,
          education: row[mapping.education] || undefined,
          profession: row[mapping.profession] || undefined,
          languages: row[mapping.languages] || undefined,
          height: row[mapping.height] || undefined,
          appearance: row[mapping.appearance] || undefined,
          dress_style: row[mapping.dress_style] || undefined,
          smoking: row[mapping.smoking] || undefined,
          hobbies: row[mapping.hobbies] || undefined,
          values_and_beliefs: row[mapping.values_and_beliefs] || undefined,
          personality: row[mapping.personality] || undefined,
          lifestyle: row[mapping.lifestyle] || undefined,
          flexibility: row[mapping.flexibility] || undefined,
          internet_usage: row[mapping.internet_usage] || undefined,
          education_views: row[mapping.education_views] || undefined,
          about_me: row[mapping.about_me] || undefined,
          looking_for: row[mapping.looking_for] || undefined,
          important_qualities: row[mapping.important_qualities] || undefined,
          deal_breakers: row[mapping.deal_breakers] || undefined,
          additional_notes: row[mapping.additional_notes] || undefined,
          status: 'זמין'
        };
        
        // שמירת פרטי קשר נפרדים
        const contactData = {
          email: row[mapping.email] || undefined,
          phone: row[mapping.phone] || undefined
        };
        
        // יצירת internal_id
        if (candidateData.name && candidateData.age && typeof candidateData.name === 'string' && typeof candidateData.age === 'number') {
          candidateData.internal_id = generateInternalId(candidateData.name, candidateData.age);
        } else {
          candidateData.internal_id = `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // ולידציה
        const validationErrors = validateCandidateData(candidateData);
        
        parsed.push({
          rowIndex: i + 1,
          type: gender as 'boy' | 'girl',
          data: candidateData,
          contactData, // הוספת פרטי קשר
          confidence: validationErrors.length === 0 ? 0.9 : 0.6,
          issues: validationErrors
        });
        
      } catch (error) {
        parsed.push({
          rowIndex: i + 1,
          type: tabType as 'boy' | 'girl',
          data: {},
          contactData: {},
          confidence: 0.1,
          issues: [`שגיאה בעיבוד שורה: ${error}`]
        });
      }
    }
    
    allCandidates.push(...parsed);
  };
  
  // עיבוד ידני בטאבים (fallback)
  const processTabRowsManually = async (rows: any[], headers: string[], tabType: 'boys' | 'girls', allCandidates: ParsedCandidate[]) => {
    const parsed: ParsedCandidate[] = [];
    
    // ניחושים בסיסיים לפי שמות עמודות
    const nameField = headers.find(h => 
      h.includes('שם') || h.toLowerCase().includes('name')
    ) || headers[0];
    
    const ageField = headers.find(h => 
      h.includes('גיל') || h.toLowerCase().includes('age')
    );
    
    const locationField = headers.find(h => 
      h.includes('עיר') || h.includes('מגורים') || h.toLowerCase().includes('city') || h.toLowerCase().includes('location')
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const candidateData: Partial<SupabaseCandidate> = {
        internal_id: '',
        name: row[nameField] || '',
        age: ageField ? parseInt(row[ageField]) || 0 : 0,
        marital_status: 'לא צוין',
        location: row[locationField] || '',
        status: 'זמין'
      };

      if (candidateData.name && candidateData.age && typeof candidateData.name === 'string' && typeof candidateData.age === 'number') {
        candidateData.internal_id = generateInternalId(candidateData.name, candidateData.age);
      } else {
        candidateData.internal_id = `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const validationErrors = validateCandidateData(candidateData);
      
      parsed.push({
        rowIndex: i + 1,
        type: tabType as 'boy' | 'girl',
        data: candidateData,
        contactData: {},
        confidence: 0.5,
        issues: validationErrors
      });
    }
    
    allCandidates.push(...parsed);
  };

  // איפוס
  const reset = () => {
    setFile(null);
    setFileType('mixed');
    setImportMode('append');
    setCurrentStep('upload');
    setAvailableSheets([]);
    setSelectedSheets([]);
    setRawData([]);
    setParsedCandidates([]);
    setImportResults(null);
    setPreviewIndex(0);
    setIsProcessing(false);
  };

  // שמירת הייבוא
  const executeImport = async () => {
    setCurrentStep('importing');
    setIsProcessing(true);

    const results: ImportResults = {
      totalRows: parsedCandidates.length,
      successfulImports: 0,
      failures: [],
      boys: [],
      girls: []
    };

    try {
      // אם נבחר מצב החלפה - מוחקים קודם את כל הנתונים הקיימים
      if (importMode === 'replace') {
        console.log('🔄 מוחק נתונים קיימים לפני ייבוא...');
        const deleteResults = await deleteAllCandidates(shadchanId);
        console.log('✅ מחיקה הושלמה:', deleteResults);
      }
    } catch (error) {
      console.error('❌ שגיאה במחיקת נתונים קיימים:', error);
      alert(`שגיאה במחיקת נתונים קיימים: ${error}`);
      setIsProcessing(false);
      return;
    }

    for (const candidate of parsedCandidates) {
      try {
        if (candidate.issues.length > 0) {
          results.failures.push({
            rowIndex: candidate.rowIndex,
            data: candidate.data,
            errors: candidate.issues
          });
          continue;
        }

        const createdCandidate = candidate.type === 'boy' 
          ? await createBoy(shadchanId, candidate.data as any)
          : await createGirl(shadchanId, candidate.data as any);

        // שמירת פרטי קשר אם קיימים
        if (candidate.contactData && (candidate.contactData.email || candidate.contactData.phone)) {
          try {
            await createCandidateContact(
              shadchanId,
              createdCandidate.id,
              candidate.type,
              candidate.contactData
            );
            console.log('✅ פרטי קשר נשמרו עבור:', createdCandidate.name);
          } catch (contactError) {
            console.warn('⚠️ שגיאה בשמירת פרטי קשר עבור:', createdCandidate.name, contactError);
          }
        }

        if (candidate.type === 'boy') {
          results.boys.push(createdCandidate);
        } else {
          results.girls.push(createdCandidate);
        }
        
        results.successfulImports++;
        
      } catch (error) {
        console.error(`שגיאה בייבוא שורה ${candidate.rowIndex}:`, error);
        results.failures.push({
          rowIndex: candidate.rowIndex,
          data: candidate.data,
          errors: [`שגיאה ביצירת מועמד: ${error}`]
        });
      }
    }

    setImportResults(results);
    setCurrentStep('complete');
    setIsProcessing(false);
    
    if (onImportComplete) {
      onImportComplete(results);
    }
  };

  // עדכון סוג מועמד
  const updateCandidateType = (index: number, newType: 'boy' | 'girl') => {
    setParsedCandidates(prev => prev.map((candidate, i) => 
      i === index ? { ...candidate, type: newType } : candidate
    ));
  };

  // עדכון סוג קובץ ועדכון אוטומטי של סוג המועמדים (רק עבור קבצים לא מעורבים)
  const updateFileType = (newFileType: FileType) => {
    setFileType(newFileType);
    
    // אם זה לא מעורב, עדכן את כל המועמדים לסוג החדש
    if (newFileType !== 'mixed') {
      const newType = newFileType === 'boys' ? 'boy' : 'girl';
      setParsedCandidates(prev => prev.map(candidate => ({
        ...candidate,
        type: newType
      })));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* כותרת */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">ייבוא חכם של מועמדים</h2>
        <p className="text-gray-600">העלה קובץ CSV או Excel ואנחנו נזהה ונמפה אוטומטית את הנתונים</p>
      </div>

      {/* שלבים */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[
            { step: 'upload', label: 'העלאה', icon: Upload },
            { step: 'tabs', label: 'בחירת טאבים', icon: FileText },
            { step: 'analyzing', label: 'ניתוח', icon: FileText },
            { step: 'preview', label: 'תצוגה מקדימה', icon: Eye },
            { step: 'importing', label: 'ייבוא', icon: Download }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep === item.step ? 'bg-blue-600 text-white' :
                ['upload', 'tabs', 'analyzing', 'preview', 'importing'].indexOf(currentStep) > index ? 'bg-green-600 text-white' :
                'bg-gray-300 text-gray-600'
              }`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">{item.label}</span>
              {index < 4 && <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* תוכן לפי שלב */}
      {currentStep === 'upload' && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-4">ייבוא מועמדים מקובץ</h3>
            <p className="text-gray-600 mb-6">
              תומכים בקבצי CSV (.csv), Excel (.xlsx, .xls). הקובץ צריך לכלול לכל הפחות: שם, גיל, מקום מגורים
            </p>
          </div>

          {/* בחירת מצב ייבוא */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              מצב ייבוא:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div 
                onClick={() => setImportMode('append')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  importMode === 'append' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <Plus className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-semibold">הוספה לקיים</div>
                  <div className="text-sm text-gray-600">הוסף את המועמדים החדשים לרשימה הקיימת</div>
                </div>
              </div>
              
              <div 
                onClick={() => setImportMode('replace')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  importMode === 'replace' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-semibold">החלפה מלאה</div>
                  <div className="text-sm text-gray-600">מחק את כל המועמדים הקיימים והחלף במועמדים החדשים</div>
                </div>
              </div>
            </div>
          </div>

          {/* בחירת סוג קובץ */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              סוג הקובץ:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => setFileType('boys')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  fileType === 'boys' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <User className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-semibold">רק בנים</div>
                  <div className="text-sm text-gray-600">כל השורות ייחשבו כבנים</div>
                </div>
              </div>
              
              <div 
                onClick={() => setFileType('girls')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  fileType === 'girls' 
                    ? 'border-pink-500 bg-pink-50 text-pink-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <User className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-semibold">רק בנות</div>
                  <div className="text-sm text-gray-600">כל השורות ייחשבו כבנות</div>
                </div>
              </div>
              
              <div 
                onClick={() => setFileType('mixed')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  fileType === 'mixed' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-semibold">מעורב</div>
                  <div className="text-sm text-gray-600">אסמן בעצמי לכל שורה</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload className="w-5 h-5 mr-2" />
              בחר קובץ
            </label>
          </div>
        </div>
      )}

      {currentStep === 'tabs' && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-4">בחירת טאבים לעיבוד</h3>
            <p className="text-gray-600 mb-6">
              נמצאו {availableSheets.length} טאבים בקובץ. בחר אילו טאבים לעבד וקבע את סוג המועמדים בכל טאב.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            {availableSheets.map((sheetName, index) => {
              const isSelected = selectedSheets.find(s => s.name === sheetName);
              return (
                <div key={sheetName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`sheet-${index}`}
                        checked={!!isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSheets(prev => [...prev, { name: sheetName, type: 'boys' }]);
                          } else {
                            setSelectedSheets(prev => prev.filter(s => s.name !== sheetName));
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <label htmlFor={`sheet-${index}`} className="font-medium text-gray-900">
                        {sheetName}
                      </label>
                    </div>
                    
                    {isSelected && (
                      <select
                        value={isSelected.type}
                        onChange={(e) => {
                          setSelectedSheets(prev => 
                            prev.map(s => 
                              s.name === sheetName 
                                ? { ...s, type: e.target.value as 'boys' | 'girls' }
                                : s
                            )
                          );
                        }}
                        className="px-3 py-1 border rounded bg-white"
                      >
                        <option value="boys">בנים</option>
                        <option value="girls">בנות</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={reset}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              חזרה
            </button>
            
            <button
              onClick={processSelectedSheets}
              disabled={selectedSheets.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              עבד {selectedSheets.length} טאבים
            </button>
          </div>
        </div>
      )}

      {currentStep === 'analyzing' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-4">מנתח את הקובץ...</h3>
          <p className="text-gray-600">
            מזהה שדות, מנתח נתונים ומכין תצוגה מקדימה
          </p>
        </div>
      )}

      {currentStep === 'preview' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">תצוגה מקדימה</h3>
              <div className="text-sm text-gray-600">
                {parsedCandidates.length} מועמדים זוהו
              </div>
            </div>
            
            {/* בחירת מצב הייבוא */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                מצב ייבוא:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setImportMode('append')}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    importMode === 'append' 
                      ? 'border-green-500 bg-green-50 text-green-700' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <Plus className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-semibold">הוספה לקיים</div>
                      <div className="text-xs text-gray-600">הוסף את המועמדים החדשים לרשימה הקיימת</div>
                    </div>
                  </div>
                </div>
                
                <div 
                  onClick={() => setImportMode('replace')}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    importMode === 'replace' 
                      ? 'border-red-500 bg-red-50 text-red-700' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <RefreshCw className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-semibold">החלפה מלאה</div>
                      <div className="text-xs text-gray-600">מחק את כל המועמדים הקיימים והחלף במועמדים החדשים</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {importMode === 'replace' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-red-700">
                      <strong>אזהרה:</strong> כל המועמדים הקיימים במערכת יימחקו לצמיתות ויוחלפו במועמדים החדשים מהקובץ.
                    </div>
                  </div>
                </div>
              )}

              {/* הצגת סוג הקובץ הנוכחי ואפשרות לשינוי */}
              {currentStep === 'preview' && !availableSheets.length && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    סוג הקובץ שנבחר:
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div 
                      onClick={() => updateFileType('boys')}
                      className={`p-2 border-2 rounded-lg cursor-pointer transition-colors text-center ${
                        fileType === 'boys' 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <User className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-xs font-semibold">רק בנים</div>
                    </div>
                    
                    <div 
                      onClick={() => updateFileType('girls')}
                      className={`p-2 border-2 rounded-lg cursor-pointer transition-colors text-center ${
                        fileType === 'girls' 
                          ? 'border-pink-500 bg-pink-50 text-pink-700' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <User className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-xs font-semibold">רק בנות</div>
                    </div>
                    
                    <div 
                      onClick={() => updateFileType('mixed')}
                      className={`p-2 border-2 rounded-lg cursor-pointer transition-colors text-center ${
                        fileType === 'mixed' 
                          ? 'border-green-500 bg-green-50 text-green-700' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Users className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-xs font-semibold">מעורב</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {parsedCandidates.length > 0 && (
              <div className="space-y-4">
                {/* ניווט */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    מועמד {previewIndex + 1} מתוך {parsedCandidates.length}
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                      disabled={previewIndex === 0}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      הקודם
                    </button>
                    <button
                      onClick={() => setPreviewIndex(Math.min(parsedCandidates.length - 1, previewIndex + 1))}
                      disabled={previewIndex === parsedCandidates.length - 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      הבא
                    </button>
                  </div>
                </div>

                {/* פרטי מועמד */}
                {parsedCandidates[previewIndex] && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <h4 className="font-semibold text-lg">
                          שורה {parsedCandidates[previewIndex].rowIndex}
                        </h4>
                        <select
                          value={parsedCandidates[previewIndex].type}
                          onChange={(e) => updateCandidateType(previewIndex, e.target.value as 'boy' | 'girl')}
                          className="px-3 py-1 border rounded bg-white"
                        >
                          <option value="boy">בחור</option>
                          <option value="girl">בחורה</option>
                        </select>
                      </div>
                      
                      <div className={`px-2 py-1 text-xs rounded-full ${
                        parsedCandidates[previewIndex].confidence > 0.8 ? 'bg-green-100 text-green-800' :
                        parsedCandidates[previewIndex].confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {Math.round(parsedCandidates[previewIndex].confidence * 100)}% ביטחון
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>שם:</strong> {parsedCandidates[previewIndex].data.name}</div>
                      <div><strong>גיל:</strong> {parsedCandidates[previewIndex].data.age}</div>
                      <div><strong>מקום:</strong> {parsedCandidates[previewIndex].data.location}</div>
                      <div><strong>מצב משפחתי:</strong> {parsedCandidates[previewIndex].data.marital_status}</div>
                      <div><strong>סוג:</strong> 
                        <span className={`px-2 py-1 rounded text-xs ml-2 ${
                          parsedCandidates[previewIndex].type === 'boy' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {parsedCandidates[previewIndex].type === 'boy' ? 'בחור' : 'בחורה'}
                        </span>
                      </div>
                      {parsedCandidates[previewIndex].data.profession && (
                        <div><strong>מקצוע:</strong> {parsedCandidates[previewIndex].data.profession}</div>
                      )}
                      {parsedCandidates[previewIndex].data.education && (
                        <div><strong>השכלה:</strong> {parsedCandidates[previewIndex].data.education}</div>
                      )}
                      {parsedCandidates[previewIndex].data.religious_level && (
                        <div><strong>רמה דתית:</strong> {parsedCandidates[previewIndex].data.religious_level}</div>
                      )}
                      {parsedCandidates[previewIndex].data.hobbies && (
                        <div><strong>תחביבים:</strong> {parsedCandidates[previewIndex].data.hobbies}</div>
                      )}
                      {parsedCandidates[previewIndex].contactData?.email && (
                        <div><strong>מייל:</strong> {parsedCandidates[previewIndex].contactData.email}</div>
                      )}
                      {parsedCandidates[previewIndex].contactData?.phone && (
                        <div><strong>טלפון:</strong> {parsedCandidates[previewIndex].contactData.phone}</div>
                      )}
                    </div>
                    
                    {/* שדות טקסט ארוך */}
                    {(parsedCandidates[previewIndex].data.looking_for || 
                      parsedCandidates[previewIndex].data.about_me ||
                      parsedCandidates[previewIndex].data.values_and_beliefs) && (
                      <div className="mt-4 space-y-2">
                        {parsedCandidates[previewIndex].data.looking_for && (
                          <div className="text-sm">
                            <strong>מחפש/ת:</strong>
                            <p className="text-gray-600 mt-1">{parsedCandidates[previewIndex].data.looking_for}</p>
                          </div>
                        )}
                        {parsedCandidates[previewIndex].data.about_me && (
                          <div className="text-sm">
                            <strong>על עצמי:</strong>
                            <p className="text-gray-600 mt-1">{parsedCandidates[previewIndex].data.about_me}</p>
                          </div>
                        )}
                        {parsedCandidates[previewIndex].data.values_and_beliefs && (
                          <div className="text-sm">
                            <strong>ערכים ואמונות:</strong>
                            <p className="text-gray-600 mt-1">{parsedCandidates[previewIndex].data.values_and_beliefs}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {parsedCandidates[previewIndex].issues.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                        <strong className="text-red-800">בעיות:</strong>
                        <ul className="list-disc list-inside text-red-700 text-sm">
                          {parsedCandidates[previewIndex].issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* כפתורי פעולה */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={reset}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    התחל מחדש
                  </button>
                  
                  <button
                    onClick={executeImport}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    disabled={parsedCandidates.every(c => c.issues.length > 0)}
                  >
                    יבא {parsedCandidates.filter(c => c.issues.length === 0).length} מועמדים
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 'importing' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="w-16 h-16 text-green-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-4">מייבא מועמדים...</h3>
          <p className="text-gray-600">
            יוצר רשומות בבסיס הנתונים...
          </p>
        </div>
      )}

      {currentStep === 'complete' && importResults && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-4">הייבוא הושלם בהצלחה!</h3>
            
            {/* הצגת מצב הייבוא שבוצע */}
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4 ${
              importMode === 'append' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {importMode === 'append' ? (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  נוספו לרשימה הקיימת
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  הוחלפו כל המועמדים הקיימים
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{importResults.totalRows}</div>
              <div className="text-sm text-gray-600">סה"כ שורות</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{importResults.successfulImports}</div>
              <div className="text-sm text-gray-600">יובאו בהצלחה</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{importResults.failures.length}</div>
              <div className="text-sm text-gray-600">כשלונות</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-xl font-bold text-blue-600">{importResults.boys.length}</div>
              <div className="text-sm text-gray-600">בנים</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-xl font-bold text-pink-600">{importResults.girls.length}</div>
              <div className="text-sm text-gray-600">בנות</div>
            </div>
          </div>

          {importResults.failures.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">שורות שנכשלו:</h4>
              <div className="max-h-32 overflow-y-auto">
                {importResults.failures.map((failure, i) => (
                  <div key={i} className="text-sm text-red-700 mb-1">
                    שורה {failure.rowIndex}: {failure.errors.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={reset}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              יבא קובץ נוסף
            </button>
          </div>
        </div>
      )}
    </div>
  );
};