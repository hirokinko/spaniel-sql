const api: typeof import('spaniel-sql') = require('spaniel-sql');
const generator: typeof import('spaniel-sql/generator') = require('spaniel-sql/generator');
const { register_typed_sql_tests } = require('../shared/typed_sql.js');

register_typed_sql_tests(api, generator);
