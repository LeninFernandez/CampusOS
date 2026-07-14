import { prisma } from '@/lib/prisma';
import { RequestStatus } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { SubmitRequestInput, ApproveRequestInput, RejectRequestInput } from './schemas';

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const clubRequestsService = {
  async submitRequest(callerId: string, input: SubmitRequestInput) {
    const request = await prisma.clubCreationRequest.create({
      data: {
        clubName: input.clubName,
        description: input.description,
        facultyDetails: input.facultyDetails,
        reason: input.reason,
        requestedById: callerId,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    });
    return request;
  },

  async listRequests(params: {
    status?: RequestStatus;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<unknown>> {
    const { status, page, limit } = params;
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.clubCreationRequest.findMany({
        where,
        select: {
          id: true,
          clubName: true,
          description: true,
          facultyDetails: true,
          reason: true,
          requestedById: true,
          status: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clubCreationRequest.count({ where }),
    ]);

    // Map requestedById → requestedBy for API contract
    const items = rawItems.map((r) => ({
      id: r.id,
      clubName: r.clubName,
      description: r.description,
      facultyDetails: r.facultyDetails,
      reason: r.reason,
      requestedBy: r.requestedById,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getRequest(requestId: string, callerId: string, callerIsSuperAdmin: boolean) {
    const request = await prisma.clubCreationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        clubName: true,
        description: true,
        facultyDetails: true,
        reason: true,
        requestedById: true,
        status: true,
        reviewedById: true,
        rejectionReason: true,
        createdAt: true,
      },
    });

    if (!request) {
      throw new NotFoundError('Club request not found');
    }

    if (!callerIsSuperAdmin && request.requestedById !== callerId) {
      throw new ForbiddenError('Access denied');
    }

    return {
      id: request.id,
      clubName: request.clubName,
      description: request.description,
      facultyDetails: request.facultyDetails,
      reason: request.reason,
      requestedBy: request.requestedById,
      status: request.status,
      reviewedBy: request.reviewedById,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
    };
  },

  async approveRequest(
    requestId: string,
    callerId: string,
    input: ApproveRequestInput,
  ) {
    const { facultyCoordinatorId } = input;

    // 1. Fetch request
    const request = await prisma.clubCreationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        clubName: true,
        description: true,
        facultyDetails: true,
        requestedById: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundError('Club request not found');
    }

    // 2. Status guard
    if (request.status !== 'PENDING') {
      throw new BadRequestError('Only pending requests can be approved');
    }

    // 3. Duplicate club name check (case-insensitive)
    const duplicateName = await prisma.club.findFirst({
      where: { name: { equals: request.clubName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicateName) {
      throw new ConflictError('Club name already exists');
    }

    // 4. Faculty coordinator uniqueness check
    const existingCoordinator = await prisma.club.findFirst({
      where: { facultyCoordinatorId },
      select: { id: true },
    });
    if (existingCoordinator) {
      throw new ConflictError('Faculty Coordinator already assigned to another club');
    }

    // 5. Atomic transaction: create club + membership + update request
    const clubId = await prisma.$transaction(async (tx) => {
      const newClub = await tx.club.create({
        data: {
          name: request.clubName,
          description: request.description,
          facultyDetails: request.facultyDetails,
          status: 'ACTIVE',
          facultyCoordinatorId,
        },
        select: { id: true },
      });

      await tx.clubMembership.create({
        data: {
          userId: request.requestedById,
          clubId: newClub.id,
          role: 'CLUB_HEAD',
        },
      });

      await tx.clubCreationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById: callerId,
        },
      });

      return newClub.id;
    });

    return {
      clubId,
      requestId,
      status: 'APPROVED' as const,
    };
  },

  async rejectRequest(
    requestId: string,
    callerId: string,
    input: RejectRequestInput,
  ) {
    // 1. Fetch request
    const request = await prisma.clubCreationRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });

    if (!request) {
      throw new NotFoundError('Club request not found');
    }

    // 2. Status guard
    if (request.status !== 'PENDING') {
      throw new BadRequestError('Only pending requests can be rejected');
    }

    // 3. Update
    await prisma.clubCreationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: callerId,
        rejectionReason: input.reason ?? null,
      },
    });

    return { id: requestId, status: 'REJECTED' as const };
  },

  async withdrawRequest(requestId: string, callerId: string) {
    // 1. Fetch request
    const request = await prisma.clubCreationRequest.findUnique({
      where: { id: requestId },
      select: { id: true, requestedById: true, status: true },
    });

    if (!request) {
      throw new NotFoundError('Club request not found');
    }

    // 2. Ownership check
    if (request.requestedById !== callerId) {
      throw new ForbiddenError('You can only withdraw your own requests');
    }

    // 3. Status guard
    if (request.status !== 'PENDING') {
      throw new BadRequestError('Only pending requests can be withdrawn');
    }

    // 4. Hard delete
    await prisma.clubCreationRequest.delete({ where: { id: requestId } });
  },
};
