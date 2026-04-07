import React from 'react';

export type BadgeStatus = 
  | 'draft' | 'submitted' | 'prechecked' | 'awaiting_kyc' | 'under_review' | 'approved' | 'rejected'
  | 'not_started' | 'pending' | 'needs_input' | 'manual_review' | 'expired'
  | 'approved_for_tokenization' | 'tokenized' | 'active' | 'sold'
  | 'created' | 'blocked_kyc_required' | 'pending_compliance' | 'paid' | 'failed' | 'cancelled';

export interface StatusBadgeProps {
  status: BadgeStatus | string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  let colorClass = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  const label = status.replace(/_/g, ' ').toUpperCase();

  const strStatus = status.toLowerCase();

  if (['approved', 'active', 'sold', 'paid', 'tokenized', 'approved_for_tokenization'].includes(strStatus)) {
    colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (['rejected', 'failed', 'cancelled', 'expired', 'blocked_kyc_required'].includes(strStatus)) {
    colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';
  } else if (['pending', 'submitted', 'prechecked', 'awaiting_kyc', 'under_review', 'needs_input', 'manual_review', 'created', 'pending_compliance'].includes(strStatus)) {
    colorClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass} ${className}`}>
      {label}
    </span>
  );
}
