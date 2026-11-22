import { createApp } from '#src/app.js';
import { serverDependenciesFromEnv } from '#src/server-dependencies.js';

const { dependencies, port } = serverDependenciesFromEnv();

createApp({ ...dependencies, clock: { now: () => new Date() } }).listen(port, () => {
  dependencies.logger.info({ port }, 'API listening');
});
