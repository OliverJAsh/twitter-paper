import * as tape from 'blue-tape';
import * as luxon from 'luxon';

import { formatTwitterDate, parseTwitterDate } from '../../helpers/twitter-date';

tape('`parseTwitterDate`', assert => {
    const dateStr = 'Wed Aug 27 13:08:45 +0000 2008';
    const dateTime = parseTwitterDate(dateStr);
    const actualIso = dateTime.toISO();
    const expectedIso = luxon.DateTime.utc(2008, 8, 27, 13, 8, 45).toISO();
    assert.equal(actualIso, expectedIso);
    assert.end();
});

tape('`formatTwitterDate`', assert => {
    const dateTime = luxon.DateTime.utc(2008, 8, 27, 13, 8, 45);
    const expectedDateStr = 'Wed Aug 27 13:08:45 +0000 2008';
    const actualDateStr = formatTwitterDate(dateTime);
    assert.equal(actualDateStr, expectedDateStr);
    assert.end();
});
