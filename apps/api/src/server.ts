import { config } from '@/config';
import app from './app';
import { prisma } from '@/lib/prisma';

const PORT = config.port;

async function start(): Promise<void> {
  // Verify database connectivity before accepting traffic
  try {
    await prisma.$connect();
    console.log('Database connection established');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`CampusOS API running on port ${PORT} (${config.nodeEnv})`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Database connection closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
