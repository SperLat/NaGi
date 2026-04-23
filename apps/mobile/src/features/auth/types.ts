export interface AuthResult {
  success: boolean;
  userId?: string;
  orgId?: string;
  error: string | null;
}
