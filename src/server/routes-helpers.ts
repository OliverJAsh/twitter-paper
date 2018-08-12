import { SafeRequest } from 'express-fp';
import { Status, Writeable } from 'express-result-types/target/result';
import { liftA2 } from 'fp-ts/lib/Apply';
import * as either from 'fp-ts/lib/Either';
import * as option from 'fp-ts/lib/Option';
import * as taskEither from 'fp-ts/lib/TaskEither';
import {
    BAD_REQUEST,
    FORBIDDEN,
    INTERNAL_SERVER_ERROR,
    TOO_MANY_REQUESTS,
} from 'http-status-codes';
import * as t from 'io-ts';
import * as luxon from 'luxon';
import * as TwitterApi from 'twitter-api-ts';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';
import * as url from 'url';

import { BASE_URL } from './helpers/base-url';
import { EnvVar, getEnvVarUnsafe } from './helpers/env-vars';
import { getUserTwitterCredentialsFromId } from './helpers/redis';
import {
    isTwitterApiErrorResponseRateLimitExceeded,
    MAX_TIMELINE_COUNT,
} from './helpers/twitter-api';
import { renderErrorResponse } from './response-views';
import { FetchFn } from './timeline-responses-iterable';
import { OrErrorResponse, OrErrorResponseAsync, UserTwitterCredentialsT } from './types';
import * as ErrorResponses from './types/error-response';

import Option = option.Option;
import TaskEither = taskEither.TaskEither;
import ErrorResponse = ErrorResponses.ErrorResponse;

export enum RoutePathname {
    GetAuthIndex = '/auth',
    GetAuthCallback = '/auth/callback',
    GetHome = '/',
}

const TWITTER_CONSUMER_SECRET = getEnvVarUnsafe(EnvVar.TWITTER_CONSUMER_SECRET);
const TWITTER_CONSUMER_KEY = getEnvVarUnsafe(EnvVar.TWITTER_CONSUMER_KEY);

const TWITTER_CALLBACK_URL = url.resolve(BASE_URL, RoutePathname.GetAuthCallback);

export const createFetchHomeTimelineFn = (credentials: UserTwitterCredentialsT): FetchFn => (
    maybeMaxId: Option<string>,
) =>
    TwitterApi.fetchHomeTimeline({
        oAuth: {
            consumerKey: TWITTER_CONSUMER_KEY,
            consumerSecret: TWITTER_CONSUMER_SECRET,
            token: option.some(credentials.oauthAccessToken),
            tokenSecret: option.some(credentials.oauthAccessTokenSecret),
        },
        query: {
            count: option.some(MAX_TIMELINE_COUNT),
            max_id: maybeMaxId,
        },
    });

const getQueryParameter = (
    req: SafeRequest,
    key: string,
): either.Either<ErrorResponse, string | string[]> =>
    req.query.get(key).foldL(
        () =>
            either.left(
                ErrorResponse.Simple({
                    statusCode: BAD_REQUEST,
                    message: `Expecting query parameter '${key}' but instead got none.`,
                }),
            ),
        value => either.right(value),
    );

export const htmlValueWriteable = new Writeable<string>(htmlString => htmlString, 'text/html');

const getStatusCodeFromTwitterApiErrorResponse = (
    twitterApiErrorResponse: TwitterApiTypes.ErrorResponse,
): number =>
    isTwitterApiErrorResponseRateLimitExceeded(twitterApiErrorResponse)
        ? TOO_MANY_REQUESTS
        : INTERNAL_SERVER_ERROR;

const getStatusCodeForErrorResponse = ErrorResponse.match({
    Simple: ({ statusCode }) => statusCode,
    Unauthenticated: () => FORBIDDEN,
    JsonDecode: ({ statusCode }) => statusCode,
    RequestValidation: () => BAD_REQUEST,
    TwitterApi: ({ errorResponse }) => getStatusCodeFromTwitterApiErrorResponse(errorResponse),
});

