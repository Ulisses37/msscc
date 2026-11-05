export type FinancialRecordResource = 'donations' | 'memberships';

export type SubscriptionStatus =
  | 'subscribed'
  | 'pending'
  | 'unsubscribed'
  | 'not_recorded'
  | 'email_unavailable';