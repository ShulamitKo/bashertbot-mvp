// API לטיפול במועמדים בסופהבייס
import { supabase } from './supabase';
import type { 
  SupabaseCandidate, 
  CandidateContact, 
  EnhancedSupabaseCandidate,
  CandidateSearchParams,
  CandidateSearchResults 
} from '../types';

// =============== פונקציות CRUD לבנים ===============

export const createBoy = async (
  shadchanId: string,
  candidateData: Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at' | 'updated_at'>
): Promise<SupabaseCandidate> => {

  const { data, error } = await supabase
    .from('candidates_boys')
    .insert({
      ...candidateData,
      shadchan_id: shadchanId,
    })
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה ביצירת בחור: ${error.message}`);
  }

  return data;
};

export const updateBoy = async (
  candidateId: string,
  updates: Partial<Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at'>>
): Promise<SupabaseCandidate> => {

  // סינון רק שדות שמותרים לעדכון - מבוסס על הסכמת הטבלה האמיתית
  const allowedFields = [
    'internal_id', 'name', 'birth_date', 'age', 'preferred_age_range', 'marital_status',
    'open_to_other_sectors', 'sector', 'community', 'religious_level', 'religious_stream',
    'siblings', 'birth_order', 'location', 'education', 'profession', 'languages',
    'height', 'appearance', 'dress_style', 'smoking', 'hobbies', 'values_and_beliefs',
    'personality', 'lifestyle', 'flexibility', 'internet_usage', 'education_views',
    'about_me', 'looking_for', 'important_qualities', 'deal_breakers',
    'additional_notes', 'status'
  ];

  const filteredUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = (updates as any)[key];
      return obj;
    }, {} as any);

  const { data, error } = await supabase
    .from('candidates_boys')
    .update(filteredUpdates)
    .eq('id', candidateId)
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה בעדכון בחור: ${error.message}`);
  }

  return data;
};

export const deleteBoy = async (candidateId: string): Promise<void> => {

  const { error } = await supabase
    .from('candidates_boys')
    .update({ status: 'מחוק' })
    .eq('id', candidateId);

  if (error) {

    throw new Error(`שגיאה במחיקת בחור: ${error.message}`);
  }

};

export const getBoy = async (candidateId: string): Promise<EnhancedSupabaseCandidate | null> => {

  // קודם מביאים את נתוני המועמד
  const { data: candidateData, error: candidateError } = await supabase
    .from('candidates_boys')
    .select('*')
    .eq('id', candidateId)
    .neq('status', 'מחוק')
    .single();

  if (candidateError) {
    if (candidateError.code === 'PGRST116') {

      return null; // לא נמצא
    }

    throw new Error(`שגיאה בהבאת בחור: ${candidateError.message}`);
  }

  if (!candidateData) {

    return null;
  }

  // אחר כך מביאים את פרטי הקשר בנפרד
  const { data: contactData, error: contactError } = await supabase
    .from('candidates_contact')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('candidate_type', 'boy')
    .single();

  // אם יש שגיאה בפרטי קשר (כמו שלא נמצא) - זה בסדר, ממשיכים בלי
  const enhancedCandidate: EnhancedSupabaseCandidate = {
    ...candidateData,
    contact: contactError?.code === 'PGRST116' ? undefined : contactData || undefined
  };

  return enhancedCandidate;
};

export const searchBoys = async (
  shadchanId: string,
  params: CandidateSearchParams = {}
): Promise<CandidateSearchResults> => {

  let query = supabase
    .from('candidates_boys')
    .select('*', { count: 'exact' })
    .eq('shadchan_id', shadchanId)
    .neq('status', 'מחוק');

  // פילטרים
  if (params.searchTerm) {
    query = query.or(`name.ilike.%${params.searchTerm}%,profession.ilike.%${params.searchTerm}%,looking_for.ilike.%${params.searchTerm}%`);
  }
  if (params.minAge) query = query.gte('age', params.minAge);
  if (params.maxAge) query = query.lte('age', params.maxAge);
  if (params.city) query = query.ilike('location', `%${params.city}%`);
  if (params.religiousLevel) query = query.eq('religious_level', params.religiousLevel);
  if (params.status) query = query.eq('status', params.status);
  if (params.maritalStatus) query = query.eq('marital_status', params.maritalStatus);
  if (params.profession) query = query.ilike('profession', `%${params.profession}%`);

  // מיון
  const sortBy = params.sortBy || 'name';
  const sortOrder = params.sortOrder || 'asc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // pagination
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {

    throw new Error(`שגיאה בחיפוש בנים: ${error.message}`);
  }

  const results: CandidateSearchResults = {
    candidates: data || [],
    total: count || 0,
    hasMore: (count || 0) > (offset + limit)
  };

  return results;
};

// =============== פונקציות CRUD לבנות (זהה לבנים) ===============

