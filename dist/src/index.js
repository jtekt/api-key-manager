import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth.js';
import keysRouter from './routes/keys.js';
import validateRouter from './routes/validate.js';
const app = new Hono();
app.use('/keys/*', authMiddleware);
app.route('/keys', keysRouter);
app.route('/validate', validateRouter);
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
    console.log(`Server running on port ${info.port}`);
});
