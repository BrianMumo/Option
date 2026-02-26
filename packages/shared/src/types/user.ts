export type UserRole = 'user' | 'admin' | 'super_admin';
export type KycStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface User {
  id: string;
  phone: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  kyc_status: KycStatus;
  demo_balance: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface UserPublic {
  id: string;
  phone: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_verified: boolean;
  kyc_status: KycStatus;
  demo_balance: number;
}
