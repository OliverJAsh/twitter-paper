import * as tape from 'blue-tape';
import * as array from 'fp-ts/lib/Array';
import * as chain from 'fp-ts/lib/Chain';
import * as either from 'fp-ts/lib/Either';
import * as option from 'fp-ts/lib/Option';
import * as task from 'fp-ts/lib/Task';
import * as traversable from 'fp-ts/lib/Traversable';
import * as Ix from 'ix';
import * as luxon from 'luxon';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';

import { getTweetId } from '../helpers/twitter-api';
import { formatTwitterDate } from '../helpers/twitter-date';
import {
    getLatestPublication,
    getPublicationDateForTimeZone,
    getPublicationRange,
    PublicationWarning,
} from '../publication';
import { createTimelineResponsesIterable, FetchFn } from '../timeline-responses-iterable';
import { ErrorResponse } from '../types/error-response';

import {
    assertEitherLeft,
    assertEitherRight,
    createTimelineFailure,
    createTimelineSuccess,
    createTweet,
    getMeanDateFromInterval,
} from './helpers';

// tslint:disable no-import-side-effect
import './helpers/twitter-date.test';
import './publication.test';
// tslint:enable no-import-side-effect

const timeZone = 'utc';
const nowDate = luxon.DateTime.utc(2017, 1, 2);
const publicationDate = getPublicationDateForTimeZone(nowDate)(timeZone);
const previousPublicationDate = publicationDate.minus({ days: 1 });
const nextPublicationDate = publicationDate.plus({ days: 1 });
const dateInPublication = getMeanDateFromInterval(getPublicationRange(publicationDate));
const dateBeforePublication = getMeanDateFromInterval(getPublicationRange(previousPublicationDate));
const dateAfterPublication = getMeanDateFromInterval(getPublicationRange(nextPublicationDate));

// should drop tweets after publication end
// should take tweets between publication end and publication start
// should drop tweets before publication start

tape(
    '`getLatestPublication` given a range over one page, should only retrieve tweets in range',
    async assert => {
        const createPagesGenerator = async function*() {
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({
                        id_str: 'c',
                        created_at: formatTwitterDate(dateAfterPublication),
                    }),
                ]),
            );
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({ id_str: 'b', created_at: formatTwitterDate(dateInPublication) }),
                ]),
            );
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({
                        id_str: 'a',
                        created_at: formatTwitterDate(dateBeforePublication),
                    }),
                ]),
            );
        };

        const responsesIterable = createPagesGenerator();
        const serverResponse = await getLatestPublication({
            responsesIterable,
            publicationDate,
        }).value.run();

        assertEitherRight(assert, serverResponse, ({ tweets }) => {
            assert.deepEqual(tweets.map(getTweetId), ['b']);
        });
    },
);

tape('`getLatestPublication` given failures, should return first failure', async assert => {
    const createPagesGenerator = async function*() {
        yield Promise.resolve(
            createTimelineFailure(
                TwitterApiTypes.ErrorResponse.APIErrorResponse({
                    apiErrorResponse: {
                        errors: [{ code: 1, message: 'foo' }],
                    },
                }),
            ),
        );
        yield Promise.resolve(
            createTimelineFailure(
                TwitterApiTypes.ErrorResponse.APIErrorResponse({
                    apiErrorResponse: {
                        errors: [{ code: 2, message: 'bar' }],
                    },
                }),
            ),
        );
    };

    const responsesIterable = createPagesGenerator();
    const serverResponse = await getLatestPublication({
        responsesIterable,
        publicationDate,
    }).value.run();

    assertEitherLeft(
        assert,
        serverResponse.mapLeft(
            ErrorResponse.match({
                TwitterApi: ({ errorResponse }) =>
                    TwitterApiTypes.ErrorResponse.is.APIErrorResponse(errorResponse)
                        ? errorResponse.apiErrorResponse.errors.map(
                              twitterApiError => twitterApiError.code,
                          )
                        : [],
                default: () => [],
            }),
        ),
        statusCodes => {
            assert.deepEqual(statusCodes, [1]);
        },
    );
});

tape(
    '`getLatestPublication` given a range over multiple pages, should only retrieve tweets in range',
    async assert => {
        const createPagesGenerator = async function*() {
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({
                        id_str: 'c',
                        created_at: formatTwitterDate(dateAfterPublication),
                    }),
                ]),
            );
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({ id_str: 'b', created_at: formatTwitterDate(dateInPublication) }),
                ]),
            );
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({ id_str: 'a', created_at: formatTwitterDate(dateInPublication) }),
                ]),
            );
        };

        const responsesIterable = createPagesGenerator();
        const serverResponse = await getLatestPublication({
            responsesIterable,
            publicationDate,
        }).value.run();

        assertEitherRight(assert, serverResponse, ({ tweets }) => {
            assert.deepEqual(tweets.map(getTweetId), ['b', 'a']);
        });
    },
);

tape(
    '`getLatestPublication` should finish iterating pages when range is exceeded',
    async assert => {
        let fail = true;
        const createPagesGenerator = async function*() {
            fail = false;
            // range ends in this page
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({ id_str: 'c', created_at: formatTwitterDate(dateInPublication) }),
                    createTweet({
                        id_str: 'b',
                        created_at: formatTwitterDate(dateBeforePublication),
                    }),
                ]),
            );
            fail = true;
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({
                        id_str: 'a',
                        created_at: formatTwitterDate(dateBeforePublication),
                    }),
                ]),
            );
        };

        const responsesIterable = createPagesGenerator();
        const serverResponse = await getLatestPublication({
            responsesIterable,
            publicationDate,
        }).value.run();

        assertEitherRight(assert, serverResponse, () => {
            assert.equal(fail, false);
        });
    },
);

