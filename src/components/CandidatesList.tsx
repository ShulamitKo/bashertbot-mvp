import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Plus, Edit, Trash2, Eye, Filter, Download, Upload } from 'lucide-react';
import { 
  searchBoys, 
  searchGirls, 
  deleteBoy, 
  deleteGirl, 
  getCandidateStats,
  type CandidateStats
} from '../lib/candidates';
import type { SupabaseCandidate, CandidateSearchParams } from '../types';

interface CandidatesListProps {
  shadchanId: string;
  type: 'boys' | 'girls';
  onAddCandidate?: () => void;
  onEditCandidate?: (candidate: SupabaseCandidate) => void;
  onViewCandidate?: (candidate: SupabaseCandidate) => void;
  onImportCandidates?: () => void;
}

export const CandidatesList: React.FC<CandidatesListProps> = ({
  shadchanId,
  type,
  onAddCandidate,
  onEditCandidate,
  onViewCandidate,
  onImportCandidates
}) => {
  const [candidates, setCandidates] = useState<SupabaseCandidate[]>([]);
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CandidateSearchParams>({
    status: 'זמין', // ברירת מחדל - רק זמינים
    limit: 50,
    offset: 0,
    sortBy: 'name',
    sortOrder: 'asc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const isGirls = type === 'girls';
  const title = isGirls ? 'רשימת בנות' : 'רשימת בנים';
  const searchFunction = isGirls ? searchGirls : searchBoys;
  const deleteFunction = isGirls ? deleteGirl : deleteBoy;

  // טעינת נתונים
  const loadCandidates = useCallback(async (resetList = false) => {
    if (!shadchanId) return;
    
    setLoading(true);
    try {
      const searchParams = {
        ...filters,
        searchTerm: searchTerm.trim() || undefined,
        offset: resetList ? 0 : filters.offset || 0
      };

      const results = await searchFunction(shadchanId, searchParams);
      
      if (resetList) {
        setCandidates(results.candidates);
      } else {
        setCandidates(prev => [...prev, ...results.candidates]);
      }
      
      setTotal(results.total);
      setHasMore(results.hasMore);
      
    } catch (error) {
      console.error('שגיאה בטעינת מועמדים:', error);
      // TODO: הצגת הודעת שגיאה למשתמש
    } finally {
      setLoading(false);
    }
  }, [shadchanId, filters, searchTerm, searchFunction]);

  // טעינת סטטיסטיקות
  const loadStats = useCallback(async () => {
    if (!shadchanId) return;
    
    try {
      const statsData = await getCandidateStats(shadchanId);
      setStats(statsData);
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות:', error);
    }
  }, [shadchanId]);

  // אפקטים
  useEffect(() => {
    loadCandidates(true);
  }, [loadCandidates]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // חיפוש עם debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, offset: 0 }));
      loadCandidates(true);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // מחיקת מועמד
  const handleDelete = async (candidate: SupabaseCandidate) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את ${candidate.name}?`)) {
      return;
    }

    try {
      await deleteFunction(candidate.id);
      await loadCandidates(true);
      await loadStats();
      // TODO: הודעת הצלחה
    } catch (error) {
      console.error('שגיאה במחיקת מועמד:', error);
      // TODO: הודעת שגיאה
    }
  };

  // טעינת עמוד הבא
  const loadMore = () => {
    if (!hasMore || loading) return;
    
    setFilters(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50)
    }));
    loadCandidates(false);
  };

  // עדכון פילטרים
  const updateFilters = (newFilters: Partial<CandidateSearchParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
  };

  // איפוס פילטרים
  const clearFilters = () => {
    setFilters({
      status: 'זמין',
      limit: 50,
      offset: 0,
      sortBy: 'name',
      sortOrder: 'asc'
    });
    setSearchTerm('');
  };

  const currentStats = isGirls 
    ? { total: stats?.totalGirls || 0, active: stats?.activeGirls || 0, inProcess: stats?.inProcessGirls || 0 }
    : { total: stats?.totalBoys || 0, active: stats?.activeBoys || 0, inProcess: stats?.inProcessBoys || 0 };

  return (
    <div className="space-y-6">
      {/* כותרת וסטטיסטיקות */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <div className="flex space-x-4 text-sm text-gray-600 mt-1">
            <span>סה"כ: {currentStats.total}</span>
            <span className="text-green-600">זמינים: {currentStats.active}</span>
            <span className="text-orange-600">בתהליך: {currentStats.inProcess}</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {onImportCandidates && (
            <button
              onClick={onImportCandidates}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              יבוא
            </button>
          )}
          
          {onAddCandidate && (
            <button
              onClick={onAddCandidate}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף {isGirls ? 'בחורה' : 'בחור'}
            </button>
          )}
        </div>
      </div>

      {/* חיפוש ופילטרים */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex space-x-4 items-center mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`חפש ${isGirls ? 'בנות' : 'בנים'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4 mr-2" />
            פילטרים
          </button>
          
          {(searchTerm || Object.keys(filters).some(key => 
            key !== 'limit' && key !== 'offset' && key !== 'sortBy' && key !== 'sortOrder' && 
            filters[key as keyof CandidateSearchParams] && filters[key as keyof CandidateSearchParams] !== 'זמין'
          )) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              נקה
            </button>
          )}
        </div>

        {/* פילטרים מתקדמים */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
              <select
                value={filters.status || ''}
                onChange={(e) => updateFilters({ status: e.target.value as any || undefined })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">הכל</option>
                <option value="זמין">זמין</option>
                <option value="בתהליך">בתהליך</option>
                <option value="לא זמין">לא זמין</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">גיל מינימלי</label>
              <input
                type="number"
                value={filters.minAge || ''}
                onChange={(e) => updateFilters({ minAge: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                min="18"
                max="120"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">גיל מקסימלי</label>
              <input
                type="number"
                value={filters.maxAge || ''}
                onChange={(e) => updateFilters({ maxAge: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                min="18"
                max="120"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עיר</label>
              <input
                type="text"
                value={filters.city || ''}
                onChange={(e) => updateFilters({ city: e.target.value || undefined })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="הקלד עיר..."
              />
            </div>
          </div>
        )}
      </div>

      {/* טבלת מועמדים */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  שם
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  גיל
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  עיר
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  רמה דתית
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מקצוע
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {candidate.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.age}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.religious_level || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.profession || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      candidate.status === 'זמין' ? 'bg-green-100 text-green-800' :
                      candidate.status === 'בתהליך' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {candidate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {onViewCandidate && (
                      <button
                        onClick={() => onViewCandidate(candidate)}
                        className="text-blue-600 hover:text-blue-900"
                        title="צפה"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    
                    {onEditCandidate && (
                      <button
                        onClick={() => onEditCandidate(candidate)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="ערוך"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(candidate)}
                      className="text-red-600 hover:text-red-900"
                      title="מחק"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* טעינה */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="mr-2 text-gray-600">טוען...</span>
          </div>
        )}

        {/* אין תוצאות */}
        {!loading && candidates.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">לא נמצאו מועמדים</p>
            {onAddCandidate && (
              <button
                onClick={onAddCandidate}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                הוסף {isGirls ? 'בחורה' : 'בחור'} ראשון
              </button>
            )}
          </div>
        )}

        {/* כפתור טעינת עוד */}
        {!loading && hasMore && (
          <div className="text-center py-4 border-t">
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              טען עוד ({total - candidates.length} נותרו)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};