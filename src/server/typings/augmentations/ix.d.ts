// Workaround for https://github.com/ReactiveX/IxJS/issues/214 until
// https://github.com/ReactiveX/IxJS/pull/215 is released.

import { IterableX } from 'ix/iterable/iterablex';
import { AsyncIterableX } from 'ix/asynciterable/asynciterablex';

declare module 'ix/iterable/concat' {
    // @ts-ignore: static function overload augmentation
    function concat<T>(source: IterableX<T>, ...args: Iterable<T>[]): IterableX<T>;
}

declare module 'ix/asynciterable/concat' {
    // @ts-ignore: static function overload augmentation
    function concat<T>(source: AsyncIterableX<T>, ...args: AsyncIterable<T>[]): AsyncIterableX<T>;
}

declare module 'ix/asynciterable/merge' {
    // @ts-ignore: static function overload augmentation
    function merge<T>(source: AsyncIterableX<T>, ...args: AsyncIterable<T>[]): AsyncIterableX<T>;
}
