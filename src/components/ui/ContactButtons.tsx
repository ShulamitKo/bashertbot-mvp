import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { MatchProposal, DetailedCandidate } from '../../types';
import { Phone, Mail, MessageCircle, User, CheckCircle, X, Clock } from 'lucide-react';

interface ContactButtonsProps {
  proposal: MatchProposal;
  boyData?: DetailedCandidate;
  girlData?: DetailedCandidate;
  onUpdateResponse: (
    side: 'boy' | 'girl',
    response: 'interested' | 'not_interested' | 'needs_time',
    shadchanId: string,
    rejectionReason?: string
  ) => Promise<void>;
  shadchanId: string;
}

export const ContactButtons: React.FC<ContactButtonsProps> = ({
  proposal,
  boyData,
  girlData,
  onUpdateResponse,
  shadchanId
}) => {

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

  // רכיב עבור מועמד יחיד
  const CandidateSection: React.FC<{
    side: 'boy' | 'girl';
    candidate: DetailedCandidate;
    partnerName: string;
    response?: string;
  }> = ({ side, candidate, partnerName, response }) => {
    const [isUpdatingResponse, setIsUpdatingResponse] = useState(false);
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // דיבוג פרטי קשר בקומפוננט ContactButtons
    console.log(`🔍 דיבוג פרטי קשר - ${side === 'boy' ? 'בן' : 'בת'} ${candidate.name}:`, {
      candidateId: candidate.id,
      candidateObject: candidate,
      emailField: candidate.email || 'ריק',
      phoneField: candidate.phone || 'ריק',
      contactField: candidate.contact || 'ריק',
      previouslyProposedField: candidate.previouslyProposed || 'ריק',
      currentlyProposedField: candidate.currentlyProposed || 'ריק',
      allFieldsWithValues: Object.entries(candidate).filter(([, value]) => value && value !== '').map(([key, value]) => `${key}: ${value}`),
      searchForEmailPattern: Object.entries(candidate).filter(([, value]) => value && typeof value === 'string' && value.includes('@')).map(([key, value]) => `${key}: ${value}`)
    })
    
    const handleWhatsAppClick = () => {
      if (candidate.phone && candidate.phone.trim()) {
        window.open(getWhatsAppLink(candidate.phone, candidate.name, partnerName), '_blank');
      } else {
        console.warn('לא ניתן ליצור קשר - נתוני טלפון לא תקינים:', { phone: candidate.phone });
      }
    };

    const handleResponseUpdate = async (newResponse: 'interested' | 'not_interested' | 'needs_time', reason?: string) => {
      setIsUpdatingResponse(true);
      try {
        await onUpdateResponse(side, newResponse, shadchanId, reason);
      } catch (error) {
        console.error('שגיאה בעדכון תגובה:', error);
      } finally {
        setIsUpdatingResponse(false);
      }
    };

    const handleRejection = () => {
      setShowRejectionModal(true);
    };

    const handleRejectionSubmit = async () => {
      if (!rejectionReason.trim()) {
        alert('יש למלא את סיבת הדחיה');
        return;
      }
      
      await handleResponseUpdate('not_interested', rejectionReason);
      setShowRejectionModal(false);
      setRejectionReason('');
    };

    const getResponseIcon = (resp?: string) => {
      switch (resp) {
        case 'interested': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'not_interested': return <X className="h-4 w-4 text-red-500" />;
        case 'needs_time': return <Clock className="h-4 w-4 text-yellow-500" />;
        default: return <div className="h-4 w-4 border border-gray-300 rounded-full" />;
      }
    };

    const getResponseText = (resp?: string) => {
      switch (resp) {
        case 'interested': return 'מעוניין/ת';
        case 'not_interested': return 'לא מעוניין/ת';
        case 'needs_time': return 'צריך/ה זמן';
        default: return 'לא עודכן';
      }
    };

    return (
      <>
        <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
          {/* כותרת מועמד */}
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{candidate.name}</span>
          </div>

          {/* פרטי קשר בטקסט */}
          <div className="space-y-1 mb-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-3 w-3" />
              <span className="font-mono">
                {candidate.phone && candidate.phone.trim() && candidate.phone !== 'ריק' ? candidate.phone : 'אין טלפון'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="h-3 w-3" />
              <span className="font-mono text-xs">
                {candidate.email && candidate.email.trim() && candidate.email !== 'ריק' ? candidate.email : 'אין מייל'}
              </span>
            </div>
          </div>

          {/* כפתורי יצירת קשר */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2">יצירת קשר:</div>
            <div className="flex gap-2 flex-wrap">
              {candidate.phone && candidate.phone.trim() && candidate.phone !== 'ריק' && (
                <button
                  onClick={() => handleWhatsAppClick()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: '2px solid #16a34a',
                    cursor: 'pointer',
                    minHeight: '32px',
                    opacity: 1,
                    visibility: 'visible',
                    backgroundColor: '#ffffff',
                    color: '#15803d',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdf4'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  <MessageCircle className="h-4 w-4" style={{ marginLeft: '4px' }} />
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>שלח ווטסאפ</span>
                </button>
              )}
              
              {candidate.email && candidate.email.trim() && candidate.email !== 'ריק' && (
                <button
                  onClick={() => window.open(getGmailLink(candidate.email!, candidate.name, partnerName, `הצעת שידוך עבור ${candidate.name} עם ${partnerName}`), '_blank')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: '2px solid #2563eb',
                    cursor: 'pointer',
                    minHeight: '32px',
                    opacity: 1,
                    visibility: 'visible',
                    backgroundColor: '#ffffff',
                    color: '#1d4ed8',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  <Mail className="h-4 w-4" style={{ marginLeft: '4px' }} />
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>שלח מייל</span>
                </button>
              )}
              
              {(!candidate.phone || !candidate.phone.trim() || candidate.phone === 'ריק') && (!candidate.email || !candidate.email.trim() || candidate.email === 'ריק') && (
                <span className="text-sm text-gray-500">אין פרטי קשר זמינים</span>
              )}
            </div>
          </div>

          {/* תגובת המועמד */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">תגובת המועמד:</div>
            
            {/* סטטוס נוכחי */}
            <div className="flex items-center gap-2 text-sm mb-2">
              {getResponseIcon(response)}
              <span className={response ? 'font-medium' : 'text-gray-500'}>{getResponseText(response)}</span>
            </div>
            
            {/* כפתורי עדכון תגובה */}
            <div className="flex gap-2 flex-wrap items-center mb-2">
              <button
                onClick={() => !isUpdatingResponse && handleResponseUpdate('interested')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: '2px solid',
                  cursor: 'pointer',
                  minHeight: '40px',
                  opacity: 1,
                  visibility: 'visible',
                  backgroundColor: response === 'interested' ? '#16a34a' : '#ffffff',
                  color: response === 'interested' ? '#ffffff' : '#15803d',
                  borderColor: '#16a34a',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (response !== 'interested') {
                    e.currentTarget.style.backgroundColor = '#f0fdf4'
                  }
                }}
                onMouseLeave={(e) => {
                  if (response !== 'interested') {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }
                }}
              >
                <CheckCircle className="h-4 w-4" style={{ marginLeft: '4px' }} />
                <span style={{ fontWeight: '700', fontSize: '14px' }}>מעוניין/ת</span>
              </button>
              
              <button
                onClick={() => !isUpdatingResponse && handleRejection()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: '2px solid',
                  cursor: 'pointer',
                  minHeight: '40px',
                  opacity: 1,
                  visibility: 'visible',
                  backgroundColor: response === 'not_interested' ? '#dc2626' : '#ffffff',
                  color: response === 'not_interested' ? '#ffffff' : '#b91c1c',
                  borderColor: '#dc2626',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (response !== 'not_interested') {
                    e.currentTarget.style.backgroundColor = '#fef2f2'
                  }
                }}
                onMouseLeave={(e) => {
                  if (response !== 'not_interested') {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }
                }}
              >
                <X className="h-4 w-4" style={{ marginLeft: '4px' }} />
                <span style={{ fontWeight: '700', fontSize: '14px' }}>לא מעוניין/ת</span>
              </button>
              
              <button
                onClick={() => !isUpdatingResponse && handleResponseUpdate('needs_time')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: '2px solid',
                  cursor: 'pointer',
                  minHeight: '40px',
                  opacity: 1,
                  visibility: 'visible',
                  backgroundColor: response === 'needs_time' ? '#d97706' : '#ffffff',
                  color: response === 'needs_time' ? '#ffffff' : '#c2410c',
                  borderColor: '#d97706',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (response !== 'needs_time') {
                    e.currentTarget.style.backgroundColor = '#fffbeb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (response !== 'needs_time') {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }
                }}
              >
                <Clock className="h-4 w-4" style={{ marginLeft: '4px' }} />
                <span style={{ fontWeight: '700', fontSize: '14px' }}>צריך זמן</span>
              </button>
              
              {isUpdatingResponse && (
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full ml-2"></div>
              )}
            </div>
          </div>
        </div>
        
        {/* מודל סיבת דחיה */}
        {showRejectionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">סיבת דחיה - {candidate.name}</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  מדוע {candidate.name} {side === 'boy' ? 'לא מעוניין' : 'לא מעוניינת'}? (חובה)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={4}
                  placeholder="לדוגמה: גיל לא מתאים, מרחק גיאוגרפי, העדפות דתיות שונות..."
                  autoFocus
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleRejectionSubmit} 
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  disabled={!rejectionReason.trim() || isUpdatingResponse}
                >
                  {isUpdatingResponse ? 'מעדכן...' : 'אישור דחיה'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionReason('');
                  }} 
                  className="flex-1"
                  disabled={isUpdatingResponse}
                >
                  ביטול
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // אם אין נתוני מועמדים, לא מציגים כלום
  if (!boyData || !girlData) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <Clock className="h-6 w-6 mx-auto mb-2" />
          <p>טוען פרטי מועמדים...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold">יצירת קשר ומעקב תגובות</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* צד הבן */}
        <CandidateSection
          side="boy"
          candidate={boyData}
          partnerName={girlData.name}
          response={proposal.boy_response}
        />

        {/* צד הבת */}
        <CandidateSection
          side="girl"
          candidate={girlData}
          partnerName={boyData.name}
          response={proposal.girl_response}
        />
      </div>
    </Card>
  );
}; 