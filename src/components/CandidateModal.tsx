import React, { useState, useEffect } from 'react';
import { X, Save, Edit, Phone, Mail, MapPin, Heart, User, Briefcase, GraduationCap, Home, Star } from 'lucide-react';
import { SupabaseCandidate, CandidateContact, EnhancedSupabaseCandidate } from '../types';
import {
  getBoy,
  getGirl,
  updateBoy,
  updateGirl,
  getCandidateContact,
  updateCandidateContact,
  createCandidateContact,
  validateCandidateData
} from '../lib/candidates';

interface CandidateModalProps {
  candidateId: string;
  candidateType: 'boys' | 'girls';
  mode: 'view' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  onSave?: (candidate: SupabaseCandidate) => void;
}

export const CandidateModal: React.FC<CandidateModalProps> = ({
  candidateId,
  candidateType,
  mode: initialMode,
  isOpen,
  onClose,
  onSave
}) => {
  const [candidate, setCandidate] = useState<EnhancedSupabaseCandidate | null>(null);
  const [contact, setContact] = useState<CandidateContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [formData, setFormData] = useState<Partial<SupabaseCandidate>>({});
  const [contactData, setContactData] = useState<Partial<CandidateContact>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const isGirl = candidateType === 'girls';
  const getFunction = isGirl ? getGirl : getBoy;
  const updateFunction = isGirl ? updateGirl : updateBoy;

  // טעינת נתוני המועמד
  useEffect(() => {
    if (isOpen && candidateId) {
      loadCandidateData();
    }
  }, [isOpen, candidateId, candidateType]);

  // איפוס מצב כשהמודל נפתח/נסגר
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrors([]);
    }
  }, [isOpen, initialMode]);

  const loadCandidateData = async () => {
    setLoading(true);

    try {
      const candidateData = await getFunction(candidateId);

      if (candidateData) {
        setCandidate(candidateData);
        setFormData(candidateData);

        // טעינת פרטי קשר
        const contactData = await getCandidateContact(candidateId, candidateType === 'girls' ? 'girl' : 'boy');
        setContact(contactData);
        setContactData(contactData || {});
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // הכנת נתונים לעדכון - רק שדות שקיימים בטבלת המועמדים
    const candidateUpdateData = {
      name: formData.name,
      birth_date: formData.birth_date,
      age: formData.age,
      preferred_age_range: formData.preferred_age_range,
      marital_status: formData.marital_status,
      open_to_other_sectors: formData.open_to_other_sectors,
      sector: formData.sector,
      community: formData.community,
      religious_level: formData.religious_level,
      religious_stream: formData.religious_stream,
      siblings: formData.siblings,
      birth_order: formData.birth_order,
      location: formData.location,
      education: formData.education,
      profession: formData.profession,
      languages: formData.languages,
      height: formData.height,
      appearance: formData.appearance,
      dress_style: formData.dress_style,
      smoking: formData.smoking,
      hobbies: formData.hobbies,
      values_and_beliefs: formData.values_and_beliefs,
      personality: formData.personality,
      lifestyle: formData.lifestyle,
      flexibility: formData.flexibility,
      internet_usage: formData.internet_usage,
      education_views: formData.education_views,
      about_me: formData.about_me,
      looking_for: formData.looking_for,
      important_qualities: formData.important_qualities,
      deal_breakers: formData.deal_breakers,
      additional_notes: formData.additional_notes,
      status: formData.status
    };


    // ולידציה
    const validationErrors = validateCandidateData(candidateUpdateData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      // עדכון נתוני המועמד
      const updatedCandidate = await updateFunction(candidateId, candidateUpdateData);

      // עדכון/יצירת פרטי קשר - רק שדות שקיימים בטבלה
      const contactUpdateData = {
        phone: contactData.phone?.trim() || undefined,
        email: contactData.email?.trim() || undefined,
        currently_proposed: contactData.currently_proposed?.trim() || undefined,
        previously_proposed: contactData.previously_proposed?.trim() || undefined
      };

      // בדיקה אם יש נתוני קשר אמיתיים
      const hasContactData = contactUpdateData.phone || contactUpdateData.email ||
                           contactUpdateData.currently_proposed || contactUpdateData.previously_proposed;

      if (hasContactData) {
        if (contact) {
          await updateCandidateContact(candidateId, candidateType === 'girls' ? 'girl' : 'boy', contactUpdateData);
        } else {
          await createCandidateContact(
            candidate!.shadchan_id,
            candidateId,
            candidateType === 'girls' ? 'girl' : 'boy',
            contactUpdateData
          );
        }
      }

      // עדכון הסטייט המקומי
      setCandidate({ ...candidate!, ...updatedCandidate });
      setMode('view');
      setErrors([]);

      // קריאה לקולבק החיצוני
      if (onSave) {
        onSave(updatedCandidate);
      }

    } catch (error) {
      setErrors(['שגיאה בשמירה. אנא נסה שוב.']);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SupabaseCandidate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // ניקוי שגיאות כשהמשתמש מתחיל לערוך
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleContactChange = (field: keyof CandidateContact, value: any) => {
    setContactData(prev => ({ ...prev, [field]: value }));
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
                {loading ? 'טוען...' : candidate?.name || 'מועמד חדש'}
              </h2>
              <p className="text-sm text-gray-500">
                {mode === 'edit' ? 'עריכת פרופיל' : 'צפייה בפרופיל'} • {isGirl ? 'בחורה' : 'בחור'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {mode === 'view' && (
              <button
                onClick={() => setMode('edit')}
                className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit className="w-4 h-4 mr-1" />
                ערוך
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* תוכן */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="mr-3 text-gray-600">טוען נתוני מועמד...</span>
            </div>
          ) : candidate ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600" />
                    מידע אישי
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                      {mode === 'edit' ? (
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="שם מלא"
                        />
                      ) : (
                        <p className="text-gray-900">{candidate.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">גיל</label>
                      {mode === 'edit' ? (
                        <input
                          type="number"
                          value={formData.age || ''}
                          onChange={(e) => handleInputChange('age', parseInt(e.target.value))}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="18"
                          max="120"
                        />
                      ) : (
                        <p className="text-gray-900">{candidate.age}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מקום מגורים</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="עיר, מדינה"
                      />
                    ) : (
                      <p className="text-gray-900 flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {candidate.location}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מצב משפחתי</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.marital_status || ''}
                        onChange={(e) => handleInputChange('marital_status', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">בחר מצב משפחתי</option>
                        <option value="רווק">רווק</option>
                        <option value="רווקה">רווקה</option>
                        <option value="גרוש">גרוש</option>
                        <option value="גרושה">גרושה</option>
                        <option value="אלמן">אלמן</option>
                        <option value="אלמנה">אלמנה</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{candidate.marital_status}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תאריך לידה</label>
                    {mode === 'edit' ? (
                      <input
                        type="date"
                        value={formData.birth_date || ''}
                        onChange={(e) => handleInputChange('birth_date', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.birth_date || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">טווח גיל מועדף</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.preferred_age_range || ''}
                        onChange={(e) => handleInputChange('preferred_age_range', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="למשל: 25-30"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.preferred_age_range || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Heart className="w-5 h-5 mr-2 text-red-600" />
                    רקע דתי ותרבותי
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">רמה דתית</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.religious_level || ''}
                        onChange={(e) => handleInputChange('religious_level', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">בחר רמה דתית</option>
                        <option value="חרדי">חרדי</option>
                        <option value="דתי">דתי</option>
                        <option value="מסורתי">מסורתי</option>
                        <option value="חילוני">חילוני</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{candidate.religious_level || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">עדה</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.community || ''}
                        onChange={(e) => handleInputChange('community', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    ) : (
                      <p className="text-gray-900">{candidate.community || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">זרם דתי</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.religious_stream || ''}
                        onChange={(e) => handleInputChange('religious_stream', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="למשל: ליטאי, חסידי וכו'"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.religious_stream || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">פתוח לסקטורים אחרים</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.open_to_other_sectors || ''}
                        onChange={(e) => handleInputChange('open_to_other_sectors', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">בחר</option>
                        <option value="כן">כן</option>
                        <option value="לא">לא</option>
                        <option value="תלוי">תלוי</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{candidate.open_to_other_sectors || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סקטור</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.sector || ''}
                        onChange={(e) => handleInputChange('sector', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="סקטור דתי"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.sector || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.status || ''}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="זמין">זמין</option>
                        <option value="בתהליך">בתהליך</option>
                        <option value="לא זמין">לא זמין</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        candidate.status === 'זמין' ? 'bg-green-100 text-green-800' :
                        candidate.status === 'בתהליך' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {candidate.status}
                      </span>
                    )}
                  </div>
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
                    {mode === 'edit' ? (
                      <input
                        type="number"
                        value={formData.siblings || ''}
                        onChange={(e) => handleInputChange('siblings', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="20"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.siblings || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מקום בסדר הלידה</label>
                    {mode === 'edit' ? (
                      <input
                        type="number"
                        value={formData.birth_order || ''}
                        onChange={(e) => handleInputChange('birth_order', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="20"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.birth_order || '-'}</p>
                    )}
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
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.height || ''}
                        onChange={(e) => handleInputChange('height', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="למשל: 1.70"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.height || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מראה</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.appearance || ''}
                        onChange={(e) => handleInputChange('appearance', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="תיאור מראה"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.appearance || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סגנון לבוש</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.dress_style || ''}
                        onChange={(e) => handleInputChange('dress_style', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="סגנון לבוש"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.dress_style || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">עישון</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.smoking || ''}
                        onChange={(e) => handleInputChange('smoking', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">בחר</option>
                        <option value="לא">לא</option>
                        <option value="כן">כן</option>
                        <option value="לפעמים">לפעמים</option>
                        <option value="בעבר">בעבר</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{candidate.smoking || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* מידע מקצועי */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-green-600" />
                  מידע מקצועי ולימודי
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מקצוע</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.profession || ''}
                        onChange={(e) => handleInputChange('profession', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="מקצוע נוכחי"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.profession || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">השכלה</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.education || ''}
                        onChange={(e) => handleInputChange('education', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="רמת השכלה או מוסד"
                      />
                    ) : (
                      <p className="text-gray-900 flex items-center">
                        <GraduationCap className="w-4 h-4 mr-1 text-gray-400" />
                        {candidate.education || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שפות</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.languages || ''}
                        onChange={(e) => handleInputChange('languages', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="שפות שמדבר/ת"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.languages || '-'}</p>
                    )}
                  </div>
                </div>

              </div>

              {/* מה מחפש */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-600" />
                  מה מחפש ואישיות
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">על עצמי</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.about_me || ''}
                      onChange={(e) => handleInputChange('about_me', e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="תיאור אישי..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.about_me || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תיאור מה שמחפש</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.looking_for || ''}
                      onChange={(e) => handleInputChange('looking_for', e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="תיאור מפורט של מה שמחפש בבן/בת זוג..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.looking_for || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תכונות חשובות</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.important_qualities || ''}
                      onChange={(e) => handleInputChange('important_qualities', e.target.value)}
                      rows={2}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="תכונות שחשובות לו/לה..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.important_qualities || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">דברים שלא מתאימים</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.deal_breakers || ''}
                      onChange={(e) => handleInputChange('deal_breakers', e.target.value)}
                      rows={2}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="דברים שלא מתאימים..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.deal_breakers || '-'}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תחביבים</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.hobbies || ''}
                        onChange={(e) => handleInputChange('hobbies', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="תחביבים ותחומי עניין"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.hobbies || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אישיות</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.personality || ''}
                        onChange={(e) => handleInputChange('personality', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="תיאור אישיות"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.personality || '-'}</p>
                    )}
                  </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                    {mode === 'edit' ? (
                      <input
                        type="tel"
                        value={contactData.phone || ''}
                        onChange={(e) => handleContactChange('phone', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="מספר טלפון"
                      />
                    ) : (
                      <p className="text-gray-900 flex items-center">
                        <Phone className="w-4 h-4 mr-1 text-gray-400" />
                        {contact?.phone || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                    {mode === 'edit' ? (
                      <input
                        type="email"
                        value={contactData.email || ''}
                        onChange={(e) => handleContactChange('email', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="כתובת אימייל"
                      />
                    ) : (
                      <p className="text-gray-900 flex items-center">
                        <Mail className="w-4 h-4 mr-1 text-gray-400" />
                        {contact?.email || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הצעות נוכחיות</label>
                    {mode === 'edit' ? (
                      <textarea
                        value={contactData.currently_proposed || ''}
                        onChange={(e) => handleContactChange('currently_proposed', e.target.value)}
                        rows={2}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="הצעות שדיכים נוכחיות..."
                      />
                    ) : (
                      <p className="text-gray-900">{contact?.currently_proposed || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הצעות קודמות</label>
                    {mode === 'edit' ? (
                      <textarea
                        value={contactData.previously_proposed || ''}
                        onChange={(e) => handleContactChange('previously_proposed', e.target.value)}
                        rows={2}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="הצעות שדיכים קודמות..."
                      />
                    ) : (
                      <p className="text-gray-900">{contact?.previously_proposed || '-'}</p>
                    )}
                  </div>
                </div>

              </div>

              {/* מידע נוסף */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Home className="w-5 h-5 mr-2 text-indigo-600" />
                  מידע נוסף ואורח חיים
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אורח חיים</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.lifestyle || ''}
                        onChange={(e) => handleInputChange('lifestyle', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="תיאור אורח חיים"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.lifestyle || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">גמישות</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.flexibility || ''}
                        onChange={(e) => handleInputChange('flexibility', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="מידת הגמישות"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.flexibility || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שימוש באינטרנט</label>
                    {mode === 'edit' ? (
                      <select
                        value={formData.internet_usage || ''}
                        onChange={(e) => handleInputChange('internet_usage', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">בחר</option>
                        <option value="כן">כן</option>
                        <option value="לא">לא</option>
                        <option value="מוגבל">מוגבל</option>
                        <option value="לעבודה בלבד">לעבודה בלבד</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{candidate.internet_usage || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">דעות על חינוך</label>
                    {mode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.education_views || ''}
                        onChange={(e) => handleInputChange('education_views', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="דעות על חינוך ילדים"
                      />
                    ) : (
                      <p className="text-gray-900">{candidate.education_views || '-'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ערכים ואמונות</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.values_and_beliefs || ''}
                      onChange={(e) => handleInputChange('values_and_beliefs', e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ערכים ואמונות חשובים..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.values_and_beliefs || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">הערות נוספות</label>
                  {mode === 'edit' ? (
                    <textarea
                      value={formData.additional_notes || ''}
                      onChange={(e) => handleInputChange('additional_notes', e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="הערות נוספות על המועמד..."
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{candidate.additional_notes || '-'}</p>
                  )}
                </div>

                {/* מידע על יצירה ועדכון */}
                <div className="text-xs text-gray-500 border-t pt-4">
                  <p>נוצר: {new Date(candidate.created_at).toLocaleDateString('he-IL')}</p>
                  {candidate.updated_at && (
                    <p>עודכן: {new Date(candidate.updated_at).toLocaleDateString('he-IL')}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">לא נמצא מועמד</p>
            </div>
          )}
        </div>

        {/* כפתורים */}
        {candidate && (
          <div className="flex justify-between items-center p-6 border-t bg-gray-50">
            <div>
              {mode === 'edit' && (
                <button
                  onClick={() => {
                    setMode('view');
                    setFormData(candidate);
                    setContactData(contact || {});
                    setErrors([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  ביטול
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              {mode === 'edit' ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      שומר...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      שמור
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  סגור
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};