export type UserRole = 'free' | 'subscriber';

export interface UserSubscription {
  role: UserRole;
  validUntil?: string;
  stripeCustomerId?: string;
}

export interface User {
  uid: string;
  email: string | null;
  subscription: UserSubscription;
}