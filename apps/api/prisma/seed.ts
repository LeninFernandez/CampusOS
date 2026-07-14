import { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ─── Cleanup (reverse dependency order) ─────────────────────────────────────
  await prisma.announcement.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.project.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.departmentMembership.deleteMany();
  await prisma.department.deleteMany();
  await prisma.clubMembership.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  console.log('🌱 Seeding database...');

  // ─── Users ───────────────────────────────────────────────────────────────────
  const [
    adminHash,
    facultyHash,
    studentHash,
  ] = await Promise.all([
    bcrypt.hash('Admin@123!', 12),
    bcrypt.hash('Faculty@123!', 12),
    bcrypt.hash('Student@123!', 12),
  ]);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Alice Admin',
      email: 'alice@campusos.edu',
      passwordHash: adminHash,
      platformRole: 'SUPER_ADMIN',
    },
  });

  const faculty1 = await prisma.user.create({
    data: {
      name: 'Dr. Bob Coordinator',
      email: 'bob@campusos.edu',
      passwordHash: facultyHash,
      platformRole: 'FACULTY_COORDINATOR',
    },
  });

  const faculty2 = await prisma.user.create({
    data: {
      name: 'Dr. Carol Advisor',
      email: 'carol@campusos.edu',
      passwordHash: facultyHash,
      platformRole: 'FACULTY_COORDINATOR',
    },
  });

  const student1 = await prisma.user.create({
    data: {
      name: 'David Lee',
      email: 'david@campusos.edu',
      passwordHash: studentHash,
      platformRole: 'STUDENT',
    },
  });

  const student2 = await prisma.user.create({
    data: {
      name: 'Eva Chen',
      email: 'eva@campusos.edu',
      passwordHash: studentHash,
      platformRole: 'STUDENT',
    },
  });

  const student3 = await prisma.user.create({
    data: {
      name: 'Frank Osei',
      email: 'frank@campusos.edu',
      passwordHash: studentHash,
      platformRole: 'STUDENT',
    },
  });

  const student4 = await prisma.user.create({
    data: {
      name: 'Grace Kim',
      email: 'grace@campusos.edu',
      passwordHash: studentHash,
      platformRole: 'STUDENT',
    },
  });

  const student5 = await prisma.user.create({
    data: {
      name: 'Henry Patel',
      email: 'henry@campusos.edu',
      passwordHash: studentHash,
      platformRole: 'STUDENT',
    },
  });

  // ─── Clubs ───────────────────────────────────────────────────────────────────
  const club1 = await prisma.club.create({
    data: {
      name: 'Robotics Club',
      description: 'Building robots and automations',
      facultyDetails: 'Dr. Bob coordinates',
      socialLinks: {
        instagram: 'https://instagram.com/roboticsclub',
        github: 'https://github.com/roboticsclub',
      },
      status: 'ACTIVE',
      facultyCoordinatorId: faculty1.id,
    },
  });

  const club2 = await prisma.club.create({
    data: {
      name: 'Web Dev Club',
      description: 'Full-stack web development',
      facultyDetails: 'Dr. Carol advises',
      socialLinks: {
        linkedin: 'https://linkedin.com/company/webdevclub',
        website: 'https://webdevclub.edu',
      },
      status: 'ACTIVE',
      facultyCoordinatorId: faculty2.id,
    },
  });

  const club3 = await prisma.club.create({
    data: {
      name: 'Data Science Club',
      description: 'Machine learning and analytics',
      facultyDetails: 'No coordinator yet',
      socialLinks: Prisma.JsonNull,
      status: 'ACTIVE',
      facultyCoordinatorId: null,
    },
  });

  // ─── Club Memberships ────────────────────────────────────────────────────────
  // club1: student1 = CLUB_HEAD, student4 = MEMBER, student5 = MEMBER
  await prisma.clubMembership.createMany({
    data: [
      { userId: student1.id, clubId: club1.id, role: 'CLUB_HEAD' },
      { userId: student4.id, clubId: club1.id, role: 'MEMBER' },
      { userId: student5.id, clubId: club1.id, role: 'MEMBER' },
    ],
  });

  // club2: student2 = CLUB_HEAD, student4 = MEMBER
  await prisma.clubMembership.createMany({
    data: [
      { userId: student2.id, clubId: club2.id, role: 'CLUB_HEAD' },
      { userId: student4.id, clubId: club2.id, role: 'MEMBER' },
    ],
  });

  // club3: student3 = CLUB_HEAD, student5 = MEMBER
  await prisma.clubMembership.createMany({
    data: [
      { userId: student3.id, clubId: club3.id, role: 'CLUB_HEAD' },
      { userId: student5.id, clubId: club3.id, role: 'MEMBER' },
    ],
  });

  // ─── Departments ─────────────────────────────────────────────────────────────
  const dept1 = await prisma.department.create({
    data: { clubId: club1.id, name: 'Hardware', headUserId: student4.id },
  });

  const dept2 = await prisma.department.create({
    data: { clubId: club1.id, name: 'Software', headUserId: student5.id },
  });

  const dept3 = await prisma.department.create({
    data: { clubId: club2.id, name: 'Frontend', headUserId: student4.id },
  });

  const dept4 = await prisma.department.create({
    data: { clubId: club2.id, name: 'Backend', headUserId: null },
  });

  const dept5 = await prisma.department.create({
    data: { clubId: club3.id, name: 'Research', headUserId: student5.id },
  });

  const dept6 = await prisma.department.create({
    data: { clubId: club3.id, name: 'Applications', headUserId: null },
  });

  // ─── Department Memberships ──────────────────────────────────────────────────
  await prisma.departmentMembership.createMany({
    data: [
      { userId: student4.id, departmentId: dept1.id },
      { userId: student5.id, departmentId: dept2.id },
      { userId: student4.id, departmentId: dept3.id },
      { userId: student5.id, departmentId: dept5.id },
    ],
  });

  // ─── Events ──────────────────────────────────────────────────────────────────
  const event1 = await prisma.event.create({
    data: {
      clubId: club1.id,
      title: 'Robotics Hackathon 2026',
      description: 'A full-day hackathon where teams compete to build the most innovative robot.',
      location: 'Engineering Building, Room 101',
      type: 'PUBLIC',
      capacity: 50,
      startTime: new Date('2026-09-01T09:00:00Z'),
      endTime: new Date('2026-09-01T18:00:00Z'),
      status: 'APPROVED',
      requestedById: student1.id,
      reviewedById: superAdmin.id,
    },
  });

  await prisma.event.create({
    data: {
      clubId: club1.id,
      title: 'Robot Showcase Night',
      description: 'Members showcase their latest robot builds in an exclusive club event.',
      location: 'Robotics Lab, Room 204',
      type: 'CLUB_EXCLUSIVE',
      capacity: 30,
      startTime: new Date('2026-09-15T18:00:00Z'),
      endTime: new Date('2026-09-15T21:00:00Z'),
      status: 'APPROVED',
      requestedById: student1.id,
      reviewedById: superAdmin.id,
    },
  });

  const event3 = await prisma.event.create({
    data: {
      clubId: club2.id,
      title: 'Web Summit Workshop',
      description: 'A hands-on workshop covering the latest web development technologies and best practices.',
      location: 'Computer Science Building, Auditorium A',
      type: 'PUBLIC',
      capacity: 100,
      startTime: new Date('2026-09-10T10:00:00Z'),
      endTime: new Date('2026-09-10T16:00:00Z'),
      status: 'APPROVED',
      requestedById: student2.id,
      reviewedById: superAdmin.id,
    },
  });

  await prisma.event.create({
    data: {
      clubId: club2.id,
      title: 'Members-Only Code Sprint',
      description: 'An intensive coding sprint exclusively for Web Dev Club members to work on club projects.',
      location: 'Computer Lab 3, Floor 2',
      type: 'CLUB_EXCLUSIVE',
      capacity: null,
      startTime: new Date('2026-09-20T09:00:00Z'),
      endTime: new Date('2026-09-20T17:00:00Z'),
      status: 'APPROVED',
      requestedById: student2.id,
      reviewedById: superAdmin.id,
    },
  });

  await prisma.event.create({
    data: {
      clubId: club3.id,
      title: 'Data Science Symposium',
      description: 'A full-day symposium featuring talks, workshops, and demos on machine learning and data analytics.',
      location: 'Science Hall, Main Auditorium',
      type: 'PUBLIC',
      capacity: 80,
      startTime: new Date('2026-09-25T09:00:00Z'),
      endTime: new Date('2026-09-25T17:00:00Z'),
      status: 'APPROVED',
      requestedById: student3.id,
      reviewedById: superAdmin.id,
    },
  });

  // ─── Event Registrations ─────────────────────────────────────────────────────
  await prisma.eventRegistration.createMany({
    data: [
      { eventId: event1.id, userId: student4.id },
      { eventId: event1.id, userId: student5.id },
      { eventId: event3.id, userId: student4.id },
      { eventId: event3.id, userId: student1.id },
    ],
  });

  // ─── Projects ────────────────────────────────────────────────────────────────
  // club1 projects
  await prisma.project.createMany({
    data: [
      {
        clubId: club1.id,
        title: 'AutoNav Robot',
        description: 'Autonomous navigation system',
        techStack: ['C++', 'ROS'],
        githubLink: 'https://github.com/roboticsclub/autonav',
        contributors: ['David Lee', 'Grace Kim'],
        status: 'IN_PROGRESS',
        createdById: student1.id,
      },
      {
        clubId: club1.id,
        title: 'Arm Controller',
        description: 'Robotic arm control interface',
        techStack: ['Python', 'Arduino'],
        contributors: ['David Lee'],
        status: 'COMPLETED',
        createdById: student1.id,
      },
      {
        clubId: club1.id,
        title: 'Vision System',
        description: 'Computer vision pipeline',
        techStack: ['Python', 'OpenCV'],
        contributors: ['Grace Kim'],
        status: 'IN_PROGRESS',
        createdById: student1.id,
      },
    ],
  });

  // club2 projects
  await prisma.project.createMany({
    data: [
      {
        clubId: club2.id,
        title: 'CampusOS Frontend',
        description: 'React frontend for CampusOS',
        techStack: ['React', 'TypeScript'],
        githubLink: 'https://github.com/webdevclub/campusos-fe',
        contributors: ['Eva Chen', 'Grace Kim'],
        status: 'IN_PROGRESS',
        createdById: student2.id,
      },
      {
        clubId: club2.id,
        title: 'API Gateway',
        description: 'REST API gateway service',
        techStack: ['Node.js', 'Express'],
        githubLink: 'https://github.com/webdevclub/api-gateway',
        contributors: ['Eva Chen'],
        status: 'IN_PROGRESS',
        createdById: student2.id,
      },
      {
        clubId: club2.id,
        title: 'Design System',
        description: 'Shared UI component library',
        techStack: ['React', 'Storybook'],
        contributors: [],
        status: 'ARCHIVED',
        createdById: student2.id,
      },
    ],
  });

  // club3 projects
  await prisma.project.createMany({
    data: [
      {
        clubId: club3.id,
        title: 'Sentiment Analyzer',
        description: 'NLP sentiment analysis tool',
        techStack: ['Python', 'PyTorch'],
        githubLink: 'https://github.com/datasciclub/sentiment',
        contributors: ['Frank Osei', 'Henry Patel'],
        status: 'IN_PROGRESS',
        createdById: student3.id,
      },
      {
        clubId: club3.id,
        title: 'Campus Data Dashboard',
        description: 'Analytics dashboard for campus data',
        techStack: ['Python', 'Dash'],
        contributors: ['Henry Patel'],
        status: 'IN_PROGRESS',
        createdById: student3.id,
      },
      {
        clubId: club3.id,
        title: 'Recommendation Engine',
        description: 'Course recommendation system',
        techStack: ['Python', 'scikit-learn'],
        contributors: ['Frank Osei'],
        status: 'COMPLETED',
        createdById: student3.id,
      },
    ],
  });

  // ─── Blogs ───────────────────────────────────────────────────────────────────
  const now = new Date();

  // club1 blogs
  await prisma.blog.createMany({
    data: [
      {
        clubId: club1.id,
        title: 'How We Built Our First Autonomous Robot',
        content: 'This semester, our team took on the challenge of building an autonomous robot from scratch. From sensor integration to motor control, here is every step of our journey and what we learned along the way.',
        authorId: student1.id,
        tags: ['robotics', 'hardware', 'build-log'],
        publishedAt: now,
      },
      {
        clubId: club1.id,
        title: 'Top 5 ROS Packages Every Robotics Club Should Know',
        content: 'After months of experimentation, here are the ROS packages that changed our workflow. Whether you are just getting started or looking to level up your robotics stack, these tools are essential.',
        authorId: student1.id,
        tags: ['ros', 'robotics', 'tips'],
        publishedAt: now,
      },
      {
        clubId: club1.id,
        title: 'Robotics Hackathon 2026 Recap',
        content: 'The Robotics Hackathon 2026 was an incredible experience. Here\'s what went down: teams competed over eight hours to build the most creative and functional robot, and the results were outstanding.',
        authorId: student1.id,
        tags: ['hackathon', 'robotics', 'recap'],
        publishedAt: now,
      },
    ],
  });

  // club2 blogs
  await prisma.blog.createMany({
    data: [
      {
        clubId: club2.id,
        title: 'Building CampusOS: Our Tech Stack Decisions',
        content: 'When we started building CampusOS, we had to make some tough tech stack decisions. This post walks through our reasoning behind choosing TypeScript, Express, and PostgreSQL.',
        authorId: student2.id,
        tags: ['web-dev', 'typescript', 'architecture'],
        publishedAt: now,
      },
      {
        clubId: club2.id,
        title: 'Why We Chose React for the CampusOS Frontend',
        content: 'React vs Vue was a heated debate in our club. Here\'s why React won: ecosystem size, TypeScript support, and the team\'s existing familiarity all played major roles in the decision.',
        authorId: student2.id,
        tags: ['react', 'frontend', 'web-dev'],
        publishedAt: now,
      },
      {
        clubId: club2.id,
        title: 'REST API Design Lessons from CampusOS',
        content: 'After building over 50 endpoints for CampusOS, here are our key takeaways on REST API design: consistent error envelopes, proper status codes, and clear resource naming make a huge difference.',
        authorId: student2.id,
        tags: ['api', 'backend', 'lessons'],
        publishedAt: now,
      },
    ],
  });

  // club3 blogs
  await prisma.blog.createMany({
    data: [
      {
        clubId: club3.id,
        title: 'Getting Started with PyTorch for NLP',
        content: 'Natural language processing has never been more accessible. In this post we walk through setting up a PyTorch environment, loading a dataset, and training your first text classifier step by step.',
        authorId: student3.id,
        tags: ['python', 'pytorch', 'nlp'],
        publishedAt: now,
      },
      {
        clubId: club3.id,
        title: 'Our Campus Data Dashboard Journey',
        content: 'Turning raw campus data into actionable insights took us three months. Here\'s the full story: data collection challenges, visualization choices, and the lessons we learned building with Python Dash.',
        authorId: student3.id,
        tags: ['data-science', 'dashboard', 'python'],
        publishedAt: now,
      },
      {
        clubId: club3.id,
        title: 'Building a Recommendation Engine from Scratch',
        content: 'Recommendation systems power some of the biggest platforms in the world. We built one for campus using scikit-learn and collaborative filtering. Here is everything you need to replicate our approach.',
        authorId: student3.id,
        tags: ['ml', 'python', 'recommendation'],
        publishedAt: now,
      },
    ],
  });

  // ─── Announcements ───────────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Welcome to CampusOS!',
        content: 'We are excited to launch CampusOS, the all-in-one platform for campus clubs and events. Explore clubs, join events, and collaborate with your peers all in one place.',
        visibility: 'GLOBAL',
        createdById: superAdmin.id,
        clubId: null,
        departmentId: null,
      },
      {
        title: 'Platform Maintenance Notice',
        content: 'CampusOS will undergo scheduled maintenance on August 31, 2026 from 2–4 AM UTC. During this window the platform will be unavailable. We apologize for any inconvenience.',
        visibility: 'GLOBAL',
        createdById: superAdmin.id,
        clubId: null,
        departmentId: null,
      },
      {
        title: 'Robotics Club General Meeting',
        content: 'All Robotics Club members: our next general meeting is on August 15 at 6 PM in Lab 204. Attendance is strongly encouraged as we will be planning the semester roadmap.',
        visibility: 'CLUB',
        createdById: student1.id,
        clubId: club1.id,
        departmentId: null,
      },
      {
        title: 'Web Dev Club Sprint Kickoff',
        content: 'Web Dev Club members, our next two-week sprint starts Monday. Please review the issue tracker and claim your tasks before the kickoff meeting at 5 PM on Monday.',
        visibility: 'CLUB',
        createdById: student2.id,
        clubId: club2.id,
        departmentId: null,
      },
      {
        title: 'Hardware Team Update',
        content: 'Hardware department: the new soldering stations have arrived. Please sign up for a training slot by Friday so we can get everyone certified before the hackathon.',
        visibility: 'DEPARTMENT',
        createdById: student4.id,
        clubId: club1.id,
        departmentId: dept1.id,
      },
    ],
  });

  console.log('✅ Database seeded successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
