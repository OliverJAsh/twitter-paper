import { pipe } from 'fp-ts/lib/function';
import * as option from 'fp-ts/lib/Option';

import { unsafeGet } from './fp-ts';

export enum EnvVar {
    HEROKU_URL = 'HEROKU_URL',
    NODE_ENV = 'NODE_ENV',
    PORT = 'PORT',
    REDIS_URL = 'REDIS_URL',
    TWITTER_CONSUMER_KEY = 'TWITTER_CONSUMER_KEY',
    TWITTER_CONSUMER_SECRET = 'TWITTER_CONSUMER_SECRET',
    EXPRESS_SESSION_SECRET = 'EXPRESS_SESSION_SECRET',
}

const getEnvVar = (key: EnvVar) => process.env[key];
const getEnvVarOption = pipe(
    getEnvVar,
    option.fromNullable,
);
export const getEnvVarUnsafe = pipe(
    getEnvVarOption,
    unsafeGet,
);
