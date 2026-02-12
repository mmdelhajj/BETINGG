import { FastifyInstance } from 'fastify';
import { publicApiV1Routes } from './v1.routes';

export default async function (app: FastifyInstance): Promise<void> {
  await app.register(publicApiV1Routes);
}
