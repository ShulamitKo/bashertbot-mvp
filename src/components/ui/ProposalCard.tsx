import React, { useState } from 'react'
import { 
  User, 
  Calendar, 
  Clock, 
  Eye,
  PenTool,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { EnhancedProposal } from '../../types'
import { updateProposalStatus } from '../../lib/proposals'

interface ProposalCardProps {
  proposal: EnhancedProposal
  onUpdate?: () => void
  onViewProfiles?: (proposal: EnhancedProposal) => void
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onUpdate,
  onViewProfiles
}) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    const colors = {
      approved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      closed: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const texts = {
      approved: 'הצעה חדשה',
      in_progress: 'בתהליך',
      completed: 'מזל טוב',
      closed: 'נדחתה'
    }
    return texts[status as keyof typeof texts] || status
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
            
            {/* פרטי המועמדים */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <p className="text-blue-800 font-semibold text-lg">
                    {proposal.boyDetails?.name || 'טוען...'}
                  </p>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-blue-700">
                    <span className="font-medium">גיל:</span> {proposal.boyDetails?.age || 'לא צוין'}
                    {proposal.boyDetails?.height && (
                      <span className="mr-3">• <span className="font-medium">גובה:</span> {proposal.boyDetails.height}</span>
                    )}
                  </p>
                  <p className="text-blue-600">
                    <span className="font-medium">מקצוע:</span> {proposal.boyDetails?.profession || 'לא צוין'}
                  </p>
                  <p className="text-blue-600">
                    <span className="font-medium">עדה:</span> {proposal.boyDetails?.community || 'לא צוין'}
                    {proposal.boyDetails?.religiousLevel && (
                      <span className="mr-2">• {proposal.boyDetails.religiousLevel}</span>
                    )}
                  </p>
                  <p className="text-blue-500 text-xs">
                    📍 {proposal.boyDetails?.location || 'לא צוין'}
                  </p>
                  {proposal.boyDetails?.education && (
                    <p className="text-blue-500 text-xs">
                      🎓 {proposal.boyDetails.education}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="bg-pink-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-pink-600" />
                  <p className="text-pink-800 font-semibold text-lg">
                    {proposal.girlDetails?.name || 'טוען...'}
                  </p>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-pink-700">
                    <span className="font-medium">גיל:</span> {proposal.girlDetails?.age || 'לא צוין'}
                    {proposal.girlDetails?.height && (
                      <span className="mr-3">• <span className="font-medium">גובה:</span> {proposal.girlDetails.height}</span>
                    )}
                  </p>
                  <p className="text-pink-600">
                    <span className="font-medium">מקצוע:</span> {proposal.girlDetails?.profession || 'לא צוין'}
                  </p>
                  <p className="text-pink-600">
                    <span className="font-medium">עדה:</span> {proposal.girlDetails?.community || 'לא צוין'}
                    {proposal.girlDetails?.religiousLevel && (
                      <span className="mr-2">• {proposal.girlDetails.religiousLevel}</span>
                    )}
                  </p>
                  <p className="text-pink-500 text-xs">
                    📍 {proposal.girlDetails?.location || 'לא צוין'}
                  </p>
                  {proposal.girlDetails?.education && (
                    <p className="text-pink-500 text-xs">
                      🎓 {proposal.girlDetails.education}
                    </p>
                  )}
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



        {/* היסטוريית הערות - מחוץ לאקורדיון */}
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
                proposal.notesHistory.slice().reverse().map((note, index) => (
                  <div key={index} className="bg-yellow-100 p-2 rounded text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-yellow-600">
                        {new Date(note.created_at).toLocaleString('he-IL', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-yellow-800 leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))
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
                      }) : 'לא ידוע'}
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
    onUpdate(newStatus, notes || undefined)
  }

  const statusOptions = [
    { value: 'approved', label: 'הצעה חדשה', description: 'ההצעה מחכה לתחילת טיפול' },
    { value: 'in_progress', label: 'בתהליך', description: 'יצרתי קשר ומחכה לתגובות' },
    { value: 'completed', label: 'מזל טוב', description: 'הזוג התארס' },
    { value: 'closed', label: 'נדחתה', description: 'ההצעה נדחתה' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">עדכון סטטוס הצעה</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סטטוס חדש:
            </label>
            <div className="space-y-2">
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
              הערות (אופציונלי):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="הערות נוספות על העדכון..."
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button onClick={handleSubmit} className="flex-1">
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
}> = ({ proposal, onClose, onAddNote }) => {
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