export const createGirl = async (
  shadchanId: string,
  candidateData: Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at' | 'updated_at'>
): Promise<SupabaseCandidate> => {

  const { data, error } = await supabase
    .from('candidates_girls')
    .insert({
      ...candidateData,
      shadchan_id: shadchanId,
    })
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה ביצירת בחורה: ${error.message}`);
  }

  return data;
};

export const updateGirl = async (
  candidateId: string,
  updates: Partial<Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at'>>
): Promise<SupabaseCandidate> => {

  // סינון רק שדות שמותרים לעדכון - מבוסס על הסכמת הטבלה האמיתית
  const allowedFields = [
    'internal_id', 'name', 'birth_date', 'age', 'preferred_age_range', 'marital_status',
    'open_to_other_sectors', 'sector', 'community', 'religious_level', 'religious_stream',
    'siblings', 'birth_order', 'location', 'education', 'profession', 'languages',
    'height', 'appearance', 'dress_style', 'smoking', 'hobbies', 'values_and_beliefs',
    'personality', 'lifestyle', 'flexibility', 'internet_usage', 'education_views',
    'about_me', 'looking_for', 'important_qualities', 'deal_breakers',
    'additional_notes', 'status'
  ];

  const filteredUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = (updates as any)[key];
      return obj;
    }, {} as any);

  const { data, error } = await supabase
    .from('candidates_girls')
    .update(filteredUpdates)
    .eq('id', candidateId)
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה בעדכון בחורה: ${error.message}`);
  }

  return data;
};

export const deleteGirl = async (candidateId: string): Promise<void> => {

  const { error } = await supabase
    .from('candidates_girls')
    .update({ status: 'מחוק' })
    .eq('id', candidateId);

  if (error) {

    throw new Error(`שגיאה במחיקת בחורה: ${error.message}`);
  }

};

export const getGirl = async (candidateId: string): Promise<EnhancedSupabaseCandidate | null> => {

  // קודם מביאים את נתוני המועמדת
  const { data: candidateData, error: candidateError } = await supabase
    .from('candidates_girls')
    .select('*')
    .eq('id', candidateId)
    .neq('status', 'מחוק')
    .single();

  if (candidateError) {
    if (candidateError.code === 'PGRST116') {

      return null; // לא נמצא
    }

    throw new Error(`שגיאה בהבאת בחורה: ${candidateError.message}`);
  }

  if (!candidateData) {

    return null;
  }

  // אחר כך מביאים את פרטי הקשר בנפרד
  const { data: contactData, error: contactError } = await supabase
    .from('candidates_contact')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('candidate_type', 'girl')
    .single();

  // אם יש שגיאה בפרטי קשר (כמו שלא נמצא) - זה בסדר, ממשיכים בלי
  const enhancedCandidate: EnhancedSupabaseCandidate = {
    ...candidateData,
    contact: contactError?.code === 'PGRST116' ? undefined : contactData || undefined
  };

  return enhancedCandidate;
};

export const searchGirls = async (
  shadchanId: string,
  params: CandidateSearchParams = {}
): Promise<CandidateSearchResults> => {

  let query = supabase
    .from('candidates_girls')
    .select('*', { count: 'exact' })
    .eq('shadchan_id', shadchanId)
    .neq('status', 'מחוק');

  // פילטרים (זהה לבנים)
  if (params.searchTerm) {
    query = query.or(`name.ilike.%${params.searchTerm}%,profession.ilike.%${params.searchTerm}%,looking_for.ilike.%${params.searchTerm}%`);
  }
  if (params.minAge) query = query.gte('age', params.minAge);
  if (params.maxAge) query = query.lte('age', params.maxAge);
  if (params.city) query = query.ilike('location', `%${params.city}%`);
  if (params.religiousLevel) query = query.eq('religious_level', params.religiousLevel);
  if (params.status) query = query.eq('status', params.status);
  if (params.maritalStatus) query = query.eq('marital_status', params.maritalStatus);
  if (params.profession) query = query.ilike('profession', `%${params.profession}%`);

  // מיון
  const sortBy = params.sortBy || 'name';
  const sortOrder = params.sortOrder || 'asc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // pagination
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {

    throw new Error(`שגיאה בחיפוש בנות: ${error.message}`);
  }

  const results: CandidateSearchResults = {
    candidates: data || [],
    total: count || 0,
    hasMore: (count || 0) > (offset + limit)
  };

  return results;
};

// =============== פונקציות לטיפול בפרטי קשר ===============

