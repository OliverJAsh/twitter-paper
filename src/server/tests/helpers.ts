import * as tape from 'blue-tape';
import * as either from 'fp-ts/lib/Either';
import * as luxon from 'luxon';
import { map, mean, pipe } from 'ramda';
import { createErrorResponse } from 'twitter-api-ts/target/helpers';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';
import { ObjectDiff } from 'typelevel-ts/lib';

import { formatTwitterDate } from '../helpers/twitter-date';

import Either = either.Either;

const dateToEpoch = (date: luxon.DateTime) => date.valueOf();
const meanDates = pipe(map(dateToEpoch), mean, luxon.DateTime.fromMillis);
export const getMeanDateFromInterval = (interval: luxon.Interval): luxon.DateTime => {
    const { start, end } = interval;
    return meanDates([start, end]);
};

export const assertEitherRight = <L, A>(
    assert: tape.Test,
    eitherInstance: Either<L, A>,
    rightFn: (a: A) => void,
) => {
    eitherInstance.fold(left => {
        assert.fail(`Unexpected left: ${JSON.stringify(left, null, '\t')}`);
    }, rightFn);
};

export const assertEitherLeft = <L, A>(
    assert: tape.Test,
    eitherInstance: Either<L, A>,
    leftFn: (l: L) => void,
) => {
    eitherInstance.fold(leftFn, right => {
        assert.fail(`Unexpected right: ${JSON.stringify(right, null, '\t')}`);
    });
};

// tslint:disable no-unnecessary-callback-wrapper
export const createTimelineFailure = (
    errorResponse: TwitterApiTypes.ErrorResponse,
): TwitterApiTypes.TimelineResponse =>
    createErrorResponse<TwitterApiTypes.TwitterAPITimelineResponseT>(errorResponse);
const createSuccessResponse = <T>(successResponse: T): TwitterApiTypes.Response<T> =>
    either.right<TwitterApiTypes.ErrorResponse, T>(successResponse);
export const createTimelineSuccess = (
    tweets: TwitterApiTypes.TwitterAPITimelineResponseT,
): TwitterApiTypes.TimelineResponse => createSuccessResponse(tweets);
// tslint:enable no-unnecessary-callback-wrapper

const tweetDefaults: Pick<TwitterApiTypes.TweetT, 'text' | 'user' | 'created_at'> = {
    text: 'foo',
    user: { id_str: 'foo', screen_name: 'foo', time_zone: 'foo' },
    created_at: formatTwitterDate(luxon.DateTime.utc()),
};
type TweetInput = ObjectDiff<TwitterApiTypes.TweetT, typeof tweetDefaults>;
export const createTweet = (tweetInput: TweetInput): TwitterApiTypes.TweetT => ({
    ...tweetDefaults,
    ...tweetInput,
});
