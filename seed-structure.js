//file to generate folder structure

const fs = require("fs");
const path = require("path");

const structure = [
  // Root
  "apps",
  "apps/api",
  "apps/web",
  "packages",
  "packages/shared-types",
  "docs",
  ".github",
  ".github/ISSUE_TEMPLATE",
  ".github/workflows",

  // Root files
  "package.json",
  ".gitignore",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/task.md",
  ".github/workflows/ci.yml",
  "docs/FINAL_TEAM_BUILD_GUIDE.md",

  // API
  "apps/api/prisma",
  "apps/api/prisma/schema.prisma",

  "apps/api/src",
  "apps/api/src/app.ts",
  "apps/api/src/server.ts",

  // Modules
  "apps/api/src/modules/auth",
  "apps/api/src/modules/auth/routes.ts",
  "apps/api/src/modules/auth/controller.ts",
  "apps/api/src/modules/auth/service.ts",

  "apps/api/src/modules/users",
  "apps/api/src/modules/users/routes.ts",
  "apps/api/src/modules/users/controller.ts",
  "apps/api/src/modules/users/service.ts",

  "apps/api/src/modules/club-requests",
  "apps/api/src/modules/club-requests/routes.ts",
  "apps/api/src/modules/club-requests/controller.ts",
  "apps/api/src/modules/club-requests/service.ts",

  "apps/api/src/modules/clubs",
  "apps/api/src/modules/clubs/routes.ts",
  "apps/api/src/modules/clubs/controller.ts",
  "apps/api/src/modules/clubs/service.ts",

  "apps/api/src/modules/departments",
  "apps/api/src/modules/departments/routes.ts",
  "apps/api/src/modules/departments/controller.ts",
  "apps/api/src/modules/departments/service.ts",

  "apps/api/src/modules/events",
  "apps/api/src/modules/events/routes.ts",
  "apps/api/src/modules/events/controller.ts",
  "apps/api/src/modules/events/service.ts",

  "apps/api/src/modules/projects",
  "apps/api/src/modules/projects/routes.ts",
  "apps/api/src/modules/projects/controller.ts",
  "apps/api/src/modules/projects/service.ts",

  "apps/api/src/modules/blogs",
  "apps/api/src/modules/blogs/routes.ts",
  "apps/api/src/modules/blogs/controller.ts",
  "apps/api/src/modules/blogs/service.ts",

  "apps/api/src/modules/announcements",
  "apps/api/src/modules/announcements/routes.ts",
  "apps/api/src/modules/announcements/controller.ts",
  "apps/api/src/modules/announcements/service.ts",

  "apps/api/src/modules/search",
  "apps/api/src/modules/search/routes.ts",
  "apps/api/src/modules/search/controller.ts",
  "apps/api/src/modules/search/service.ts",

  // Middleware
  "apps/api/src/middleware",
  "apps/api/src/middleware/authenticate.ts",
  "apps/api/src/middleware/authorize.ts",
  "apps/api/src/middleware/authorizeClubRole.ts",
  "apps/api/src/middleware/validate.ts",
  "apps/api/src/middleware/paginate.ts",
  "apps/api/src/middleware/errorHandler.ts",

  // Lib
  "apps/api/src/lib",
  "apps/api/src/lib/prisma.ts",
  "apps/api/src/lib/jwt.ts",
  "apps/api/src/lib/password.ts",
  "apps/api/src/lib/envelope.ts",

  // Routes
  "apps/api/src/routes",
  "apps/api/src/routes/v1",
  "apps/api/src/routes/v1/index.ts",

  // Web
  "apps/web/src",
  "apps/web/src/context",
  "apps/web/src/context/AuthContext.tsx",

  "apps/web/src/lib",
  "apps/web/src/lib/api.ts",

  "apps/web/src/hooks",

  "apps/web/src/pages",
  "apps/web/src/pages/clubs",
  "apps/web/src/pages/events",
  "apps/web/src/pages/projects",
  "apps/web/src/pages/blogs",
  "apps/web/src/pages/admin",
  "apps/web/src/pages/faculty",

  "apps/web/src/components",
];

function createItem(itemPath) {
  const fullPath = path.join(process.cwd(), itemPath);

  const isFile = path.extname(itemPath) !== "";

  if (isFile) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, "");
      console.log(`📄 ${itemPath}`);
    }
  } else {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 ${itemPath}`);
    }
  }
}

structure.forEach(createItem);

console.log("\n✅ CampusOS project structure seeded successfully.");