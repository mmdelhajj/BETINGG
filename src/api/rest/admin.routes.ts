import { FastifyInstance } from 'fastify';
import adminRoutes from '../../modules/admin/admin.routes';

export default async function (app: FastifyInstance): Promise<void> {
  await app.register(adminRoutes);
}
