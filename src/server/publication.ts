// Tweets in timeline response page must be in descending order

import { array, last } from 'fp-ts/lib/Array';
import * as chain from 'fp-ts/lib/Chain';
import { either } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as option from 'fp-ts/lib/Option';
import * as taskEither from 'fp-ts/lib/TaskEither';
import * as traversable from 'fp-ts/lib/Traversable';
import * as luxon from 'luxon';
import { dropWhile, takeWhile, uniqBy } from 'ramda';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';
import { ofType, unionize } from 'unionize';

import { asyncIterableToTaskArray, takeUntil } from './helpers/ix';
import { getTweetCreatedAtParsed, getTweetId } from './helpers/twitter-api';
import { TwitterTimelineResponsesIterable } from './timeline-responses-iterable';
import { FullPublicationResponse, PublicationResponse, TaskEitherFromEither } from './types';
import { ErrorResponse } from './types/error-response';

import Option = option.Option;
import TaskEither = taskEither.TaskEither;

const PUBLICATION_HOUR = 6;

// Given UTC date for now and time zone, returns UTC date for publication
export const getPublicationDateForTimeZone = (nowDate: luxon.DateTime) => (
    timeZone: luxon.IANAZone,
) => {
    const localDate = nowDate.setZone(timeZone);
    const createLocalPublicationDateYesterday = () =>
        localDate
            .set({
                day: localDate.day - 1,
                hour: PUBLICATION_HOUR,
            })
            .startOf('hour');
    const localPublicationDateToday = localDate
        .set({
            hour: PUBLICATION_HOUR,
        })
        .startOf('hour');
    const localPublicationDate =
        nowDate >= localPublicationDateToday
            ? localPublicationDateToday
            : createLocalPublicationDateYesterday();
    return localPublicationDate.setZone('utc');
};

export const getPublicationRange = (publicationDate: luxon.DateTime): luxon.Interval => {
    // Note: intervals are inclusive of the start but not the end.
    const publicationEndDate = publicationDate;
    const publicationStartDate = publicationDate.minus({ days: 1 });
    return luxon.Interval.fromDateTimes(publicationStartDate, publicationEndDate);
};

const isTweetLtPublicationStart = (publicationDate: luxon.DateTime) => (
    tweet: TwitterApiTypes.TweetT,
) => {
    const publicationRange = getPublicationRange(publicationDate);
    return getTweetCreatedAtParsed(tweet) < publicationRange.start;
};
const isTweetGtePublicationStart = (publicationDate: luxon.DateTime) => (
    tweet: TwitterApiTypes.TweetT,
) => {
    const publicationRange = getPublicationRange(publicationDate);
    return getTweetCreatedAtParsed(tweet) >= publicationRange.start;
};
const isTweetGtePublicationEnd = (publicationDate: luxon.DateTime) => (
    tweet: TwitterApiTypes.TweetT,
) => {
    const publicationRange = getPublicationRange(publicationDate);
    return getTweetCreatedAtParsed(tweet) >= publicationRange.end;
};

const getTweetsInRange = (publicationDate: luxon.DateTime) =>
    pipe(
        dropWhile(isTweetGtePublicationEnd(publicationDate)),
        takeWhile(isTweetGtePublicationStart(publicationDate)),
    );

const isTweetInRange = (publicationDate: luxon.DateTime) => {
    const publicationRange = getPublicationRange(publicationDate);
    return pipe(
        getTweetCreatedAtParsed,
        dateTime => publicationRange.contains(dateTime),
    );
};

export const PublicationWarning = unionize({
    RangeStartPotentiallyUnreachable: ofType<{}>(),
    RangeEndPotentiallyUnreachable: ofType<{}>(),
});
export type PublicationWarning = typeof PublicationWarning._Union;

const getWarning = (publicationDate: luxon.DateTime) => (
    tweets: TwitterApiTypes.TweetT[],
): Option<PublicationWarning> => {
    const maybeLastTweet = last(tweets);

    const isRangeStartPotentiallyUnreachable = maybeLastTweet
        .map(isTweetGtePublicationEnd(publicationDate))
        .getOrElse(false);

    const isRangeEndPotentiallyUnreachable = maybeLastTweet
        .map(isTweetInRange(publicationDate))
        .getOrElse(false);

    return isRangeStartPotentiallyUnreachable
        ? option.some(PublicationWarning.RangeStartPotentiallyUnreachable({}))
        : isRangeEndPotentiallyUnreachable
            ? option.some(PublicationWarning.RangeEndPotentiallyUnreachable({}))
            : option.none;
};

const checkIsPageAfterRangeEnd = (publicationDate: luxon.DateTime) => (
    page: TwitterApiTypes.TwitterAPITimelineResponseT,
) =>
    last(page)
        .map(isTweetLtPublicationStart(publicationDate))
        // If the page is empty, the range has ended.
        .getOrElse(true);

const checkIsTimelineResponseAfterRangeEnd = (publicationDate: luxon.DateTime) => (
    response: TwitterApiTypes.TimelineResponse,
) =>
    response
        .map(checkIsPageAfterRangeEnd(publicationDate))
        // If the response is an error, the range has ended.
        .getOrElse(true);

const takeTimelineResponsesUntilRangeEnd = (publicationDate: luxon.DateTime) =>
    takeUntil(checkIsTimelineResponseAfterRangeEnd(publicationDate));

const getUniqueTweetsById = uniqBy(getTweetId);

const flattenArray = chain.flatten(array);
const sequenceEithers = traversable.sequence(either, array);

export const getLatestPublication = ({
    responsesIterable,
    publicationDate,
}: {
    responsesIterable: TwitterTimelineResponsesIterable;
    publicationDate: luxon.DateTime;
}): TaskEitherFromEither<FullPublicationResponse> => {
    const responsesInRangeIterable = takeTimelineResponsesUntilRangeEnd(publicationDate)(
        responsesIterable,
    );
    const responsesInRangeTask = asyncIterableToTaskArray(responsesInRangeIterable);
    const pagesInRangeResponseTask = responsesInRangeTask.map(sequenceEithers);
    const publicationTweetsM = new TaskEither(pagesInRangeResponseTask).map(flattenArray);

    return (
        publicationTweetsM
            .mapLeft(twitterApiErrorResponse =>
                ErrorResponse.TwitterApi({ errorResponse: twitterApiErrorResponse }),
            )
            // Since the max ID parameter is inclusive, there will be duplicates
            // where the pages meet. This removes them.
            .map(getUniqueTweetsById)
            .map(
                (tweets): PublicationResponse => ({
                    warning: getWarning(publicationDate)(tweets),
                    tweets: getTweetsInRange(publicationDate)(tweets),
                }),
            )
    );
};
