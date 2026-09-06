import * as api from 'spaniel-sql';
import * as generator from 'spaniel-sql/generator';
import { register_typed_sql_tests } from '../shared/typed_sql.js';

register_typed_sql_tests(api, generator);
