import React from 'react'
import { EnhancedProposal } from '../../types'
import { getProposalIndicators } from '../../lib/proposals'

interface ProposalBadgesProps {
  proposal: EnhancedProposal
  size?: 'sm' | 'md' | 'lg'
  showIcons?: boolean
  maxBadges?: number
}

export const ProposalBadges: React.FC<ProposalBadgesProps> = ({
  proposal,
  size = 'sm',
  showIcons = true,
  maxBadges = 3
}) => {
  const { badges } = getProposalIndicators(proposal)
  
  // הגבלת מספר התגיות שמוצגות
  const displayBadges = badges.slice(0, maxBadges)
  
  // גדלים שונים
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5',
    lg: 'text-base px-3 py-2'
  }
  
  // צבעי רקע לפי סוג
  const getTypeClasses = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'waiting':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  
  if (displayBadges.length === 0) {
    return null
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {displayBadges.map((badge, index) => (
        <span
          key={index}
          className={`
            inline-flex items-center gap-1 rounded-full border font-medium
            ${sizeClasses[size]}
            ${getTypeClasses(badge.type)}
          `}
          title={badge.text}
        >
          {showIcons && <span className="text-xs">{badge.icon}</span>}
          <span>{badge.text}</span>
        </span>
      ))}
      {badges.length > maxBadges && (
        <span
          className={`
            inline-flex items-center rounded-full border font-medium
            ${sizeClasses[size]}
            bg-gray-100 text-gray-600 border-gray-200
          `}
          title={`עוד ${badges.length - maxBadges} סמנים`}
        >
          +{badges.length - maxBadges}
        </span>
      )}
    </div>
  )
}

// רכיב מיוחד לתצוגת סמן דחיפות ראשי
export const UrgencyIndicator: React.FC<{ proposal: EnhancedProposal }> = ({ proposal }) => {
  const { isUrgent, priorityScore } = getProposalIndicators(proposal)
  
  if (!isUrgent && priorityScore < 5) {
    return null
  }
  
  return (
    <div className="flex items-center gap-1">
      {isUrgent && (
        <span className="flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse">
          !
        </span>
      )}
      {priorityScore >= 5 && !isUrgent && (
        <span className="flex items-center justify-center w-5 h-5 bg-yellow-500 text-white rounded-full text-xs font-bold">
          ⚠
        </span>
      )}
    </div>
  )
} 