import { ofType, unionize } from 'unionize';

import { EnvVar } from './env-vars';

export const NodeEnv = unionize({
    Production: ofType<{}>(),
    Development: ofType<{}>(),
});
export type NodeEnv = typeof NodeEnv._Union;

const NODE_ENV_PRODUCTION = 'production';
const NODE_ENV_DEVELOPMENT = 'development';

const getNodeEnvFromEnvVars = (envVars: NodeJS.ProcessEnv): NodeEnv => {
    switch (envVars[EnvVar.NODE_ENV]) {
        case NODE_ENV_PRODUCTION:
            return NodeEnv.Production({});
        case NODE_ENV_DEVELOPMENT:
            return NodeEnv.Development({});
        default:
            throw new Error('Invalid');
    }
};

export const NODE_ENV = getNodeEnvFromEnvVars(process.env);
