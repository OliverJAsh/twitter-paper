import * as tape from 'blue-tape';
import * as luxon from 'luxon';

import { getPublicationDateForTimeZone } from '../publication';

tape('`getPublicationDateForTimeZone` should select today', assert => {
    const timeZone = new luxon.IANAZone('Europe/London');
    const nowDate = luxon.DateTime.utc(2018, 1, 2, 12);
    const publicationDate = getPublicationDateForTimeZone(nowDate)(timeZone);
    const actualIso = publicationDate.toISO();
    const expectedDateTime = luxon.DateTime.utc(2018, 1, 2, 6);
    const expectedIso = expectedDateTime.toISO();
    assert.equal(actualIso, expectedIso);
    assert.end();
});

tape('`getPublicationDateForTimeZone` should select yesterday', assert => {
    const timeZone = new luxon.IANAZone('Europe/London');
    const nowDate = luxon.DateTime.utc(2018, 1, 2);
    const publicationDate = getPublicationDateForTimeZone(nowDate)(timeZone);
    const actualIso = publicationDate.toISO();
    const expectedDateTime = luxon.DateTime.utc(2018, 1, 1, 6);
    const expectedIso = expectedDateTime.toISO();
    assert.equal(actualIso, expectedIso);
    assert.end();
});

tape('`getPublicationDateForTimeZone` should honour DST', assert => {
    const timeZone = new luxon.IANAZone('Europe/London');
    // Midday on the day of DST spring forward
    const nowDate = luxon.DateTime.utc(2018, 3, 25, 12);
    const publicationDate = getPublicationDateForTimeZone(nowDate)(timeZone);
    const actualIso = publicationDate.toISO();
    // Local time is 6pm but UTC time should not account for DST
    const expectedDateTime = luxon.DateTime.utc(2018, 3, 25, 5);
    const expectedIso = expectedDateTime.toISO();
    assert.equal(actualIso, expectedIso);
    assert.end();
});
