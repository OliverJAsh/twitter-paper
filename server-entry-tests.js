// Must come before source
require('source-map-support/register');

const luxon = require('luxon');

luxon.Settings.throwOnInvalid = true;

require('./target-tsc/server/tests/index.test.js');
require('./target-tsc/server/tests/publication.test.js');
require('./target-tsc/server/tests/helpers/twitter-date.test.js');
