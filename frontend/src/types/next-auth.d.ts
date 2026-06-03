import 'next-auth';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null;
      role: Role;
      status: UserStatus;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    status: UserStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    status: UserStatus;
  }
}
