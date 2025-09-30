import React, { useState } from 'react';
import { X, Save, User, Heart, Briefcase, Phone, Home, MapPin, Mail } from 'lucide-react';
import { SupabaseCandidate, CandidateContact } from '../types';
import {
  createBoy,
  createGirl,
  createCandidateContact,
  validateCandidateData,
  generateInternalId
} from '../lib/candidates';

interface CandidateFormProps {
  shadchanId: string;
  candidateType: 'boys' | 'girls';
  isOpen: boolean;
  onClose: () => void;
  onSave?: (candidate: SupabaseCandidate) => void;
}

interface FormData {
  // מידע בסיסי - 38 שדות מדויקים כמו בסופהבייס
  name: string;
  birth_date: string;
  age: number | '';
  preferred_age_range: string;
  marital_status: string;
  open_to_other_sectors: string;
  sector: string;
  community: string;
  religious_level: string;
  religious_stream: string;
  siblings: number | '';
  birth_order: number | '';
  location: string;
  education: string;
  profession: string;
  languages: string;
  height: string;
  appearance: string;
  dress_style: string;
  smoking: string;
  hobbies: string;
  values_and_beliefs: string;
  personality: string;
  lifestyle: string;
  flexibility: string;
  internet_usage: string;
  education_views: string;
  about_me: string;
  looking_for: string;
  important_qualities: string;
  deal_breakers: string;
  additional_notes: string;
  status: string;

  // פרטי קשר - שדות מטבלת candidates_contact
  phone: string;
  email: string;
  currently_proposed: string;
  previously_proposed: string;
}

const initialFormData: FormData = {
  name: '',
  birth_date: '',
  age: '',
  preferred_age_range: '',
  marital_status: '',
  open_to_other_sectors: '',
  sector: '',
  community: '',
  religious_level: '',
  religious_stream: '',
  siblings: '',
  birth_order: '',
  location: '',
  education: '',
  profession: '',
  languages: '',
  height: '',
  appearance: '',
  dress_style: '',
  smoking: '',
  hobbies: '',
  values_and_beliefs: '',
  personality: '',
  lifestyle: '',
  flexibility: '',
  internet_usage: '',
  education_views: '',
  about_me: '',
  looking_for: '',
  important_qualities: '',
  deal_breakers: '',
  additional_notes: '',
  status: 'זמין',
  phone: '',
  email: '',
  currently_proposed: '',
  previously_proposed: ''
};