export const createCandidateContact = async (
  shadchanId: string,
  candidateId: string,
  candidateType: 'boy' | 'girl',
  contactData: Omit<CandidateContact, 'id' | 'shadchan_id' | 'candidate_id' | 'candidate_type' | 'created_at' | 'updated_at'>
): Promise<CandidateContact> => {

  const { data, error } = await supabase
    .from('candidates_contact')
    .insert({
      ...contactData,
      shadchan_id: shadchanId,
      candidate_id: candidateId,
      candidate_type: candidateType,
    })
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה ביצירת פרטי קשר: ${error.message}`);
  }

  return data;
};

export const updateCandidateContact = async (
  candidateId: string,
  candidateType: 'boy' | 'girl',
  updates: Partial<Omit<CandidateContact, 'id' | 'shadchan_id' | 'candidate_id' | 'candidate_type' | 'created_at'>>
): Promise<CandidateContact> => {

  const { data, error } = await supabase
    .from('candidates_contact')
    .update(updates)
    .eq('candidate_id', candidateId)
    .eq('candidate_type', candidateType)
    .select()
    .single();

  if (error) {

    throw new Error(`שגיאה בעדכון פרטי קשר: ${error.message}`);
  }

  return data;
};

export const getCandidateContact = async (
  candidateId: string,
  candidateType: 'boy' | 'girl'
): Promise<CandidateContact | null> => {

  try {
    const { data, error } = await supabase
      .from('candidates_contact')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('candidate_type', candidateType)
      .maybeSingle(); // שינוי מ-single() ל-maybeSingle()

    if (error) {

      // במקום לזרוק שגיאה, נחזיר null עבור רשומה שלא נמצאה
      return null;
    }

    return data;
  } catch (error) {

    return null; // החזרת null במקום זריקת שגיאה
  }
};

// =============== פונקציות סטטיסטיקות ===============

export interface CandidateStats {
  totalBoys: number;
  totalGirls: number;
  activeBoys: number;
  activeGirls: number;
  inProcessBoys: number;
  inProcessGirls: number;
}

export const getCandidateStats = async (shadchanId: string): Promise<CandidateStats> => {

  const [boysResult, girlsResult] = await Promise.all([
    supabase
      .from('candidates_boys')
      .select('status')
      .eq('shadchan_id', shadchanId)
      .neq('status', 'מחוק'),
    supabase
      .from('candidates_girls')
      .select('status')
      .eq('shadchan_id', shadchanId)
      .neq('status', 'מחוק')
  ]);

  if (boysResult.error || girlsResult.error) {

    throw new Error('שגיאה בהבאת סטטיסטיקות מועמדים');
  }

  const boys = boysResult.data || [];
  const girls = girlsResult.data || [];

  const stats: CandidateStats = {
    totalBoys: boys.length,
    totalGirls: girls.length,
    activeBoys: boys.filter(b => b.status === 'זמין').length,
    activeGirls: girls.filter(g => g.status === 'זמין').length,
    inProcessBoys: boys.filter(b => b.status === 'בתהליך').length,
    inProcessGirls: girls.filter(g => g.status === 'בתהליך').length,
  };

  return stats;
};

// =============== פונקציות עזר ===============

// פונקציה ליצירת internal_id ייחודי
export const generateInternalId = (name: string, age: number): string => {
  const cleanName = name.replace(/[^a-zA-Zא-ת]/g, '').substring(0, 10);
  const timestamp = Date.now().toString().slice(-6);
  return `${cleanName}_${age}_${timestamp}`.toLowerCase();
};

// פונקציה לוליידציה של נתוני מועמד
export const validateCandidateData = (data: Partial<SupabaseCandidate>): string[] => {
  const errors: string[] = [];
  
  if (!data.name?.trim()) errors.push('שם חובה');
  if (!data.age || data.age < 18 || data.age > 120) errors.push('גיל חייב להיות בין 18-120');
  if (!data.location?.trim()) errors.push('מקום מגורים חובה');
  if (!data.marital_status?.trim()) errors.push('מצב משפחתי חובה');
  
  return errors;
};

// =============== פונקציות מחיקה מקיפה ===============

// מחיקת כל הבנים של השדכן
export const deleteAllBoys = async (shadchanId: string): Promise<number> => {

  const { data, error } = await supabase
    .from('candidates_boys')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {

    throw new Error(`שגיאה במחיקת בנים: ${error.message}`);
  }

  const deletedCount = data?.length || 0;

  return deletedCount;
};

// מחיקת כל הבנות של השדכן
export const deleteAllGirls = async (shadchanId: string): Promise<number> => {

  const { data, error } = await supabase
    .from('candidates_girls')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {

    throw new Error(`שגיאה במחיקת בנות: ${error.message}`);
  }

  const deletedCount = data?.length || 0;

  return deletedCount;
};

// מחיקת כל פרטי הקשר של השדכן
export const deleteAllCandidatesContact = async (shadchanId: string): Promise<number> => {

  const { data, error } = await supabase
    .from('candidates_contact')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {

    throw new Error(`שגיאה במחיקת פרטי קשר: ${error.message}`);
  }

  const deletedCount = data?.length || 0;

  return deletedCount;
};

// מחיקה מקיפה של כל המועמדים (בנים + בנות + פרטי קשר)
export const deleteAllCandidates = async (shadchanId: string): Promise<{
  deletedBoys: number;
  deletedGirls: number;
  deletedContacts: number;
  total: number;
}> => {

  try {
    // מחיקה במקביל של כל הטבלאות
    const [deletedBoys, deletedGirls, deletedContacts] = await Promise.all([
      deleteAllBoys(shadchanId),
      deleteAllGirls(shadchanId),
      deleteAllCandidatesContact(shadchanId)
    ]);

    const total = deletedBoys + deletedGirls;

    return {
      deletedBoys,
      deletedGirls,
      deletedContacts,
      total
    };
  } catch (error) {

    throw error;
  }
};