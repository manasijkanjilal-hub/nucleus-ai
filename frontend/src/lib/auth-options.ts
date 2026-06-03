import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Account lockout policy
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          });
          if (!user) return null;

          // Block suspended accounts
          if (user.status === 'SUSPENDED') {
            throw new Error('Account suspended. Contact an administrator.');
          }

          // Enforce account lockout
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new Error(
              `Account locked due to too many failed login attempts. Try again in ${minsLeft} minute(s).`
            );
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            // Increment failed attempts, lock if threshold reached
            const attempts = user.loginAttempts + 1;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                loginAttempts: attempts,
                lockedUntil:
                  attempts >= MAX_LOGIN_ATTEMPTS
                    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                    : null,
              },
            });
            return null;
          }

          // Successful login — reset counters & record timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLogin: new Date(),
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified,
            sessionVersion: user.sessionVersion,
            rememberMe: credentials.rememberMe === 'true',
          } as any;
        } catch (err: any) {
          // Re-throw explicit auth errors so NextAuth surfaces the message
          if (err?.message) throw err;
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // Default session lifetime (30 days). Remember-Me uses the full window;
    // non-remembered sessions are clamped to 1 day in the jwt callback.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      // Initial sign-in: persist user fields onto the token.
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.status = user.status;
        token.emailVerified = user.emailVerified;
        token.sessionVersion = user.sessionVersion ?? 0;
        token.rememberMe = !!user.rememberMe;
        // Clamp non-remembered sessions to 1 day.
        const now = Math.floor(Date.now() / 1000);
        token.exp = user.rememberMe ? now + 30 * 24 * 60 * 60 : now + 24 * 60 * 60;
        return token;
      }

      // Subsequent requests: validate the session version against the DB so
      // "logout from all devices" can invalidate previously issued tokens.
      if (token?.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { sessionVersion: true, role: true, status: true, emailVerified: true },
          });
          if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) {
            // Invalidate the token.
            return {};
          }
          // Keep role/status/emailVerified fresh.
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.emailVerified = dbUser.emailVerified;
        } catch {
          // On DB errors, keep the existing token (fail-open for availability).
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session?.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.emailVerified = token.emailVerified as boolean;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