export const CandidateForm: React.FC<CandidateFormProps> = ({
  shadchanId,
  candidateType,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [saving, setSaving] = useState(false);

  // פונקציה לבדיקת תקינות אימייל
  const isEmailValid = (email: string): boolean => {
    if (!email.trim()) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // פונקציה לבדיקת תקינות טלפון
  const isPhoneValid = (phone: string): boolean => {
    if (!phone.trim()) return false;
    // תקבל מספרים, מקפים, רווחים, וסימני + לקוד מדינה
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone.trim());
  };

  // פונקציה לבדיקת שדה חובה כללי
  const validateRequiredField = (fieldName: string, value: any): string | null => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      const fieldLabels: {[key: string]: string} = {
        'name': 'שם מלא',
        'age': 'גיל',
        'location': 'מקום מגורים',
        'marital_status': 'מצב משפחתי',
        'phone': 'מספר טלפון',
        'email': 'כתובת אימייל'
      };
      return `${fieldLabels[fieldName] || fieldName} הוא שדה חובה`;
    }
    return null;
  };

  const isGirl = candidateType === 'girls';
  const createFunction = isGirl ? createGirl : createBoy;

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // רשימת שדות חובה
    const requiredFields = ['name', 'age', 'location', 'marital_status', 'phone', 'email'];

    // ולידציה בזמן אמת
    if (requiredFields.includes(field)) {
      // בדיקת שדה חובה כללית
      const requiredError = validateRequiredField(field, value);
      if (requiredError) {
        setFieldErrors(prev => ({ ...prev, [field]: requiredError }));
        return;
      }

      // ולידציות ספציפיות לשדות מסוימים
      if (field === 'email') {
        if (!isEmailValid(value)) {
          setFieldErrors(prev => ({ ...prev, email: 'כתובת האימייל אינה תקינה' }));
          return;
        }
      }

      if (field === 'phone') {
        if (!isPhoneValid(value)) {
          setFieldErrors(prev => ({ ...prev, phone: 'מספר הטלפון אינו תקין' }));
          return;
        }
      }

      // אם הגענו לכאן - השדה תקין, נקה את השגיאה
      setFieldErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }

    // ניקוי שגיאות כלליות כשהמשתמש מתחיל לערוך
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setErrors([]);
    setFieldErrors({});
    onClose();
  };

  const handleSave = async () => {
    // הכנת נתוני המועמד - כל השדות הקיימים בטבלה
    const candidateData: Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at' | 'updated_at'> = {
      internal_id: generateInternalId(formData.name, Number(formData.age)),
      name: formData.name.trim(),
      birth_date: formData.birth_date.trim() || undefined,
      age: Number(formData.age),
      preferred_age_range: formData.preferred_age_range.trim() || undefined,
      marital_status: formData.marital_status,
      open_to_other_sectors: formData.open_to_other_sectors.trim() || undefined,
      sector: formData.sector.trim() || undefined,
      community: formData.community.trim() || undefined,
      religious_level: formData.religious_level.trim() || undefined,
      religious_stream: formData.religious_stream.trim() || undefined,
      siblings: formData.siblings ? Number(formData.siblings) : undefined,
      birth_order: formData.birth_order ? Number(formData.birth_order) : undefined,
      location: formData.location.trim(),
      education: formData.education.trim() || undefined,
      profession: formData.profession.trim() || undefined,
      languages: formData.languages.trim() || undefined,
      height: formData.height.trim() || undefined,
      appearance: formData.appearance.trim() || undefined,
      dress_style: formData.dress_style.trim() || undefined,
      smoking: formData.smoking.trim() || undefined,
      hobbies: formData.hobbies.trim() || undefined,
      values_and_beliefs: formData.values_and_beliefs.trim() || undefined,
      personality: formData.personality.trim() || undefined,
      lifestyle: formData.lifestyle.trim() || undefined,
      flexibility: formData.flexibility.trim() || undefined,
      internet_usage: formData.internet_usage.trim() || undefined,
      education_views: formData.education_views.trim() || undefined,
      about_me: formData.about_me.trim() || undefined,
      looking_for: formData.looking_for.trim() || undefined,
      important_qualities: formData.important_qualities.trim() || undefined,
      deal_breakers: formData.deal_breakers.trim() || undefined,
      additional_notes: formData.additional_notes.trim() || undefined,
      status: 'זמין' // ברירת מחדל
    };

    // ולידציה
    const validationErrors = validateCandidateData(candidateData);

    // ולידציה נוספת לפרטי קשר
    if (!formData.phone?.trim()) {
      validationErrors.push('מספר טלפון הוא שדה חובה');
    } else if (!isPhoneValid(formData.phone)) {
      validationErrors.push('מספר הטלפון אינו תקין');
    }

    if (!formData.email?.trim()) {
      validationErrors.push('כתובת אימייל היא שדה חובה');
    } else if (!isEmailValid(formData.email)) {
      validationErrors.push('כתובת האימייל אינה תקינה');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      // יצירת המועמד
      const newCandidate = await createFunction(shadchanId, candidateData);

      // יצירת פרטי קשר - עכשיו זה חובה כי טלפון ואימייל חובה
      const contactData: Omit<CandidateContact, 'id' | 'shadchan_id' | 'candidate_id' | 'candidate_type' | 'created_at' | 'updated_at'> = {
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        currently_proposed: formData.currently_proposed.trim() || undefined,
        previously_proposed: formData.previously_proposed.trim() || undefined
      };


      try {
        await createCandidateContact(
          shadchanId,
          newCandidate.id,
          candidateType === 'girls' ? 'girl' : 'boy',
          contactData
        );
      } catch (contactError) {
        // זרוק שגיאה כי פרטי קשר הם חובה עכשיו
        throw new Error('שגיאה ביצירת פרטי קשר');
      }

      // איפוס הטופס
      setFormData(initialFormData);
      setErrors([]);

      // קריאה לקולבק החיצוני
      if (onSave) {
        onSave(newCandidate);
      }

      // סגירת המודל
      onClose();

    } catch (error) {
      setErrors(['שגיאה ביצירת המועמד. אנא נסה שוב.']);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* כותרת */}
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isGirl ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                הוספת {isGirl ? 'בחורה' : 'בחור'} חדש{isGirl ? 'ה' : ''}
              </h2>
              <p className="text-sm text-gray-500">
                מלא את הפרטים ליצירת פרופיל מועמד חדש
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* תוכן */}
        <div className="p-6">
          <div className="space-y-6">
            {/* שגיאות */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-red-800 font-medium mb-2">שגיאות שיש לתקן:</h4>
                <ul className="text-red-700 text-sm space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* מידע בסיסי */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                מידע אישי
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם מלא <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                    }`}
                    placeholder="שם פרטי ומשפחה"
                    required
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    גיל <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value ? parseInt(e.target.value) : '')}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.age ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                    }`}
                    placeholder="גיל"
                    min="18"
                    max="120"
                    required
                  />
                  {fieldErrors.age && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.age}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מקום מגורים <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className={`w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.location ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                    }`}
                    placeholder="עיר, מדינה"
                    required
                  />
                </div>
                {fieldErrors.location && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.location}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מצב משפחתי <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.marital_status}
                    onChange={(e) => handleInputChange('marital_status', e.target.value)}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.marital_status ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                    }`}
                    required
                  >
                    <option value="">בחר מצב משפחתי</option>
                    <option value={isGirl ? "רווקה" : "רווק"}>{isGirl ? "רווקה" : "רווק"}</option>
                    <option value={isGirl ? "גרושה" : "גרוש"}>{isGirl ? "גרושה" : "גרוש"}</option>
                    <option value={isGirl ? "אלמנה" : "אלמן"}>{isGirl ? "אלמנה" : "אלמן"}</option>
                  </select>
                  {fieldErrors.marital_status && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.marital_status}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תאריך לידה</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleInputChange('birth_date', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טווח גיל מועדף</label>
                <input
                  type="text"
                  value={formData.preferred_age_range}
                  onChange={(e) => handleInputChange('preferred_age_range', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="למשל: 25-30"
                />
              </div>
            </div>

            {/* רקע דתי ותרבותי */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-red-600" />
                רקע דתי ותרבותי
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">רמה דתית</label>
                  <select
                    value={formData.religious_level}
                    onChange={(e) => handleInputChange('religious_level', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר רמה דתית</option>
                    <option value="חרדי">חרדי</option>
                    <option value="דתי">דתי</option>
                    <option value="מסורתי">מסורתי</option>
                    <option value="חילוני">חילוני</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">עדה</label>
                  <select
                    value={formData.community}
                    onChange={(e) => handleInputChange('community', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר עדה</option>
                    <option value="אשכנזי">אשכנזי</option>
                    <option value="ספרדי">ספרדי</option>
                    <option value="מזרחי">מזרחי</option>
                    <option value="תימני">תימני</option>
                    <option value="אתיופי">אתיופי</option>
                    <option value="חב״ד">חב״ד</option>
                    <option value="ברסלב">ברסלב</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">זרם דתי</label>
                  <input
                    type="text"
                    value={formData.religious_stream}
                    onChange={(e) => handleInputChange('religious_stream', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="למשל: ליטאי, חסידי וכו'"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">פתוח לסקטורים אחרים</label>
                  <select
                    value={formData.open_to_other_sectors}
                    onChange={(e) => handleInputChange('open_to_other_sectors', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר</option>
                    <option value="כן">כן</option>
                    <option value="לא">לא</option>
                    <option value="תלוי">תלוי</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סקטור</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => handleInputChange('sector', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="סקטור דתי"
                />
              </div>
            </div>

            {/* מידע משפחתי */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Home className="w-5 h-5 mr-2 text-purple-600" />
                מידע משפחתי
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר אחים</label>
                  <input
                    type="number"
                    value={formData.siblings}
                    onChange={(e) => handleInputChange('siblings', e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="20"
                    placeholder="מספר אחים"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מקום בסדר הלידה</label>
                  <input
                    type="number"
                    value={formData.birth_order}
                    onChange={(e) => handleInputChange('birth_order', e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="20"
                    placeholder="מקום בסדר הלידה"
                  />
                </div>
              </div>
            </div>

            {/* מראה חיצוני ואורח חיים */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-orange-600" />
                מראה חיצוני ואורח חיים
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">גובה</label>
                  <input
                    type="text"
                    value={formData.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="למשל: 1.70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מראה</label>
                  <input
                    type="text"
                    value={formData.appearance}
                    onChange={(e) => handleInputChange('appearance', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="תיאור מראה"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">סגנון לבוש</label>
                  <input
                    type="text"
                    value={formData.dress_style}
                    onChange={(e) => handleInputChange('dress_style', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="סגנון לבוש"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">עישון</label>
                  <select
                    value={formData.smoking}
                    onChange={(e) => handleInputChange('smoking', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר</option>
                    <option value="לא">לא</option>
                    <option value="כן">כן</option>
                    <option value="לפעמים">לפעמים</option>
                    <option value="בעבר">בעבר</option>
                  </select>
                </div>
              </div>
            </div>

            {/* מידע מקצועי ולימודי */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-green-600" />
                מידע מקצועי ולימודי
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מקצוע</label>
                  <input
                    type="text"
                    value={formData.profession}
                    onChange={(e) => handleInputChange('profession', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="מקצוע נוכחי"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">השכלה</label>
                  <input
                    type="text"
                    value={formData.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="רמת השכלה או מוסד"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שפות</label>
                  <input
                    type="text"
                    value={formData.languages}
                    onChange={(e) => handleInputChange('languages', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="שפות שמדבר/ת"
                  />
                </div>
              </div>
            </div>

            {/* אישיות ותחביבים */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-pink-600" />
                אישיות ותחביבים
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אישיות</label>
                  <input
                    type="text"
                    value={formData.personality}
                    onChange={(e) => handleInputChange('personality', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="תיאור אישיות"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תחביבים</label>
                  <input
                    type="text"
                    value={formData.hobbies}
                    onChange={(e) => handleInputChange('hobbies', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="תחביבים ותחומי עניין"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אורח חיים</label>
                  <input
                    type="text"
                    value={formData.lifestyle}
                    onChange={(e) => handleInputChange('lifestyle', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="תיאור אורח חיים"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">גמישות</label>
                  <input
                    type="text"
                    value={formData.flexibility}
                    onChange={(e) => handleInputChange('flexibility', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="מידת הגמישות"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שימוש באינטרנט</label>
                  <select
                    value={formData.internet_usage}
                    onChange={(e) => handleInputChange('internet_usage', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר</option>
                    <option value="כן">כן</option>
                    <option value="לא">לא</option>
                    <option value="מוגבל">מוגבל</option>
                    <option value="לעבודה בלבד">לעבודה בלבד</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">דעות על חינוך</label>
                  <input
                    type="text"
                    value={formData.education_views}
                    onChange={(e) => handleInputChange('education_views', e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="דעות על חינוך ילדים"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ערכים ואמונות</label>
                <textarea
                  value={formData.values_and_beliefs}
                  onChange={(e) => handleInputChange('values_and_beliefs', e.target.value)}
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ערכים ואמונות חשובים..."
                />
              </div>
            </div>

            {/* מה מחפש ואישיות */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-yellow-600" />
                מה מחפש{isGirl ? 'ת' : ''} ותכונות חשובות
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">על עצמי</label>
                <textarea
                  value={formData.about_me}
                  onChange={(e) => handleInputChange('about_me', e.target.value)}
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="תיאור אישי..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תיאור מה שמחפש{isGirl ? 'ת' : ''}
                </label>
                <textarea
                  value={formData.looking_for}
                  onChange={(e) => handleInputChange('looking_for', e.target.value)}
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`תיאור מפורט של מה שמחפש${isGirl ? 'ת' : ''} בבן/בת זוג...`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תכונות חשובות</label>
                <textarea
                  value={formData.important_qualities}
                  onChange={(e) => handleInputChange('important_qualities', e.target.value)}
                  rows={2}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="תכונות שחשובות לו/לה..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">דברים שלא מתאימים</label>
                <textarea
                  value={formData.deal_breakers}
                  onChange={(e) => handleInputChange('deal_breakers', e.target.value)}
                  rows={2}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="דברים שלא מתאימים..."
                />
              </div>
            </div>

            {/* פרטי קשר */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Phone className="w-5 h-5 mr-2 text-purple-600" />
                פרטי קשר
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    טלפון <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        fieldErrors.phone ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                      }`}
                      placeholder="מספר טלפון"
                      required
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    אימייל <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        fieldErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                      }`}
                      placeholder="כתובת אימייל"
                      required
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">הצעות נוכחיות</label>
                  <textarea
                    value={formData.currently_proposed}
                    onChange={(e) => handleInputChange('currently_proposed', e.target.value)}
                    rows={2}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="הצעות שדיכים נוכחיות..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">הצעות קודמות</label>
                  <textarea
                    value={formData.previously_proposed}
                    onChange={(e) => handleInputChange('previously_proposed', e.target.value)}
                    rows={2}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="הצעות שדיכים קודמות..."
                  />
                </div>
              </div>
            </div>

            {/* מידע נוסף */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Home className="w-5 h-5 mr-2 text-indigo-600" />
                מידע נוסף
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות נוספות</label>
                <textarea
                  value={formData.additional_notes}
                  onChange={(e) => handleInputChange('additional_notes', e.target.value)}
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="הערות נוספות על המועמד..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="זמין">זמין</option>
                  <option value="בתהליך">בתהליך</option>
                  <option value="לא זמין">לא זמין</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* כפתורים */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-600 hover:text-gray-800"
          >
            ביטול
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !formData.name || !formData.age || !formData.location || !formData.marital_status || !formData.phone || !formData.email || !isEmailValid(formData.email) || !isPhoneValid(formData.phone) || Object.keys(fieldErrors).length > 0}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                יוצר...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                צור מועמד{isGirl ? 'ת' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};