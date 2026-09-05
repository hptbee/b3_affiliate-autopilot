export interface UserContext {
  userId: string;
}

/** Bootstrap single-user until authentication is added. Replace in API middleware only. */
export const BOOTSTRAP_USER_ID = '00000000-0000-4000-8000-000000000001';
