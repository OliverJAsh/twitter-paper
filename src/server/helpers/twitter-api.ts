import { pipe } from 'fp-ts/lib/function';
import * as TwitterApiConstants from 'twitter-api-ts/target/constants';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';
import * as urlHelpers from 'url';

import { parseTwitterDate } from './twitter-date';

// https://developer.twitter.com/en/docs/basics/response-codes
const RATE_LIMIT_EXCEEDED = 88;

// https://developer.twitter.com/en/docs/tweets/timelines/api-reference/get-statuses-home_timeline
export const MAX_TIMELINE_COUNT = 200;

export const isTwitterApiErrorResponseRateLimitExceeded = TwitterApiTypes.ErrorResponse.match(
    {
        APIErrorResponse: ({ apiErrorResponse }) =>
            apiErrorResponse.errors
                // https://github.com/gcanti/io-ts/tree/1786946db7eea09b951a3efc46cdf668fe3299c0#known-issues
                // https://github.com/Microsoft/TypeScript/issues/14041
                // tslint:disable-next-line no-unsafe-any
                .map(error => error.code)
                .includes(RATE_LIMIT_EXCEEDED),
    },
    () => false,
);

// https://developer.twitter.com/en/docs/basics/authentication/api-reference
// https://developer.twitter.com/en/docs/basics/authentication/api-reference/authenticate
export const twitterApiOAuthAuthenticateUrl = urlHelpers.resolve(
    TwitterApiConstants.TWITTER_API_BASE_URL,
    TwitterApiConstants.ENDPOINTS.OAuthAuthenticate,
);

export const getTweetId = (tweet: TwitterApiTypes.TweetT) => tweet.id_str;

const getTweetCreatedAt = (tweet: TwitterApiTypes.TweetT) => tweet.created_at;
export const getTweetCreatedAtParsed = pipe(getTweetCreatedAt, parseTwitterDate);
