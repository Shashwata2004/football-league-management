import type { UserRole } from "@flms/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: UserRole;
        profileId: string;
      };
    }
  }
}

export {};
