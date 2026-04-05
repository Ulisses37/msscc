/** Token pair returned by django-simplejwt's TokenObtainPairView. */
export interface AuthTokens {
  access: string;
  refresh: string;
}

/** Decoded payload from the JWT access token. */
export interface UserPayload {
  userId: number;
  email: string;
}

/** Shape of the value provided by AuthContext. */
export interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserPayload | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

/** Props for the LoginButton component. */
export interface LoginButtonProps {
  onLoginClick: () => void;
}
