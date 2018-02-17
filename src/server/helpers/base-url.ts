import { EnvVar, getEnvVarUnsafe } from './env-vars';
import { getNodeEnvFromEnvVars, NodeEnv } from './node-env';

const nodeEnv = getNodeEnvFromEnvVars(process.env);
const PORT = getEnvVarUnsafe(EnvVar.PORT);
export const BASE_URL = NodeEnv.match({
    Production: () => getEnvVarUnsafe(EnvVar.HEROKU_URL),
    Development: () => `http://localhost:${PORT}`,
})(nodeEnv);
