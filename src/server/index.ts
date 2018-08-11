import * as luxon from 'luxon';

import * as bodyParser from 'body-parser';
import * as createRedisStore from 'connect-redis';
import * as express from 'express';
import * as session from 'express-session';
import { createServer } from 'http';

import { EnvVar, getEnvVarUnsafe } from './helpers/env-vars';
import { redisClient } from './redis-client';
import * as routes from './routes';
import { RoutePathname } from './routes-helpers';

luxon.Settings.throwOnInvalid = true;

const app = express();

// Don't parse body using middleware. Body parsing is instead handled in the request handler, where
// we can more easily handle parsing errors.
app.use(bodyParser.text({ type: 'application/json' }));

const RedisStore = createRedisStore(session);
app.use(
    session({
        store: new RedisStore({
            client: redisClient,
            logErrors: true,
        }),
        secret: getEnvVarUnsafe(EnvVar.EXPRESS_SESSION_SECRET),
        // Required options:
        resave: false,
        saveUninitialized: false,
    }),
);

app.get(RoutePathname.GetAuthIndex, routes.authIndex);
app.get(RoutePathname.GetAuthCallback, routes.authCallback);
app.get(RoutePathname.GetHome, routes.home);

const httpServer = createServer(app);

const onListen = () => {
    const address = httpServer.address();
    if (typeof address === 'string') {
        throw new Error('Expected string');
    }

    const { port } = address;

    console.log(`Server running on port ${port}`);
};

const PORT = getEnvVarUnsafe(EnvVar.PORT);
httpServer.listen(PORT, () => {
    onListen();
});
