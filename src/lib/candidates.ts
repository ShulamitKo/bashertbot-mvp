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
  console.log('🔄 יוצר בחור חדש:', candidateData.name);
  
  const { data, error } = await supabase
    .from('candidates_boys')
    .insert({
      ...candidateData,
      shadchan_id: shadchanId,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ שגיאה ביצירת בחור:', error);
    throw new Error(`שגיאה ביצירת בחור: ${error.message}`);
  }

  console.log('✅ בחור נוצר בהצלחה:', data.name);
  return data;
};

export const updateBoy = async (
  candidateId: string,
  updates: Partial<Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at'>>
): Promise<SupabaseCandidate> => {
  console.log('🔄 מעדכן בחור:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_boys')
    .update(updates)
    .eq('id', candidateId)
    .select()
    .single();

  if (error) {
    console.error('❌ שגיאה בעדכון בחור:', error);
    throw new Error(`שגיאה בעדכון בחור: ${error.message}`);
  }

  console.log('✅ בחור עודכן בהצלחה:', data.name);
  return data;
};

export const deleteBoy = async (candidateId: string): Promise<void> => {
  console.log('🔄 מוחק בחור (מחיקה רכה):', candidateId);
  
  const { error } = await supabase
    .from('candidates_boys')
    .update({ status: 'מחוק' })
    .eq('id', candidateId);

  if (error) {
    console.error('❌ שגיאה במחיקת בחור:', error);
    throw new Error(`שגיאה במחיקת בחור: ${error.message}`);
  }

  console.log('✅ בחור נמחק בהצלחה');
};

export const getBoy = async (candidateId: string): Promise<EnhancedSupabaseCandidate | null> => {
  console.log('🔄 מביא נתוני בחור:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_boys')
    .select(`
      *,
      contact:candidates_contact(*)
    `)
    .eq('id', candidateId)
    .neq('status', 'מחוק')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // לא נמצא
    console.error('❌ שגיאה בהבאת בחור:', error);
    throw new Error(`שגיאה בהבאת בחור: ${error.message}`);
  }

  return data;
};

export const searchBoys = async (
  shadchanId: string, 
  params: CandidateSearchParams = {}
): Promise<CandidateSearchResults> => {
  console.log('🔍 מחפש בנים:', params);
  
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
    console.error('❌ שגיאה בחיפוש בנים:', error);
    throw new Error(`שגיאה בחיפוש בנים: ${error.message}`);
  }

  const results: CandidateSearchResults = {
    candidates: data || [],
    total: count || 0,
    hasMore: (count || 0) > (offset + limit)
  };

  console.log(`✅ נמצאו ${results.total} בנים, מציג ${data?.length || 0}`);
  return results;
};

// =============== פונקציות CRUD לבנות (זהה לבנים) ===============

export const createGirl = async (
  shadchanId: string,
  candidateData: Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at' | 'updated_at'>
): Promise<SupabaseCandidate> => {
  console.log('🔄 יוצרת בחורה חדשה:', candidateData.name);
  
  const { data, error } = await supabase
    .from('candidates_girls')
    .insert({
      ...candidateData,
      shadchan_id: shadchanId,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ שגיאה ביצירת בחורה:', error);
    throw new Error(`שגיאה ביצירת בחורה: ${error.message}`);
  }

  console.log('✅ בחורה נוצרה בהצלחה:', data.name);
  return data;
};

export const updateGirl = async (
  candidateId: string,
  updates: Partial<Omit<SupabaseCandidate, 'id' | 'shadchan_id' | 'created_at'>>
): Promise<SupabaseCandidate> => {
  console.log('🔄 מעדכנת בחורה:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_girls')
    .update(updates)
    .eq('id', candidateId)
    .select()
    .single();

  if (error) {
    console.error('❌ שגיאה בעדכון בחורה:', error);
    throw new Error(`שגיאה בעדכון בחורה: ${error.message}`);
  }

  console.log('✅ בחורה עודכנה בהצלחה:', data.name);
  return data;
};

export const deleteGirl = async (candidateId: string): Promise<void> => {
  console.log('🔄 מוחקת בחורה (מחיקה רכה):', candidateId);
  
  const { error } = await supabase
    .from('candidates_girls')
    .update({ status: 'מחוק' })
    .eq('id', candidateId);

  if (error) {
    console.error('❌ שגיאה במחיקת בחורה:', error);
    throw new Error(`שגיאה במחיקת בחורה: ${error.message}`);
  }

  console.log('✅ בחורה נמחקה בהצלחה');
};

export const getGirl = async (candidateId: string): Promise<EnhancedSupabaseCandidate | null> => {
  console.log('🔄 מביאה נתוני בחורה:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_girls')
    .select(`
      *,
      contact:candidates_contact(*)
    `)
    .eq('id', candidateId)
    .neq('status', 'מחוק')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // לא נמצא
    console.error('❌ שגיאה בהבאת בחורה:', error);
    throw new Error(`שגיאה בהבאת בחורה: ${error.message}`);
  }

  return data;
};

