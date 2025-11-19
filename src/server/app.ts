import fastify, { FastifyInstance } from 'fastify';
import { DomainError } from '../core/DomainError';
import { chatRoutes } from '../modules/chat/interface/http/chatRoutes';
import { subscriptionRoutes } from '../modules/subscriptions/interface/http/subscriptionRoutes';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: true,
  });

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      let statusCode = 500;

      if (error.code === 'QUOTA_EXCEEDED') {
        statusCode = 429;
      } else if (error.code === 'VALIDATION') {
        statusCode = 400;
      } else if (error.code.includes('NOT_FOUND')) {
        statusCode = 404;
      }

      return reply.status(statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Fallback for unexpected errors
    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  // Root route for browsers
  app.get('/', async (_, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>GGI Backend API</title>
        </head>
        <body>
          <h1>GGI Backend API</h1>
          <p>The backend is running.</p>
          <ul>
            <li><code>GET /chat/health</code></li>
            <li><code>GET /subscriptions/health</code></li>
            <li><code>GET /health</code></li>
          </ul>
        </body>
      </html>
    `);
  });

  // Global health route
  app.get('/health', async () => {
    return { status: 'ok', service: 'api' };
  });

  // Module routes
  app.register(chatRoutes, { prefix: '/chat' });
  app.register(subscriptionRoutes, { prefix: '/subscriptions' });

  // Legacy health routes for individual modules
  app.get('/chat/health', async () => {
    return { status: 'ok', service: 'chat' };
  });

  app.get('/subscriptions/health', async () => {
    return { status: 'ok', service: 'subscriptions' };
  });

  return app;
}
