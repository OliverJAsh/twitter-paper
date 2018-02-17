import { pipe } from 'fp-ts/lib/function';
import * as redis from 'redis';

import { EnvVar, getEnvVarUnsafe } from './helpers/env-vars';

export const redisClient = pipe(() => getEnvVarUnsafe(EnvVar.REDIS_URL), redis.createClient)({});
