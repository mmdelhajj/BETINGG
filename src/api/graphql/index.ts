import { FastifyInstance } from 'fastify';
import mercurius from 'mercurius';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { prisma } from '../../lib/prisma';

export async function setupGraphQL(app: FastifyInstance) {
  await app.register(mercurius, {
    schema: typeDefs,
    resolvers,
    graphiql: process.env.NODE_ENV !== 'production',
    subscription: true,
    context: async (req: any) => {
      // Extract user from JWT or API key
      let userId: string | null = null;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const jwt = await import('jsonwebtoken');
          const token = authHeader.slice(7);
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'secret') as any;
          userId = decoded.userId;
        } catch {}
      }

      const apiKey = req.headers['x-api-key'];
      if (!userId && apiKey) {
        const user = await prisma.user.findFirst({ where: { apiKeys: { some: { key: apiKey as string } } } });
        if (user) userId = user.id;
      }

      return { userId };
    },
  });
}
