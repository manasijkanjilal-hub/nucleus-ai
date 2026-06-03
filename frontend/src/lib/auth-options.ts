import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Account lockout policy
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
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
            throw new Error('Account temporarily locked due to failed login attempts.');
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
          } as any;
        } catch (err: any) {
          // Re-throw explicit auth errors so NextAuth surfaces the message
          if (err?.message) throw err;
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.status = user.status;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
