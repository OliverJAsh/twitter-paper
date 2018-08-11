import { EnvVar, getEnvVarUnsafe } from './env-vars';
import { NODE_ENV, NodeEnv } from './node-env';

const PORT = getEnvVarUnsafe(EnvVar.PORT);
export const BASE_URL = NodeEnv.match({
    Production: () => getEnvVarUnsafe(EnvVar.HEROKU_URL),
    Development: () => `http://localhost:${PORT}`,
})(NODE_ENV);
