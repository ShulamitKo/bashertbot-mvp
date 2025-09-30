import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Plus, Edit, Trash2, Eye, Filter, Upload } from 'lucide-react';
import {
  searchBoys,
  searchGirls,
  deleteBoy,
  deleteGirl,
  getCandidateStats,
  type CandidateStats
} from '../lib/candidates';
import type { SupabaseCandidate, CandidateSearchParams } from '../types';
import { CandidateModal } from './CandidateModal';
import { CandidateForm } from './CandidateForm';

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

  // State למודל מועמד
  const [selectedCandidate, setSelectedCandidate] = useState<SupabaseCandidate | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State לטופס הוספת מועמד
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // State למחיקת מועמד
  const [candidateToDelete, setCandidateToDelete] = useState<SupabaseCandidate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // פתיחת דיאלוג מחיקה
  const handleDeleteClick = (candidate: SupabaseCandidate) => {
    setCandidateToDelete(candidate);
    setShowDeleteConfirm(true);
  };

  // ביטול מחיקה
  const handleCancelDelete = () => {
    setCandidateToDelete(null);
    setShowDeleteConfirm(false);
  };

  // אישור מחיקת מועמד
  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return;

    try {
      await deleteFunction(candidateToDelete.id);
      setShowDeleteConfirm(false);
      setCandidateToDelete(null);
      await loadCandidates(true);
      await loadStats();
      // TODO: הודעת הצלחה
    } catch (error) {
      // TODO: הודעת שגיאה
    }
  };

  // פתיחת מודל צפייה
  const handleViewCandidate = (candidate: SupabaseCandidate) => {
    setSelectedCandidate(candidate);
    setModalMode('view');
    setIsModalOpen(true);
    if (onViewCandidate) {
      onViewCandidate(candidate);
    }
  };

  // פתיחת מודל עריכה
  const handleEditCandidate = (candidate: SupabaseCandidate) => {
    setSelectedCandidate(candidate);
    setModalMode('edit');
    setIsModalOpen(true);
    if (onEditCandidate) {
      onEditCandidate(candidate);
    }
  };

  // סגירת מודל
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCandidate(null);
  };

  // שמירת מועמד ממודל
  const handleSaveCandidate = (updatedCandidate: SupabaseCandidate) => {
    // עדכון הרשימה המקומית
    setCandidates(prev =>
      prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c)
    );
    // רענון סטטיסטיקות
    loadStats();
  };

  // פתיחת טופס הוספת מועמד
  const handleAddCandidate = () => {
    setIsAddFormOpen(true);
    if (onAddCandidate) {
      onAddCandidate();
    }
  };

  // סגירת טופס הוספת מועמד
  const handleCloseAddForm = () => {
    setIsAddFormOpen(false);
  };

  // שמירת מועמד חדש מטופס
  const handleSaveNewCandidate = (newCandidate: SupabaseCandidate) => {
    // הוספה לרשימה המקומית
    setCandidates(prev => [newCandidate, ...prev]);
    // רענון סטטיסטיקות
    loadStats();
    // רענון מלא של הרשימה כדי לוודא שהכל מעודכן
    loadCandidates(true);
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
          
          <button
            onClick={handleAddCandidate}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            הוסף {isGirls ? 'בחורה' : 'בחור'}
          </button>

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
                    <button
                      onClick={() => handleViewCandidate(candidate)}
                      className="text-blue-600 hover:text-blue-900"
                      title="צפה"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleEditCandidate(candidate)}
                      className="text-yellow-600 hover:text-yellow-900"
                      title="ערוך"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteClick(candidate)}
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
            <button
              onClick={handleAddCandidate}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              הוסף {isGirls ? 'בחורה' : 'בחור'} ראשון
            </button>
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

      {/* מודל מועמד */}
      {selectedCandidate && (
        <CandidateModal
          candidateId={selectedCandidate.id}
          candidateType={type}
          mode={modalMode}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveCandidate}
        />
      )}

      {/* טופס הוספת מועמד */}
      <CandidateForm
        shadchanId={shadchanId}
        candidateType={type}
        isOpen={isAddFormOpen}
        onClose={handleCloseAddForm}
        onSave={handleSaveNewCandidate}
      />

      {/* דיאלוג אישור מחיקה */}
      {showDeleteConfirm && candidateToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCancelDelete}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-4">אישור מחיקה</h3>
            <p className="text-gray-700 mb-6">
              האם את/ה בטוח/ה שברצונך למחוק את <strong>{candidateToDelete.name}</strong>?
              <br />
              פעולה זו לא ניתנת לביטול.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};