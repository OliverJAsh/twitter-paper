// Must come before source
require('source-map-support/register');

const luxon = require('luxon');

luxon.Settings.throwOnInvalid = true;

require('./target-tsc/server/index.js');
