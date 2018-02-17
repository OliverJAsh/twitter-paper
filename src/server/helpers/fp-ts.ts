import * as option from 'fp-ts/lib/Option';

import Option = option.Option;

export const unsafeGet = <T>(optionInstance: Option<T>): T =>
    optionInstance.getOrElseL(() => {
        throw new Error('Expected some');
    });
