import React, { useState } from 'react'
import { 
  User, 
  Calendar, 
  Clock, 
  Eye,
  PenTool,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Edit3,
  Trash2,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle,
  X,
  Copy
} from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { EnhancedProposal } from '../../types'
import { updateProposalStatus, updateCandidateResponse, editProposalNote, deleteProposalNote } from '../../lib/proposals'

interface ProposalCardProps {
  proposal: EnhancedProposal;
  onUpdate?: () => Promise<void>; // שינוי ל-Promise<void>
  onViewProfiles?: (proposal: EnhancedProposal) => void;
  shadchanId: string; // הוספת shadchanId כ-prop של הקומפוננטה
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onUpdate,
  onViewProfiles,
  shadchanId // קבלת shadchanId מה-props
}) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [showBoyRejectionModal, setShowBoyRejectionModal] = useState(false)
  const [showGirlRejectionModal, setShowGirlRejectionModal] = useState(false)
  const [boyRejectionReason, setBoyRejectionReason] = useState('')
  const [girlRejectionReason, setGirlRejectionReason] = useState('')

  // דיבוג הצעה בקומפוננט ProposalCard
  console.log(`🔍 דיבוג הצעה בקומפוננט ProposalCard - ${proposal.id}:`, {
    proposalId: proposal.id,
    proposalObject: proposal,
    boyDetails: proposal.boyDetails,
    girlDetails: proposal.girlDetails,
    boyDetailsKeys: proposal.boyDetails ? Object.keys(proposal.boyDetails) : [],
    girlDetailsKeys: proposal.girlDetails ? Object.keys(proposal.girlDetails) : [],
    boyEmail: proposal.boyDetails?.email || 'ריק',
    boyPhone: proposal.boyDetails?.phone || 'ריק',
    boyContact: proposal.boyDetails?.contact || 'ריק',
    boyPreviouslyProposed: proposal.boyDetails?.previouslyProposed || 'ריק',
    girlEmail: proposal.girlDetails?.email || 'ריק',
    girlPhone: proposal.girlDetails?.phone || 'ריק',
    girlContact: proposal.girlDetails?.contact || 'ריק',
    girlPreviouslyProposed: proposal.girlDetails?.previouslyProposed || 'ריק',
    boyEmailPatterns: proposal.boyDetails ? Object.entries(proposal.boyDetails).filter(([, value]) => value && typeof value === 'string' && value.includes('@')).map(([key, value]) => `${key}: ${value}`) : [],
    girlEmailPatterns: proposal.girlDetails ? Object.entries(proposal.girlDetails).filter(([, value]) => value && typeof value === 'string' && value.includes('@')).map(([key, value]) => `${key}: ${value}`) : []
  })

  // פונקציה ליצירת קישור WhatsApp
  const getWhatsAppLink = (phone: string, name: string, partnerName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `שלום ${name},\n\nאני שדכן ויש לי הצעת שידוך מעניינת עבורך עם ${partnerName}.\nאשמח לשוחח איתך על הפרטים.\n\nתודה!`
    );
    return `https://wa.me/972${cleanPhone.replace(/^0/, '')}?text=${message}`;
  };

  // פונקציה ליצירת קישור Gmail עם תוכן
  const getGmailLink = (email: string, name: string, partnerName: string, subjectLine: string) => {
    const subject = encodeURIComponent(subjectLine);
    const body = encodeURIComponent(
      `שלום ${name},\n\nאני שדכן ויש לי הצעת שידוך מעניינת עבורך עם ${partnerName}.\nאשמח לשוחח איתך על הפרטים.\n\nבברכה,\nהשדכן`
    );
    return `https://mail.google.com/mail/?view=cm&to=${email}&subject=${subject}&body=${body}`;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-blue-100 text-blue-800 border-blue-200', // ממתין לאישור
      ready_for_processing: 'bg-yellow-100 text-yellow-800 border-yellow-200', // ממתינה לתחילת טיפול
      rejected: 'bg-red-100 text-red-800 border-red-200',
      ready_for_contact: 'bg-purple-100 text-purple-800 border-purple-200',
      contacting: 'bg-blue-100 text-blue-800 border-blue-200',
      awaiting_response: 'bg-orange-100 text-orange-800 border-orange-200',
      rejected_by_candidate: 'bg-red-100 text-red-800 border-red-200',
      schedule_meeting: 'bg-teal-100 text-teal-800 border-teal-200',
      meeting_scheduled: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      in_meeting_process: 'bg-green-100 text-green-800 border-green-200',
      meeting_completed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      closed: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[status as keyof typeof colors] || 'bg-blue-100 text-blue-800 border-blue-200' // התאמה חדשה
  }

  const getStatusText = (status: string) => {
    const texts = {
      pending: 'ממתין לאישור',
      ready_for_processing: 'ממתינה לתחילת טיפול',
      rejected: 'נדחתה',
      ready_for_contact: 'מוכן ליצירת קשר',
      contacting: 'יוצר קשר',
      awaiting_response: 'ממתין לתגובה',
      rejected_by_candidate: 'נדחתה על ידי מועמד',
      schedule_meeting: 'לקבוע פגישה',
      meeting_scheduled: 'פגישה נקבעה',
      in_meeting_process: 'בתהליך פגישות',
      meeting_completed: 'פגישה התקיימה',
      completed: 'מזל טוב! 🎉',
      closed: 'נסגרה'
    }
    return texts[status as keyof typeof texts] || 'התאמה חדשה'
  }

  const getResponseIcon = (response?: string) => {
    switch (response) {
      case 'interested': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'not_interested': return <X className="h-4 w-4 text-red-600" />
      case 'needs_time': return <Clock className="h-4 w-4 text-yellow-600" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getResponseText = (response?: string) => {
    switch (response) {
      case 'interested': return 'מעוניין/ת'
      case 'not_interested': return 'לא מעוניין/ת'
      case 'needs_time': return 'צריך/ה זמן'
      default: return 'ממתין לתגובה'
    }
  }

  const handleStatusUpdate = async (newStatus: string, notes?: string) => {
    setIsUpdating(true)
    console.log('🔄 מעדכן סטטוס:', { proposalId: proposal.id, newStatus, notes })
    try {
      const success = await updateProposalStatus(proposal.id, newStatus, notes)
      console.log('✅ תוצאת עדכון סטטוס:', success)
      if (success && onUpdate) {
        console.log('🔄 מרענן נתוני הצעות...')
        await onUpdate()
        // הצגת הודעת הצלחה
        showSuccessMessage('✅ הסטטוס עודכן בהצלחה')
      }
    } catch (error) {
      console.error('❌ שגיאה בעדכון סטטוס:', error)
      showErrorMessage('❌ שגיאה בעדכון הסטטוס')
    } finally {
      setIsUpdating(false)
      setShowStatusModal(false)
    }
  }

  const handleAddNote = async (notes: string) => {
    setIsUpdating(true)
    console.log('📝 מוסיף הערה:', { proposalId: proposal.id, notes })
    try {
      // שמירת הערה בלי שינוי סטטוס - נשתמש בסטטוס הנוכחי
      const success = await updateProposalStatus(proposal.id, proposal.status, notes)
      console.log('✅ תוצאת הוספת הערה:', success)
      if (success && onUpdate) {
        console.log('🔄 מרענן נתוני הצעות...')
        await onUpdate()
        // הצגת הודעת הצלחה
        showSuccessMessage('✅ ההערה נוספה בהצלחה')
      }
    } catch (error) {
      console.error('❌ שגיאה בהוספת הערה:', error)
      showErrorMessage('❌ שגיאה בהוספת הערה')
    } finally {
      setIsUpdating(false)
      setShowNoteModal(false)
    }
  }

  const handleEditNote = async (noteIndex: number, newContent: string) => {
    setIsUpdating(true)
    console.log('✏️ עורך הערה:', { proposalId: proposal.id, noteIndex, newContent })
    try {
      const success = await editProposalNote(proposal.id, noteIndex, newContent)
      console.log('✅ תוצאת עריכת הערה:', success)
      if (success && onUpdate) {
        console.log('🔄 מרענן נתוני הצעות...')
        await onUpdate()
        showSuccessMessage('✅ ההערה עודכנה בהצלחה')
      }
    } catch (error) {
      console.error('❌ שגיאה בעריכת הערה:', error)
      showErrorMessage('❌ שגיאה בעריכת הערה')
    } finally {
      setIsUpdating(false)
      setEditingNoteIndex(null)
      setEditNoteContent('')
    }
  }

  const handleDeleteNote = async (noteIndex: number) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק הערה זו?')) {
      return
    }
    
    setIsUpdating(true)
    console.log('🗑️ מוחק הערה:', { proposalId: proposal.id, noteIndex })
    try {
      const success = await deleteProposalNote(proposal.id, noteIndex)
      console.log('✅ תוצאת מחיקת הערה:', success)
      if (success && onUpdate) {
        console.log('🔄 מרענן נתוני הצעות...')
        await onUpdate()
        showSuccessMessage('✅ ההערה נמחקה בהצלחה')
      }
    } catch (error) {
      console.error('❌ שגיאה במחיקת הערה:', error)
      showErrorMessage('❌ שגיאה במחיקת הערה')
    } finally {
      setIsUpdating(false)
    }
  }

  const startEditingNote = (noteIndex: number, currentContent: string) => {
    setEditingNoteIndex(noteIndex)
    setEditNoteContent(currentContent)
  }

  const cancelEditingNote = () => {
    setEditingNoteIndex(null)
    setEditNoteContent('')
  }

  const formatDaysAgo = (days: number) => {
    if (days === 0) return 'היום'
    if (days === 1) return 'אתמול'
    return `לפני ${days} ימים`
  }

  // פונקציות להצגת הודעות
  const showSuccessMessage = (message: string) => {
    const successMsg = document.createElement('div')
    successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300'
    successMsg.textContent = message
    document.body.appendChild(successMsg)
    setTimeout(() => {
      successMsg.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(successMsg)) {
          document.body.removeChild(successMsg)
        }
      }, 300)
    }, 3000)
  }

  const showErrorMessage = (message: string) => {
    const errorMsg = document.createElement('div')
    errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300'
    errorMsg.textContent = message
    document.body.appendChild(errorMsg)
    setTimeout(() => {
      errorMsg.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(errorMsg)) {
          document.body.removeChild(errorMsg)
        }
      }, 300)
    }, 3000)
  }

  const copyToClipboard = async (text: string, type: 'phone' | 'email') => {
    try {
      await navigator.clipboard.writeText(text)
      const message = type === 'phone' ? '📞 מספר הטלפון הועתק' : '📧 כתובת המייל הועתקה'
      showSuccessMessage(message)
    } catch (error) {
      console.error('שגיאה בהעתקה:', error)
      showErrorMessage('❌ שגיאה בהעתקה')
    }
  }

  return (
    <>
      <Card className={`p-6 border-r-4 border-r-blue-500 hover:shadow-lg transition-all duration-300 ${
        isUpdating ? 'opacity-75 pointer-events-none' : ''
      }`}>
        {/* כותרת ההצעה */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  הצעה #{proposal.id.slice(-8)}
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(proposal.status)}`}>
                  {getStatusText(proposal.status)}
                </span>
                {/* עדכון אחרון בכותרת */}
                {proposal.lastActivity && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>עדכון אחרון: {new Date(proposal.lastActivity).toLocaleString('he-IL', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                )}
                {isUpdating && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="text-xs">מעדכן...</span>
                  </div>
                )}
              </div>
              
              {/* כפתורי פעולות בכותרת - עיצוב משופר */}
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowStatusModal(true)}
                  className="border-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 text-xs font-medium shadow-none"
                  disabled={isUpdating}
                >
                  <PenTool className="w-4 h-4 ml-1" />
                  עדכון סטטוס
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewProfiles?.(proposal)}
                  className="border-0 text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-1.5 text-xs font-medium shadow-none"
                  disabled={isUpdating}
                >
                  <Eye className="w-4 h-4 ml-1" />
                  צפיה בפרופילים
                </Button>
              </div>
            </div>
            
            {/* פרטי המועמדים עם יצירת קשר ותגובות */}
            <div className="grid grid-cols-2 gap-6 mb-4">
              {/* כרטיס בן */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-600 rounded-full">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-900 font-bold text-lg">
                    {proposal.boyDetails?.name || 'טוען...'}
                  </p>
                    <p className="text-blue-600 text-sm font-medium">מועמד</p>
                </div>
                </div>
                
                {/* פרטים אישיים */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-xs">🎂</span>
                    </div>
                    <span className="text-blue-800 font-medium">
                      {proposal.boyDetails?.age || 'לא צוין'} שנים
                    {proposal.boyDetails?.height && (
                        <span className="text-blue-600 mr-2">• {proposal.boyDetails.height}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-xs">💼</span>
                    </div>
                    <span className="text-blue-800 font-medium">
                      {proposal.boyDetails?.profession || 'לא צוין'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-xs">🕊️</span>
                    </div>
                    <span className="text-blue-800 font-medium">
                      {proposal.boyDetails?.community || 'לא צוין'}
                    {proposal.boyDetails?.religiousLevel && (
                        <span className="text-blue-600 mr-1"> • {proposal.boyDetails.religiousLevel}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-xs">📍</span>
                    </div>
                    <span className="text-blue-800 font-medium">
                      {proposal.boyDetails?.location || 'לא צוין'}
                    </span>
                  </div>
                  
                  {proposal.boyDetails?.education && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                        <span className="text-blue-700 font-bold text-xs">🎓</span>
                      </div>
                      <span className="text-blue-800 font-medium">
                        {proposal.boyDetails.education}
                      </span>
                    </div>
                  )}
                </div>

                {/* פרטי קשר */}
                <div className="border-t border-blue-300 pt-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-blue-600 rounded-full">
                      <Phone className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-blue-900 font-semibold text-sm">יצירת קשר</span>
              </div>
              
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-200">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <span className="font-mono text-sm text-blue-800 flex-1">
                        {proposal.boyDetails?.phone && proposal.boyDetails?.phone.trim() && proposal.boyDetails?.phone !== 'ריק' ? proposal.boyDetails.phone : 'אין טלפון'}
                      </span>
                      {proposal.boyDetails?.phone && proposal.boyDetails?.phone.trim() && proposal.boyDetails?.phone !== 'ריק' && (
                        <button
                          onClick={() => copyToClipboard(proposal.boyDetails!.phone!, 'phone')}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                          title="העתק מספר טלפון"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-200">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="font-mono text-xs text-blue-800 break-all flex-1">
                        {proposal.boyDetails?.email && proposal.boyDetails?.email.trim() && proposal.boyDetails?.email !== 'ריק' ? proposal.boyDetails.email : 'אין מייל'}
                      </span>
                      {proposal.boyDetails?.email && proposal.boyDetails?.email.trim() && proposal.boyDetails?.email !== 'ריק' && (
                        <button
                          onClick={() => copyToClipboard(proposal.boyDetails!.email!, 'email')}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                          title="העתק כתובת מייל"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* כפתורי יצירת קשר */}
                  <div className="flex gap-2">
                    {proposal.boyDetails?.phone && proposal.boyDetails?.phone.trim() && proposal.boyDetails?.phone !== 'ריק' && (
                      <Button
                        size="sm"
                        onClick={() => window.open(getWhatsAppLink(proposal.boyDetails!.phone!, proposal.boyDetails!.name, proposal.girlDetails?.name || ''), '_blank')}
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-lg shadow-sm"
                      >
                        <MessageCircle className="h-3 w-3" />
                        שלח ווטסאפ
                      </Button>
                    )}
                    
                    {proposal.boyDetails?.email && proposal.boyDetails?.email.trim() && proposal.boyDetails?.email !== 'ריק' && (
                      <Button
                        size="sm"
                        onClick={() => window.open(getGmailLink(proposal.boyDetails!.email!, proposal.boyDetails!.name, proposal.girlDetails?.name || '', `הצעת שידוך עבור ${proposal.boyDetails!.name} עם ${proposal.girlDetails?.name || ''}`), '_blank')}
                        className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg shadow-sm"
                      >
                        <Mail className="h-3 w-3" />
                        שלח מייל
                      </Button>
                    )}
                  </div>
                </div>

                {/* תגובת המועמד */}
                <div className="border-t border-blue-300 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-blue-600 rounded-full">
                      <MessageSquare className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-blue-900 font-semibold text-sm">תגובת המועמד</span>
                  </div>
                  
                  {/* סטטוס נוכחי */}
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-blue-200 mb-3">
                    {getResponseIcon(proposal.boy_response)}
                    <span className={proposal.boy_response ? 'font-semibold text-gray-800' : 'text-gray-500 text-sm'}>
                      {getResponseText(proposal.boy_response)}
                    </span>
                  </div>
                  
                  {/* כפתורי עדכון תגובה */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setIsUpdating(true)
                        try {
                          const success = await updateCandidateResponse(proposal.id, 'boy', 'interested', shadchanId)
                          if (success && onUpdate) {
                            await onUpdate()
                            showSuccessMessage('✅ תגובת מועמד עודכנה בהצלחה')
                          }
                        } catch (error) {
                          console.error('❌ שגיאה בעדכון תגובת מועמד:', error)
                          showErrorMessage('❌ שגיאה בעדכון תגובת המועמד')
                        } finally {
                          setIsUpdating(false)
                        }
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.boy_response === 'interested' 
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg border-2 border-green-600 font-bold' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-2 border-green-300 hover:border-green-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">מעוניין</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setShowBoyRejectionModal(true)
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.boy_response === 'not_interested' 
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg border-2 border-red-600 font-bold' 
                          : 'bg-white hover:bg-red-50 text-red-700 border-2 border-red-300 hover:border-red-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <X className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">לא מעוניין</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setIsUpdating(true)
                        try {
                          const success = await updateCandidateResponse(proposal.id, 'boy', 'needs_time', shadchanId)
                          if (success && onUpdate) {
                            await onUpdate()
                            showSuccessMessage('✅ תגובת מועמד עודכנה בהצלחה')
                          }
                        } catch (error) {
                          console.error('❌ שגיאה בעדכון תגובת מועמד:', error)
                          showErrorMessage('❌ שגיאה בעדכון תגובת המועמד')
                        } finally {
                          setIsUpdating(false)
                        }
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.boy_response === 'needs_time' 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg border-2 border-yellow-600 font-bold' 
                          : 'bg-white hover:bg-yellow-50 text-yellow-700 border-2 border-yellow-300 hover:border-yellow-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">צריך זמן</span>
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* כרטיס בת */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-5 rounded-xl border border-pink-200 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-pink-600 rounded-full">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-pink-900 font-bold text-lg">
                    {proposal.girlDetails?.name || 'טוען...'}
                  </p>
                    <p className="text-pink-600 text-sm font-medium">מועמדת</p>
                </div>
                </div>
                
                {/* פרטים אישיים */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-pink-200 rounded-full flex items-center justify-center">
                      <span className="text-pink-700 font-bold text-xs">🎂</span>
                    </div>
                    <span className="text-pink-800 font-medium">
                      {proposal.girlDetails?.age || 'לא צוין'} שנים
                    {proposal.girlDetails?.height && (
                        <span className="text-pink-600 mr-2">• {proposal.girlDetails.height}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-pink-200 rounded-full flex items-center justify-center">
                      <span className="text-pink-700 font-bold text-xs">💼</span>
                    </div>
                    <span className="text-pink-800 font-medium">
                      {proposal.girlDetails?.profession || 'לא צוין'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-pink-200 rounded-full flex items-center justify-center">
                      <span className="text-pink-700 font-bold text-xs">🕊️</span>
                    </div>
                    <span className="text-pink-800 font-medium">
                      {proposal.girlDetails?.community || 'לא צוין'}
                    {proposal.girlDetails?.religiousLevel && (
                        <span className="text-pink-600 mr-1"> • {proposal.girlDetails.religiousLevel}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-pink-200 rounded-full flex items-center justify-center">
                      <span className="text-pink-700 font-bold text-xs">📍</span>
                    </div>
                    <span className="text-pink-800 font-medium">
                      {proposal.girlDetails?.location || 'לא צוין'}
                    </span>
                  </div>
                  
                  {proposal.girlDetails?.education && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-pink-200 rounded-full flex items-center justify-center">
                        <span className="text-pink-700 font-bold text-xs">🎓</span>
                      </div>
                      <span className="text-pink-800 font-medium">
                        {proposal.girlDetails.education}
                      </span>
                    </div>
                  )}
                </div>

                {/* פרטי קשר */}
                <div className="border-t border-pink-300 pt-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-pink-600 rounded-full">
                      <Phone className="w-3 h-3 text-white" />
              </div>
                    <span className="text-pink-900 font-semibold text-sm">יצירת קשר</span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-pink-200">
                      <Phone className="h-4 w-4 text-pink-600" />
                      <span className="font-mono text-sm text-pink-800 flex-1">
                        {proposal.girlDetails?.phone && proposal.girlDetails?.phone.trim() && proposal.girlDetails?.phone !== 'ריק' ? proposal.girlDetails.phone : 'אין טלפון'}
                      </span>
                      {proposal.girlDetails?.phone && proposal.girlDetails?.phone.trim() && proposal.girlDetails?.phone !== 'ריק' && (
                        <button
                          onClick={() => copyToClipboard(proposal.girlDetails!.phone!, 'phone')}
                          className="p-1 text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded transition-colors"
                          title="העתק מספר טלפון"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-pink-200">
                      <Mail className="h-4 w-4 text-pink-600" />
                      <span className="font-mono text-xs text-pink-800 break-all flex-1">
                        {proposal.girlDetails?.email && proposal.girlDetails?.email.trim() && proposal.girlDetails?.email !== 'ריק' ? proposal.girlDetails.email : 'אין מייל'}
                      </span>
                      {proposal.girlDetails?.email && proposal.girlDetails?.email.trim() && proposal.girlDetails?.email !== 'ריק' && (
                        <button
                          onClick={() => copyToClipboard(proposal.girlDetails!.email!, 'email')}
                          className="p-1 text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded transition-colors"
                          title="העתק כתובת מייל"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* כפתורי יצירת קשר */}
                  <div className="flex gap-2">
                    {proposal.girlDetails?.phone && proposal.girlDetails?.phone.trim() && proposal.girlDetails?.phone !== 'ריק' && (
                      <Button
                        size="sm"
                        onClick={() => window.open(getWhatsAppLink(proposal.girlDetails!.phone!, proposal.girlDetails!.name, proposal.boyDetails?.name || ''), '_blank')}
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-lg shadow-sm"
                      >
                        <MessageCircle className="h-3 w-3" />
                        שלח ווטסאפ
                      </Button>
                    )}
                    
                    {proposal.girlDetails?.email && proposal.girlDetails?.email.trim() && proposal.girlDetails?.email !== 'ריק' && (
                      <Button
                        size="sm"
                        onClick={() => window.open(getGmailLink(proposal.girlDetails!.email!, proposal.girlDetails!.name, proposal.boyDetails?.name || '', `הצעת שידוך עבור ${proposal.girlDetails!.name} עם ${proposal.boyDetails?.name || ''}`), '_blank')}
                        className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg shadow-sm"
                      >
                        <Mail className="h-3 w-3" />
                        שלח מייל
                      </Button>
                    )}
                  </div>
                </div>

                {/* תגובת המועמדת */}
                <div className="border-t border-pink-300 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-pink-600 rounded-full">
                      <MessageSquare className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-pink-900 font-semibold text-sm">תגובת המועמדת</span>
                  </div>
                  
                  {/* סטטוס נוכחי */}
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-pink-200 mb-3">
                    {getResponseIcon(proposal.girl_response)}
                    <span className={proposal.girl_response ? 'font-semibold text-gray-800' : 'text-gray-500 text-sm'}>
                      {getResponseText(proposal.girl_response)}
                    </span>
                  </div>
                  
                  {/* כפתורי עדכון תגובה */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setIsUpdating(true)
                        try {
                          const success = await updateCandidateResponse(proposal.id, 'girl', 'interested', shadchanId)
                          if (success && onUpdate) {
                            await onUpdate()
                            showSuccessMessage('✅ תגובת מועמדת עודכנה בהצלחה')
                          }
                        } catch (error) {
                          console.error('❌ שגיאה בעדכון תגובת מועמדת:', error)
                          showErrorMessage('❌ שגיאה בעדכון תגובת המועמדת')
                        } finally {
                          setIsUpdating(false)
                        }
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.girl_response === 'interested' 
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg border-2 border-green-600 font-bold' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-2 border-green-300 hover:border-green-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">מעוניינת</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setShowGirlRejectionModal(true)
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.girl_response === 'not_interested' 
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg border-2 border-red-600 font-bold' 
                          : 'bg-white hover:bg-red-50 text-red-700 border-2 border-red-300 hover:border-red-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <X className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">לא מעוניינת</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (isUpdating) return; // מניעת לחיצות כפולות
                        setIsUpdating(true)
                        try {
                          const success = await updateCandidateResponse(proposal.id, 'girl', 'needs_time', shadchanId)
                          if (success && onUpdate) {
                            await onUpdate()
                            showSuccessMessage('✅ תגובת מועמדת עודכנה בהצלחה')
                          }
                        } catch (error) {
                          console.error('❌ שגיאה בעדכון תגובת מועמדת:', error)
                          showErrorMessage('❌ שגיאה בעדכון תגובת המועמדת')
                        } finally {
                          setIsUpdating(false)
                        }
                      }}
                      className={`min-h-[36px] px-2 py-2 text-xs transition-all duration-200 ${
                        proposal.girl_response === 'needs_time' 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg border-2 border-yellow-600 font-bold' 
                          : 'bg-white hover:bg-yellow-50 text-yellow-700 border-2 border-yellow-300 hover:border-yellow-400 shadow-sm'
                      } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">צריכה זמן</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-left mr-4">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDaysAgo(proposal.daysInProcess || 0)}</span>
            </div>
            <div className="text-xs text-gray-400">
              ציון: {proposal.match_score ? (proposal.match_score * 10).toFixed(1) : 'N/A'}/10
            </div>
          </div>
        </div>

        {/* קו הפרדה עדין */}
        <div className="border-b border-gray-100 mb-4"></div>

        {/* נימוק התאמה מפורט - אקורדיון */}
        <div className="mb-4">
          <button
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-medium">📊 פירוט ההתאמה</span>
              {/* אינדיקטור של מידע זמין */}
              {(proposal.logicalScore || proposal.gptScore || proposal.finalScore || 
                proposal.strengths?.length || proposal.concerns?.length || proposal.summary) && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                {isDetailsExpanded ? 'הסתר' : 'הצג'}
              </span>
              {isDetailsExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
              )}
            </div>
          </button>
          
          {isDetailsExpanded && (
            <div className="bg-blue-50 p-4 rounded-lg space-y-3 mt-2 accordion-content"
                 style={{
                   animation: 'slideDown 0.3s ease-out'
                 }}>
            
            {/* ציונים - תמיד נציג משהו */}
            <div className="flex flex-wrap gap-4 text-sm">
              {/* ציונים חדשים */}
              {proposal.logicalScore && (
                <div className="flex items-center gap-1">
                  <span>🧮 לוגי:</span>
                  <span className="font-semibold text-blue-700">{proposal.logicalScore.toFixed(1)}/10</span>
                </div>
              )}
              {proposal.gptScore && (
                <div className="flex items-center gap-1">
                  <span>🤖 GPT:</span>
                  <span className="font-semibold text-purple-700">{proposal.gptScore}/10</span>
                </div>
              )}
              {proposal.finalScore && (
                <div className="flex items-center gap-1">
                  <span>🎯 סופי:</span>
                  <span className="font-semibold text-green-700">{proposal.finalScore.toFixed(1)}/10</span>
                </div>
              )}
              
              {/* אם אין ציונים חדשים, נציג את הציון הישן */}
              {(!proposal.logicalScore && !proposal.gptScore && !proposal.finalScore) && proposal.match_score && (
                <div className="flex items-center gap-1">
                  <span>🎯 ציון כללי:</span>
                  <span className="font-semibold text-green-700">{(proposal.match_score * 10).toFixed(1)}/10</span>
                </div>
              )}
              
              {/* אם אין בכלל ציונים */}
              {!proposal.logicalScore && !proposal.gptScore && !proposal.finalScore && !proposal.match_score && (
                <div className="flex items-center gap-1">
                  <span>🎯 ציון:</span>
                  <span className="font-semibold text-gray-600">לא זמין</span>
                </div>
              )}
            </div>

            {/* סיכום - נציג רק סיכום נקי, לא את כל ai_reasoning */}
            {proposal.summary && (
              <div>
                <p className="font-medium text-gray-800 mb-2">💭 סיכום ההתאמה:</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {proposal.summary}
                </p>
              </div>
            )}

            {/* נקודות חוזק */}
            {proposal.strengths && proposal.strengths.length > 0 && (
              <div>
                <p className="font-medium text-green-700 mb-2">✅ נקודות חוזק:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {proposal.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* נקודות לתשומת לב */}
            {proposal.concerns && proposal.concerns.length > 0 && (
              <div>
                <p className="font-medium text-orange-700 mb-2">⚠️ נקודות לתשומת לב:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {proposal.concerns.map((concern, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* הודעה אם אין מידע מפורט */}
            {!proposal.logicalScore && !proposal.gptScore && !proposal.finalScore && 
             (!proposal.strengths || proposal.strengths.length === 0) && 
             (!proposal.concerns || proposal.concerns.length === 0) && 
             !proposal.summary && (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">אין מידע מפורט זמין להצעה זו</p>
                <p className="text-gray-400 text-xs mt-1">הצעות חדשות יכללו פירוט מלא</p>
              </div>
            )}
            </div>
          )}
        </div>



        {/* היסטוריית הערות - מחוץ לאקורדיון */}


        {(() => {
          console.log('🔍 בדיקת הערות עבור הצעה:', proposal.id, {
            notes: proposal.notes,
            notesHistory: proposal.notesHistory,
            hasNotesHistory: proposal.notesHistory && proposal.notesHistory.length > 0,
            hasNotes: !!proposal.notes
          })
          return null
        })()}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-yellow-700 font-medium">
              📝 הערות {proposal.notesHistory && proposal.notesHistory.length > 0 ? `(${proposal.notesHistory.length})` : ''}:
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNoteModal(true)}
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-100 text-xs px-2 py-1"
              disabled={isUpdating}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              הוסף הערה
            </Button>
          </div>
          
          {/* תוכן ההערות */}
          {((proposal.notesHistory && proposal.notesHistory.length > 0) || proposal.notes) ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {/* הצגת היסטוריית הערות אם קיימת */}
              {proposal.notesHistory && proposal.notesHistory.length > 0 ? (
                proposal.notesHistory.slice().reverse().map((note, index) => {
                  const actualIndex = proposal.notesHistory!.length - 1 - index; // האינדקס האמיתי במערך
                  const isEditing = editingNoteIndex === actualIndex;
                  
                  return (
                  <div key={index} className="bg-yellow-100 p-2 rounded text-sm">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col">
                      <span className="text-xs text-yellow-600">
                        {new Date(note.created_at).toLocaleString('he-IL', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                          {note.edited_at && (
                            <span className="text-xs text-yellow-500">
                              עודכן: {new Date(note.edited_at).toLocaleString('he-IL', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                    </div>
                        
                        <div className="flex items-center gap-2">
                          {/* תגית סטטוס */}
                          {note.status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(note.status)}`}>
                              {getStatusText(note.status)}
                            </span>
                          )}
                          
                          {/* כפתורי עריכה ומחיקה */}
                          {!isUpdating && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEditingNote(actualIndex, note.content)}
                                className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 rounded transition-colors"
                                title="ערוך הערה"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteNote(actualIndex)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-200 rounded transition-colors"
                                title="מחק הערה"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* תוכן ההערה - עריכה או תצוגה */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            className="w-full p-2 border rounded text-sm resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditNote(actualIndex, editNoteContent)}
                              disabled={!editNoteContent.trim() || isUpdating}
                              className="text-xs py-1 px-2"
                            >
                              שמור
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditingNote}
                              disabled={isUpdating}
                              className="text-xs py-1 px-2"
                            >
                              ביטול
                            </Button>
                          </div>
                        </div>
                      ) : (
                    <p className="text-yellow-800 leading-relaxed">
                      {note.content}
                    </p>
                      )}
                  </div>
                  )
                })
              ) : proposal.notes ? (
                /* הצגת הערה ישנה אם אין היסטוריה */
                <div className="bg-yellow-100 p-2 rounded text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-yellow-600">
                      {proposal.updated_at ? new Date(proposal.updated_at).toLocaleString('he-IL', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'התאמה חדשה'}
                    </span>
                  </div>
                  <p className="text-yellow-800 leading-relaxed">
                    {proposal.notes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-yellow-600 text-sm italic">אין הערות עדיין - לחץ להוספת הערה ראשונה</p>
          )}
        </div>


      </Card>

      {/* מודל עדכון סטטוס */}
      {showStatusModal && (
        <StatusUpdateModal
          proposal={proposal}
          onClose={() => setShowStatusModal(false)}
          onUpdate={handleStatusUpdate}
        />
      )}

      {/* מודל הוספת הערה */}
      {showNoteModal && (
        <AddNoteModal
          proposal={proposal}
          onClose={() => setShowNoteModal(false)}
          onAddNote={handleAddNote}
        />
      )}

      {/* מודל דחיה לבן */}
      {showBoyRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">סיבת דחיה - {proposal.boyDetails?.name}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                מדוע {proposal.boyDetails?.name} לא מעוניין? (חובה)
              </label>
              <textarea
                value={boyRejectionReason}
                onChange={(e) => setBoyRejectionReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={4}
                placeholder="לדוגמה: גיל לא מתאים, מרחק גיאוגרפי, העדפות דתיות שונות..."
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!boyRejectionReason.trim()) {
                    alert('יש למלא את סיבת הדחיה');
                    return;
                  }
                  
                  setIsUpdating(true)
                  try {
                    const success = await updateCandidateResponse(proposal.id, 'boy', 'not_interested', shadchanId, boyRejectionReason)
                    if (success && onUpdate) {
                      await onUpdate()
                      showSuccessMessage('✅ תגובת מועמד עודכנה בהצלחה')
                    }
                  } catch (error) {
                    console.error('❌ שגיאה בעדכון תגובת מועמד:', error)
                    showErrorMessage('❌ שגיאה בעדכון תגובת המועמד')
                  } finally {
                    setIsUpdating(false)
                    setShowBoyRejectionModal(false)
                    setBoyRejectionReason('')
                  }
                }}
                disabled={!boyRejectionReason.trim() || isUpdating}
              >
                שמור דחיה
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBoyRejectionModal(false)
                  setBoyRejectionReason('')
                }}
                disabled={isUpdating}
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* מודל דחיה לבת */}
      {showGirlRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">סיבת דחיה - {proposal.girlDetails?.name}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                מדוע {proposal.girlDetails?.name} לא מעוניינת? (חובה)
              </label>
              <textarea
                value={girlRejectionReason}
                onChange={(e) => setGirlRejectionReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={4}
                placeholder="לדוגמה: גיל לא מתאים, מרחק גיאוגרפי, העדפות דתיות שונות..."
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!girlRejectionReason.trim()) {
                    alert('יש למלא את סיבת הדחיה');
                    return;
                  }
                  
                  setIsUpdating(true)
                  try {
                    const success = await updateCandidateResponse(proposal.id, 'girl', 'not_interested', shadchanId, girlRejectionReason)
                    if (success && onUpdate) {
                      await onUpdate()
                      showSuccessMessage('✅ תגובת מועמדת עודכנה בהצלחה')
                    }
                  } catch (error) {
                    console.error('❌ שגיאה בעדכון תגובת מועמדת:', error)
                    showErrorMessage('❌ שגיאה בעדכון תגובת המועמדת')
                  } finally {
                    setIsUpdating(false)
                    setShowGirlRejectionModal(false)
                    setGirlRejectionReason('')
                  }
                }}
                disabled={!girlRejectionReason.trim() || isUpdating}
              >
                שמור דחיה
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowGirlRejectionModal(false)
                  setGirlRejectionReason('')
                }}
                disabled={isUpdating}
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// מודל עדכון סטטוס
const StatusUpdateModal: React.FC<{
  proposal: EnhancedProposal
  onClose: () => void
  onUpdate: (newStatus: string, notes?: string) => void
}> = ({ proposal, onClose, onUpdate }) => {
  const [newStatus, setNewStatus] = useState(proposal.status)
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (!notes.trim()) {
      alert('יש למלא את שדה ההערות')
      return
    }
    onUpdate(newStatus, notes)
  }

  const statusOptions = [
    { value: 'ready_for_processing', label: 'ממתינה לתחילת טיפול', description: 'ההצעה אושרה ומחכה לטיפול' },
    { value: 'ready_for_contact', label: 'מוכן ליצירת קשר', description: 'ההצעה מוכנה ליצירת קשר עם המועמדים' },
    { value: 'contacting', label: 'יוצר קשר', description: 'בתהליך יצירת קשר עם המועמדים' },
    { value: 'awaiting_response', label: 'ממתין לתגובה', description: 'ממתין לתגובות מהמועמדים' },
    { value: 'schedule_meeting', label: 'לקבוע פגישה', description: 'שני הצדדים מעוניינים, יש לקבוע פגישה' },
    { value: 'meeting_scheduled', label: 'פגישה נקבעה', description: 'פגישה נקבעה בין המועמדים' },
    { value: 'meeting_completed', label: 'פגישה התקיימה', description: 'הפגישה התקיימה' },
    { value: 'in_meeting_process', label: 'בתהליך פגישות', description: 'המועמדים בתהליך פגישות' },
    { value: 'completed', label: 'מזל טוב! 🎉', description: 'הזוג התארס' },
    { value: 'rejected_by_candidate', label: 'נדחתה על ידי מועמד', description: 'אחד המועמדים דחה את ההצעה' },
    { value: 'closed', label: 'נסגרה', description: 'ההצעה נסגרה' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">עדכון סטטוס הצעה</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סטטוס חדש:
            </label>
            <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2">
              {statusOptions.map((option) => (
                <label key={option.value} className="flex items-start gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={newStatus === option.value}
                    onChange={(e) => setNewStatus(e.target.value as typeof proposal.status)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-gray-600">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              הערות (חובה):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="הערות נוספות על העדכון (שדה חובה)..."
              required
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button 
            onClick={handleSubmit} 
            className="flex-1"
            disabled={!notes.trim()}
          >
            עדכן סטטוס
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  )
}

// מודל הוספת הערה
const AddNoteModal: React.FC<{
  proposal: EnhancedProposal
  onClose: () => void
  onAddNote: (notes: string) => void
}> = ({ onClose, onAddNote }) => {
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (notes.trim()) {
      onAddNote(notes.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">הוספת הערה</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            הערה:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={4}
            placeholder="כתוב את ההערה כאן..."
            autoFocus
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleSubmit} 
            className="flex-1"
            disabled={!notes.trim()}
          >
            הוסף הערה
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  )
} 