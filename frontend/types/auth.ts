/** Access token returned after the refresh token is stored in an HttpOnly cookie. */
export interface AuthTokens {
  access: string;
}

/** Decoded payload from the JWT access token. */
export interface UserPayload {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;

  permissionData: Record<string, boolean>;
  isExecutive: boolean;
  isSuperuser: boolean;
}

/** Shape of the value provided by AuthContext. */
export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserPayload | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Props for the LoginButton component. */
export interface LoginButtonProps {
  onLoginClick: () => void;
  label?: string;
}
