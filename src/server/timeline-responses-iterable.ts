import * as array from 'fp-ts/lib/Array';
import * as option from 'fp-ts/lib/Option';
import { Task } from 'fp-ts/lib/Task';
import * as Ix from 'ix';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';

import Option = option.Option;

export type TwitterTimelineResponsesIterable = AsyncIterable<TwitterApiTypes.TimelineResponse>;
export type FetchFn = (maybeMaxId: Option<string>) => Task<TwitterApiTypes.TimelineResponse>;

export const createTimelineResponsesIterable = (fetchFn: FetchFn) => {
    // Call the fetch function, providing the max ID.
    // Then, yield result.
    // Then, yield:
    //   if there is a last tweet ID and it is unique: recurse
    //   else: empty
    const getTimelineResponsesFromMaxId = async function*(
        maybeMaxId: Option<string>,
    ): TwitterTimelineResponsesIterable {
        console.log('recurse', { maybeMaxId });
        const result = await fetchFn(maybeMaxId).run();

        yield result;

        const tweets = result.getOrElse([]);
        const maybeLastTweet = array.last(tweets);
        const checkIsUniqueLastId = (lastId: string) =>
            maybeMaxId.map(maxId => lastId !== maxId).getOrElse(true);
        const maybeNextMaxId = maybeLastTweet
            .map(tweet => tweet.id_str)
            .filter(checkIsUniqueLastId);

        // If there is a next max ID, we recurse.
        yield* maybeNextMaxId
            .map(nextMaxId => getTimelineResponsesFromMaxId(option.some(nextMaxId)))
            .getOrElseL(Ix.AsyncIterable.empty);
    };

    return getTimelineResponsesFromMaxId(option.none);
};
