// User roles
export type UserRole = 'user' | 'volunteer' | 'admin';

// User data in database
export interface UserData {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  createdAt: number;
}


// Authentication context type
export interface AuthContextType {
  user: any;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  login: (selectedRole?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

// Role check result
export interface RoleCheckResult {
  role: UserRole;
  isInitialSetup: boolean;
}