tape('`getLatestPublication` should finish iterating pages when a page is empty', async assert => {
    let fail = true;
    const createPagesGenerator = async function*() {
        fail = false;
        // range ends in this page
        yield Promise.resolve(createTimelineSuccess([]));
        fail = true;
    };

    const responsesIterable = createPagesGenerator();
    const serverResponse = await getLatestPublication({
        responsesIterable,
        publicationDate,
    }).value.run();

    assertEitherRight(assert, serverResponse, () => {
        assert.equal(fail, false);
    });
});

tape('`getLatestPublication` warning: last is before: none', async assert => {
    const createPagesGenerator = async function*() {
        yield Promise.resolve(
            createTimelineSuccess([
                createTweet({ id_str: 'a', created_at: formatTwitterDate(dateBeforePublication) }),
            ]),
        );
    };

    const responsesIterable = createPagesGenerator();
    const serverResponse = await getLatestPublication({
        responsesIterable,
        publicationDate,
    }).value.run();

    assertEitherRight(assert, serverResponse, ({ warning }) => {
        assert.deepEqual(warning, option.none);
    });
});

tape(
    '`getLatestPublication` warning: last is in: range end potentially unreachable',
    async assert => {
        const createPagesGenerator = async function*() {
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({ id_str: 'a', created_at: formatTwitterDate(dateInPublication) }),
                ]),
            );
        };

        const responsesIterable = createPagesGenerator();
        const serverResponse = await getLatestPublication({
            responsesIterable,
            publicationDate,
        }).value.run();

        assertEitherRight(assert, serverResponse, ({ warning }) => {
            assert.deepEqual(
                warning,
                option.some(PublicationWarning.RangeEndPotentiallyUnreachable({})),
            );
        });
    },
);

tape('`getLatestPublication` warning: no last: none', async assert => {
    const createPagesGenerator = async function*() {
        yield Promise.resolve(createTimelineSuccess([]));
    };

    const responsesIterable = createPagesGenerator();
    const serverResponse = await getLatestPublication({
        responsesIterable,
        publicationDate,
    }).value.run();

    assertEitherRight(assert, serverResponse, ({ warning }) => {
        assert.deepEqual(warning, option.none);
    });
});

tape(
    '`getLatestPublication` warning: last is after: range start potentially unreachable',
    async assert => {
        const createPagesGenerator = async function*() {
            yield Promise.resolve(
                createTimelineSuccess([
                    createTweet({
                        id_str: 'a',
                        created_at: formatTwitterDate(dateAfterPublication),
                    }),
                ]),
            );
        };

        const responsesIterable = createPagesGenerator();
        const serverResponse = await getLatestPublication({
            responsesIterable,
            publicationDate,
        }).value.run();

        assertEitherRight(assert, serverResponse, ({ warning }) => {
            assert.deepEqual(
                warning,
                option.some(PublicationWarning.RangeStartPotentiallyUnreachable({})),
            );
        });
    },
);

tape(
    '`createTimelineResponsesIterable` page through results should recurse whilst max ID is unique',
    async assert => {
        const fetchFn: FetchFn = maybeMaxId => {
            const result = maybeMaxId
                .foldL(
                    // 1st request, no max ID
                    () => [{ id_str: 'c' }, { id_str: 'b' }],
                    maxId => {
                        switch (maxId) {
                            // 2nd request
                            case 'b': {
                                return [{ id_str: 'b' }, { id_str: 'a' }];
                            }
                            // 3rd request
                            case 'a': {
                                return [{ id_str: 'a' }];
                            }
                            default:
                                return [];
                        }
                    },
                )
                .map(createTweet);
            return task.task.of(createTimelineSuccess(result));
        };
        const responsesIterable = createTimelineResponsesIterable(fetchFn);
        const responses = await Ix.AsyncIterable.from(responsesIterable).toArray();

        assert.deepEqual(
            responses.map(page =>
                option
                    .fromEither(page)
                    .getOrElse([])
                    .map(getTweetId),
            ),
            [['c', 'b'], ['b', 'a'], ['a']],
        );
    },
);

tape(
    '`createTimelineResponsesIterable` page through results should stop at the first failure',
    async assert => {
        const fetchFn: FetchFn = () =>
            task.task.of(
                createTimelineFailure(
                    TwitterApiTypes.ErrorResponse.APIErrorResponse({
                        apiErrorResponse: {
                            errors: [{ code: 1, message: 'bar' }],
                        },
                    }),
                ),
            );
        const responsesIterable = createTimelineResponsesIterable(fetchFn);
        const responses = await Ix.AsyncIterable.from(responsesIterable).toArray();
        const sequenceEithers = traversable.sequence(either.either, array.array);
        const pagesM = sequenceEithers(responses);
        const tweetsM = pagesM.map(chain.flatten(array.array));

        assertEitherLeft(
            assert,
            tweetsM.mapLeft(
                errorResponse =>
                    TwitterApiTypes.ErrorResponse.is.APIErrorResponse(errorResponse)
                        ? errorResponse.apiErrorResponse.errors.map(
                              twitterApiError => twitterApiError.code,
                          )
                        : [],
            ),
            errorStatusCodes => {
                assert.deepEqual(errorStatusCodes, [1]);
            },
        );
    },
);
