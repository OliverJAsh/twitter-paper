import * as luxon from 'luxon';

// https://stackoverflow.com/a/20478182/5932012
const TWITTER_DATE_FORMAT = 'EEE MMM d HH:mm:ss ZZZ yyyy';

// When `luxon.Settings.throwOnInvalid = true;`, Luxon will throw an exception if the string does
// not match the format.
// https://github.com/moment/luxon/blob/master/docs/validity.md#throwoninvalid
export const parseTwitterDate = (dateStr: string): luxon.DateTime =>
    luxon.DateTime.fromFormat(dateStr, TWITTER_DATE_FORMAT, { setZone: true }).setZone('utc');

export const formatTwitterDate = (dateTime: luxon.DateTime): string =>
    dateTime.toFormat(TWITTER_DATE_FORMAT);
