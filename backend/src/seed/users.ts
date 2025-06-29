import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/crypto';
import { logger } from '../utils/logger';

const seedUsers = [
  { username: 'Legolas', password: 'Thranduil' },
  { username: 'Aragorn', password: 'Aravir' },
  { username: 'Gimli', password: 'Gloin' },
  { username: 'Gandalf', password: 'White Rider' },
  { username: 'Frodo', password: 'Elf-friend' },
  { username: 'Samwise', password: 'Shire' },
  { username: 'Boromir', password: 'Gondor' },
  { username: 'Elrond', password: 'Rivendell' },
  { username: 'Galadriel', password: 'Noldor' },
  { username: 'Sauron', password: 'Dark Lord' },
];

export const seedDatabase = async () => {
  const prisma = new PrismaClient();

  try {
    // Check if users already exist
    const existingUsers = await prisma.user.findMany({
      where: {
        username: {
          in: seedUsers.map(u => u.username),
        },
      },
    });

    if (existingUsers.length === seedUsers.length) {
      logger.info('Seed users already exist, skipping seeding');
      return;
    }

    // Create missing users
    const existingUsernames = new Set(existingUsers.map(u => u.username));
    const usersToCreate = seedUsers.filter(u => !existingUsernames.has(u.username));

    for (const user of usersToCreate) {
      await prisma.user.create({
        data: {
          username: user.username,
          password: hashPassword(user.password),
        },
      });
      logger.info(`Created user: ${user.username}`);
    }

    logger.info('Database seeding completed');
  } catch (error: any) {
    logger.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};