export const errorResponseToResult = (error: ErrorResponse) =>
    new Status(getStatusCodeForErrorResponse(error)).apply(
        renderErrorResponse(error),
        htmlValueWriteable,
    );

export enum SessionKeys {
    TwitterUserId = 'twitterUserId',
}

const getTwitterUserIdFromReq = (req: SafeRequest): OrErrorResponse<string> =>
    req.session
        .get(SessionKeys.TwitterUserId)
        .foldL(
            () => either.left(ErrorResponse.Unauthenticated({})),
            twitterUserId => either.right(twitterUserId),
        );

export const getTwitterUserCredentialsFromReq = (
    req: SafeRequest,
): OrErrorResponseAsync<UserTwitterCredentialsT> =>
    taskEither.fromEither(getTwitterUserIdFromReq(req)).chain(twitterUserId =>
        new TaskEither(getUserTwitterCredentialsFromId(twitterUserId)).mapLeft(decodeError =>
            ErrorResponse.JsonDecode({
                statusCode: INTERNAL_SERVER_ERROR,
                decodeError,
                context: 'Twitter user credentials',
            }),
        ),
    );

export const getUserTimeZone = (
    user: TwitterApiTypes.TwitterAPIAccountSettingsT,
): OrErrorResponse<luxon.IANAZone> =>
    option
        .fromNullable(user.time_zone.tzinfo_name)
        .foldL(
            (): OrErrorResponse<string> =>
                either.left(
                    ErrorResponse.Simple({
                        statusCode: INTERNAL_SERVER_ERROR,
                        message: 'Time zone not available for Twitter user',
                    }),
                ),
            timeZone => either.right(timeZone),
        )
        .map(s => new luxon.IANAZone(s));

enum AuthCallbackQueryParameter {
    OAuthToken = 'oauth_token',
    OAuthVerifier = 'oauth_verifier',
}
const AuthCallbackQuery = t.interface({
    oauthToken: t.string,
    oauthVerifier: t.string,
});
type AuthCallbackQueryT = t.TypeOf<typeof AuthCallbackQuery>;
export const getAuthCallbackQuery = (req: SafeRequest): OrErrorResponse<AuthCallbackQueryT> =>
    liftA2(either.either)(
        (oauthToken: string | string[]) => (oauthVerifier: string | string[]) => ({
            oauthToken,
            oauthVerifier,
        }),
    )(getQueryParameter(req, AuthCallbackQueryParameter.OAuthToken))(
        getQueryParameter(req, AuthCallbackQueryParameter.OAuthVerifier),
    ).chain(val =>
        AuthCallbackQuery.decode(val).mapLeft(validationErrors =>
            ErrorResponse.RequestValidation({
                validationErrors,
                context: 'query',
            }),
        ),
    );

export const getRequestToken = TwitterApi.getRequestToken({
    oAuth: {
        consumerKey: TWITTER_CONSUMER_KEY,
        consumerSecret: TWITTER_CONSUMER_SECRET,
        callback: option.some(TWITTER_CALLBACK_URL),
    },
});

export const getAccessToken = (query: AuthCallbackQueryT) =>
    TwitterApi.getAccessToken({
        oAuth: {
            consumerKey: TWITTER_CONSUMER_KEY,
            consumerSecret: TWITTER_CONSUMER_SECRET,
            callback: option.some(TWITTER_CALLBACK_URL),
            token: option.some(query.oauthToken),
            verifier: option.some(query.oauthVerifier),
        },
    });

export const fetchAccountSettings = (credentials: UserTwitterCredentialsT) =>
    TwitterApi.fetchAccountSettings({
        oAuth: {
            consumerKey: TWITTER_CONSUMER_KEY,
            consumerSecret: TWITTER_CONSUMER_SECRET,
            token: option.some(credentials.oauthAccessToken),
            tokenSecret: option.some(credentials.oauthAccessTokenSecret),
        },
    });