export const searchGirls = async (
  shadchanId: string, 
  params: CandidateSearchParams = {}
): Promise<CandidateSearchResults> => {
  console.log('🔍 מחפשת בנות:', params);
  
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
    console.error('❌ שגיאה בחיפוש בנות:', error);
    throw new Error(`שגיאה בחיפוש בנות: ${error.message}`);
  }

  const results: CandidateSearchResults = {
    candidates: data || [],
    total: count || 0,
    hasMore: (count || 0) > (offset + limit)
  };

  console.log(`✅ נמצאו ${results.total} בנות, מציגה ${data?.length || 0}`);
  return results;
};

// =============== פונקציות לטיפול בפרטי קשר ===============

export const createCandidateContact = async (
  shadchanId: string,
  candidateId: string,
  candidateType: 'boy' | 'girl',
  contactData: Omit<CandidateContact, 'id' | 'shadchan_id' | 'candidate_id' | 'candidate_type' | 'created_at' | 'updated_at'>
): Promise<CandidateContact> => {
  console.log('🔄 יוצר פרטי קשר למועמד:', candidateId);
  
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
    console.error('❌ שגיאה ביצירת פרטי קשר:', error);
    throw new Error(`שגיאה ביצירת פרטי קשר: ${error.message}`);
  }

  console.log('✅ פרטי קשר נוצרו בהצלחה');
  return data;
};

export const updateCandidateContact = async (
  candidateId: string,
  candidateType: 'boy' | 'girl',
  updates: Partial<Omit<CandidateContact, 'id' | 'shadchan_id' | 'candidate_id' | 'candidate_type' | 'created_at'>>
): Promise<CandidateContact> => {
  console.log('🔄 מעדכן פרטי קשר למועמד:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_contact')
    .update(updates)
    .eq('candidate_id', candidateId)
    .eq('candidate_type', candidateType)
    .select()
    .single();

  if (error) {
    console.error('❌ שגיאה בעדכון פרטי קשר:', error);
    throw new Error(`שגיאה בעדכון פרטי קשר: ${error.message}`);
  }

  console.log('✅ פרטי קשר עודכנו בהצלחה');
  return data;
};

export const getCandidateContact = async (
  candidateId: string,
  candidateType: 'boy' | 'girl'
): Promise<CandidateContact | null> => {
  console.log('🔄 מביא פרטי קשר למועמד:', candidateId);
  
  const { data, error } = await supabase
    .from('candidates_contact')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('candidate_type', candidateType)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // לא נמצא
    console.error('❌ שגיאה בהבאת פרטי קשר:', error);
    throw new Error(`שגיאה בהבאת פרטי קשר: ${error.message}`);
  }

  return data;
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
  console.log('📊 מביא סטטיסטיקות מועמדים לשדכן:', shadchanId);
  
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
    console.error('❌ שגיאה בהבאת סטטיסטיקות');
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

  console.log('✅ סטטיסטיקות:', stats);
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
  console.log('🔄 מוחק את כל הבנים של השדכן:', shadchanId);
  
  const { data, error } = await supabase
    .from('candidates_boys')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {
    console.error('❌ שגיאה במחיקת בנים:', error);
    throw new Error(`שגיאה במחיקת בנים: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  console.log(`✅ נמחקו ${deletedCount} בנים`);
  return deletedCount;
};

// מחיקת כל הבנות של השדכן
export const deleteAllGirls = async (shadchanId: string): Promise<number> => {
  console.log('🔄 מוחק את כל הבנות של השדכן:', shadchanId);
  
  const { data, error } = await supabase
    .from('candidates_girls')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {
    console.error('❌ שגיאה במחיקת בנות:', error);
    throw new Error(`שגיאה במחיקת בנות: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  console.log(`✅ נמחקו ${deletedCount} בנות`);
  return deletedCount;
};

// מחיקת כל פרטי הקשר של השדכן
export const deleteAllCandidatesContact = async (shadchanId: string): Promise<number> => {
  console.log('🔄 מוחק את כל פרטי הקשר של השדכן:', shadchanId);
  
  const { data, error } = await supabase
    .from('candidates_contact')
    .delete()
    .eq('shadchan_id', shadchanId)
    .select('id');

  if (error) {
    console.error('❌ שגיאה במחיקת פרטי קשר:', error);
    throw new Error(`שגיאה במחיקת פרטי קשר: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  console.log(`✅ נמחקו ${deletedCount} רשומות פרטי קשר`);
  return deletedCount;
};

// מחיקה מקיפה של כל המועמדים (בנים + בנות + פרטי קשר)
export const deleteAllCandidates = async (shadchanId: string): Promise<{
  deletedBoys: number;
  deletedGirls: number;
  deletedContacts: number;
  total: number;
}> => {
  console.log('🔄 מוחק את כל המועמדים של השדכן:', shadchanId);
  
  try {
    // מחיקה במקביל של כל הטבלאות
    const [deletedBoys, deletedGirls, deletedContacts] = await Promise.all([
      deleteAllBoys(shadchanId),
      deleteAllGirls(shadchanId),
      deleteAllCandidatesContact(shadchanId)
    ]);

    const total = deletedBoys + deletedGirls;
    
    console.log('✅ מחיקה מקיפה הושלמה:', {
      deletedBoys,
      deletedGirls,
      deletedContacts,
      total
    });

    return {
      deletedBoys,
      deletedGirls,
      deletedContacts,
      total
    };
  } catch (error) {
    console.error('❌ שגיאה במחיקה מקיפה:', error);
    throw error;
  }
};