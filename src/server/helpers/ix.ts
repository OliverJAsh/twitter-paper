import { Task } from 'fp-ts/lib/Task';
import * as Ix from 'ix';

// http://reactivex.io/RxJava/javadoc/rx/Observable.html#takeUntil(rx.functions.Func1)
// https://github.com/ReactiveX/rxjs/issues/2420
// https://github.com/martinsik/rxjs-plus#takewhileinclusive
// https://github.com/marcinnajder/powerseq/issues/2
// https://github.com/cujojs/most/issues/427
// http://stackoverflow.com/questions/35757733/rxjs-5-0-do-while-like-mechanism/35800173#35800173
// https://github.com/ReactiveX/IxJS/issues/7
// https://github.com/ReactiveX/IxJS/issues/42#issuecomment-330918896
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

export const asyncIterabletoTaskArray = <T>(asyncIterable: AsyncIterable<T>): Task<T[]> =>
    new Task(() => Ix.AsyncIterable.from(asyncIterable).toArray());
