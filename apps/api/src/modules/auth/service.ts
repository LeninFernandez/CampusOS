import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import { hashPassword, comparePassword } from '@/lib/password';
import { ConflictError, UnauthorizedError, NotFoundError } from '@/lib/errors';
import type { RegisterInput, LoginInput } from './schemas';

// Shape returned by register and login
interface AuthUserBase {
  id: string;
  name: string;
  email: string;
  platformRole: string;
}

interface AuthResponse {
  user: AuthUserBase;
  token: string;
}

// Shape returned by getCurrentUser
interface ClubMembershipResult {
  clubId: string;
  clubName: string;
  role: string;
  department: { id: string; name: string } | null;
}

interface CurrentUserResult {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  clubMemberships: ClubMembershipResult[];
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    // 1. Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // 2. Hash password — never store plain text
    const passwordHash = await hashPassword(input.password);

    // 3. Create user (platformRole defaults to STUDENT in schema, set explicitly)
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        platformRole: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
      },
    });

    // 4. Sign token
    const token = signToken({ userId: user.id });

    return { user, token };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    // 1. Find user — generic error message regardless of which field is wrong
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        platformRole: true,
      },
    });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Verify password
    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Sign token
    const token = signToken({ userId: user.id });

    // Return without exposing passwordHash
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
      },
      token,
    };
  },

  async getCurrentUser(userId: string): Promise<CurrentUserResult> {
    // Fetch user with club memberships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        clubMemberships: {
          select: {
            clubId: true,
            role: true,
            club: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // For each club membership, resolve the user's department (if any) in that club.
    // ClubMembership has no direct departmentId — derive via DepartmentMembership.
    const memberships: ClubMembershipResult[] = await Promise.all(
      user.clubMemberships.map(async (m: { clubId: string; role: string; club: { name: string } }) => {
        const deptMembership = await prisma.departmentMembership.findFirst({
          where: {
            userId,
            department: { clubId: m.clubId },
          },
          select: {
            department: {
              select: { id: true, name: true },
            },
          },
        });

        return {
          clubId: m.clubId,
          clubName: m.club.name,
          role: m.role,
          department: deptMembership?.department ?? null,
        };
      }),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      clubMemberships: memberships,
    };
  },
};
