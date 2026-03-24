import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Seed admin user
  const existingAdmin = await prisma.user.findFirst({
    where: { username: 'admin', isDeleted: false },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', SALT_ROUNDS);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
        isDeleted: false,
      },
    });
    console.log('Admin user created: username=admin, password=admin');
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // Seed default platforms
  const platforms = [
    { slug: 'shopee',    name: 'Shopee',                feePercent: 3.0,  isCustomizable: false, sortOrder: 1 },
    { slug: 'lazada',    name: 'Lazada',                feePercent: 2.0,  isCustomizable: false, sortOrder: 2 },
    { slug: 'tiktok',   name: 'TikTok Shop',            feePercent: 5.0,  isCustomizable: false, sortOrder: 3 },
    { slug: 'facebook',  name: 'Facebook Marketplace',  feePercent: 0.0,  isCustomizable: false, sortOrder: 4 },
    { slug: 'carousell', name: 'Carousell',             feePercent: 0.0,  isCustomizable: false, sortOrder: 5 },
    { slug: 'direct',    name: 'Direct/Walk-in',        feePercent: 0.0,  isCustomizable: false, sortOrder: 6 },
    { slug: 'custom',    name: 'Custom',                feePercent: 0.0,  isCustomizable: true,  sortOrder: 7 },
  ];

  for (const platform of platforms) {
    const existing = await prisma.platform.findUnique({ where: { slug: platform.slug } });
    if (!existing) {
      await prisma.platform.create({
        data: {
          ...platform,
          isActive: true,
          isDeleted: false,
        },
      });
      console.log(`Platform created: ${platform.name}`);
    } else {
      console.log(`Platform already exists: ${platform.name}, skipping.`);
    }
  }

  // Seed default product presets
  const presets = [
    { name: 'Booster Pack',          sortOrder: 1 },
    { name: 'Booster Box',           sortOrder: 2 },
    { name: 'Single Card (Common)',   sortOrder: 3 },
    { name: 'Single Card (Rare)',     sortOrder: 4 },
    { name: 'Single Card (SR/UR)',    sortOrder: 5 },
    { name: 'Starter Deck',          sortOrder: 6 },
    { name: 'Structure Deck',        sortOrder: 7 },
    { name: 'Sealed Product',        sortOrder: 8 },
    { name: 'Promo Card',            sortOrder: 9 },
    { name: 'Accessory',             sortOrder: 10 },
  ];

  for (const preset of presets) {
    const existing = await prisma.productPreset.findFirst({
      where: { name: preset.name, isDeleted: false },
    });
    if (!existing) {
      await prisma.productPreset.create({
        data: { ...preset, isDeleted: false },
      });
      console.log(`Product preset created: ${preset.name}`);
    } else {
      console.log(`Product preset already exists: ${preset.name}, skipping.`);
    }
  }

  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
