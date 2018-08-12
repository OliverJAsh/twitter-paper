import { SafeRequestHandler, SafeRequestHandlerAsync, wrapAsync } from 'express-fp';
import { Ok, TemporaryRedirect } from 'express-result-types/target/result';
import * as apply from 'fp-ts/lib/Apply';
import * as either from 'fp-ts/lib/Either';
import * as taskEither from 'fp-ts/lib/TaskEither';
import { INTERNAL_SERVER_ERROR } from 'http-status-codes';
import * as luxon from 'luxon';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';

import { setUserTwitterCredentials } from './helpers/redis';
import { twitterApiOAuthAuthenticateUrl } from './helpers/twitter-api';
import { addQueryToUrl } from './helpers/url';
import { getLatestPublication, getPublicationDateForTimeZone } from './publication';
import { renderPublication } from './response-views';
import {
    createFetchHomeTimelineFn,
    errorResponseToResult,
    fetchAccountSettings,
    getAccessToken,
    getAuthCallbackQuery,
    getRequestToken,
    getTwitterUserCredentialsFromReq,
    getUserTimeZone,
    htmlValueWriteable,
    RoutePathname,
    SessionKeys,
} from './routes-helpers';
import { createTimelineResponsesIterable } from './timeline-responses-iterable';
import { OrErrorResponse, UserTwitterCredentialsT } from './types';
import { ErrorResponse } from './types/error-response';

import TaskEither = taskEither.TaskEither;

export const authIndex = wrapAsync(() =>
    new TaskEither(getRequestToken)
        .mapLeft(twitterApiErrorResponse =>
            ErrorResponse.TwitterApi({ errorResponse: twitterApiErrorResponse }),
        )
        .map(
            (twitterApiRequestTokenResponse): OrErrorResponse<string> => {
                if (twitterApiRequestTokenResponse.oauth_callback_confirmed === 'true') {
                    const query: TwitterApiTypes.OAuthAuthenticateEndpointQuery = {
                        oauth_token: twitterApiRequestTokenResponse.oauth_token,
                    };
                    const redirectUrl = addQueryToUrl(query)(twitterApiOAuthAuthenticateUrl);
                    return either.right(redirectUrl);
                } else {
                    return either.left(
                        ErrorResponse.Simple({
                            statusCode: INTERNAL_SERVER_ERROR,
                            message: `Expected 'oauth_callback_confirmed' to be 'true'`,
                        }),
                    );
                }
            },
        )
        .chain(taskEither.fromEither)
        .fold(errorResponseToResult, TemporaryRedirect)
        .run(),
);

export const authCallback = wrapAsync(req => {
    const maybeQuery = getAuthCallbackQuery(req);

    return (
        taskEither
            .fromEither(maybeQuery)
            .chain(query =>
                new TaskEither(getAccessToken(query)).mapLeft(twitterApiErrorResponse =>
                    ErrorResponse.TwitterApi({ errorResponse: twitterApiErrorResponse }),
                ),
            )
            // Run side effect
            .chain(twitterApiAccessTokenResponse =>
                taskEither.right(
                    setUserTwitterCredentials(twitterApiAccessTokenResponse.user_id)({
                        oauthAccessToken: twitterApiAccessTokenResponse.oauth_token,
                        oauthAccessTokenSecret: twitterApiAccessTokenResponse.oauth_token_secret,
                    }).map(() => twitterApiAccessTokenResponse),
                ),
            )
            .fold(errorResponseToResult, twitterApiAccessTokenResponse =>
                TemporaryRedirect('/').withSession(
                    new Map([[SessionKeys.TwitterUserId, twitterApiAccessTokenResponse.user_id]]),
                ),
            )
            .run()
    );
});

const homeUnauthenticated: SafeRequestHandler = () =>
    Ok.apply(
        `Not authenticated. <a href="${RoutePathname.GetAuthIndex}">Log in</a>.`,
        htmlValueWriteable,
    );

const homeAuthenticated: SafeRequestHandlerAsync = req => {
    const credentialsM = getTwitterUserCredentialsFromReq(req);

    const accountSettingsM = credentialsM.chain(credentials =>
        new TaskEither(fetchAccountSettings(credentials)).mapLeft(twitterApiErrorResponse =>
            ErrorResponse.TwitterApi({ errorResponse: twitterApiErrorResponse }),
        ),
    );

    const timeZoneM = accountSettingsM.map(getUserTimeZone).chain(taskEither.fromEither);

    // prettier-ignore
    return apply.liftA2(taskEither.taskEither)(
        (credentials: UserTwitterCredentialsT) => (timeZone: luxon.IANAZone) => ({ credentials, timeZone })
    )
        (credentialsM)
        (timeZoneM)
        .chain(({ credentials, timeZone }) => {
            const fetchFn = createFetchHomeTimelineFn(credentials);
            const responsesIterable = createTimelineResponsesIterable(fetchFn);
            const nowDate = luxon.DateTime.utc();
            const publicationDate = getPublicationDateForTimeZone(nowDate)(timeZone);
            return getLatestPublication({ responsesIterable, publicationDate }).map(publication => ({ timeZone, publication, publicationDate }))
        })
        .fold(errorResponseToResult, ({ timeZone, publication, publicationDate }) => {
            console.log(publication.warning);
            return Ok.apply(renderPublication(publication)(timeZone)(publicationDate), htmlValueWriteable);
        })
        .run();
};

export const home = wrapAsync(req =>
    req.session
        .get(SessionKeys.TwitterUserId)
        .foldL(() => Promise.resolve(homeUnauthenticated(req)), () => homeAuthenticated(req)),
);
