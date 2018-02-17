import * as bodyParser from 'body-parser';
import * as createRedisStore from 'connect-redis';
import * as express from 'express';
import * as session from 'express-session';
import { createServer, Server } from 'http';

import { EnvVar, getEnvVarUnsafe } from './helpers/env-vars';
import { redisClient } from './redis-client';
import * as routes from './routes';
import { Route } from './routes-helpers';

const app = express();

// Don't parse body using middleware. Body parsing is instead handled in the request handler.
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

app.get(Route.GetAuthIndex, routes.authIndex);
app.get(Route.GetAuthCallback, routes.authCallback);
app.get(Route.GetHome, routes.home);

const onListen = (server: Server) => {
    const { port } = server.address();

    console.log(`Server running on port ${port}`);
};

const httpServer = createServer(app);
const PORT = getEnvVarUnsafe(EnvVar.PORT);
httpServer.listen(PORT, () => {
    onListen(httpServer);
});
