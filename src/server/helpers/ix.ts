import { Task } from 'fp-ts/lib/Task';
import * as Ix from 'ix';

// https://github.com/ReactiveX/IxJS/issues/7
export const takeUntil = <T>(fn: (value: T) => boolean) => (
    asyncIterable: AsyncIterable<T>,
): AsyncIterable<T> =>
    Ix.AsyncIterable.from(asyncIterable)
        .map(value => {
            const shouldEnd = fn(value);
            return shouldEnd
                ? [{ value, done: false }, { value: undefined, done: true }]
                : [{ value, done: false }];
        })
        .flatMap(iterable => Ix.AsyncIterable.from(iterable))
        .takeWhile((x): x is { done: false; value: T } => !x.done)
        .map(({ value }) => value);

export const asyncIterableToTaskArray = <T>(asyncIterable: AsyncIterable<T>): Task<T[]> =>
    new Task(() => Ix.AsyncIterable.from(asyncIterable).toArray());
