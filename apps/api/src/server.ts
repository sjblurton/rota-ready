import { createApp } from './app.js';
import { createDb } from './db.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const port = Number(process.env.PORT ?? 3000);

createApp({ db: createDb(databaseUrl) }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
