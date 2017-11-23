#!/usr/bin/env node
import './promisify';

import program from 'commander';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import nb from 'node-beautify';

import Migrate from './migrate';

import {
  MarinerError,
  NoConfigError,
} from './errors';

const filename = path.join(process.cwd(), 'mariner.js');


if (! fs.existsSync(filename)) {
  throw new NoConfigError();
}

const config = require(filename);

program.version(require('../package.json').version);

program.command('create <name...>')
  .option('-e, --extension <extension>', 'Dialect Extension', 'sql')
  .description('Create a new database migration')
  .action(function(name, command) {
    name = name.join('-');

    const options = command.opts();

    Migrate.init(config)
    .then((instance) => {
      return instance.create(name, options);
    })
    .then((created) => {
      console.log('Created:', created); // eslint-disable-line no-console
    })
    .catch(MarinerError, (err) => {
      console.error('⛵\tERROR: ', err.message);  // eslint-disable-line no-console
      process.exit(1);
    })
    .catch((err) => {
      console.error(err.stack);  // eslint-disable-line no-console
      process.exit(1);
    });
  });

program.command('init')
  .option('-d --directory <directory>', 'Path to migrations', './migrations')
  .option('-b --backwards', 'Backwards compatibilty', false)
  .description('Generate the default .mariner configuration file')
  .action(function(command) {
    const options = command.opts();

    const shim = options.backwards ? `
      // see list of available options at http://knexjs.org
      sql: {
        client: 'pg',
        connection : process.env.DATABASE_URL || process.env.POSTGRES_URL,
      },

      backend : 'sql',
    ` : `
      // see list of available options at http://knexjs.org
      sql: {},

      backend: 'sql',
    `;

    const output = `
      'use strict';

      module.exports = {
        directory: '${options.directory}',

        stopOnWarning: true,

        plugins: [
          'sql',
          'js'
        ],

        ${shim.trim()}
      };
    `;

    const code = nb.beautifyJs(output.trim(), {
      indentSize : 2,
    });

    fs.writeFileSync(path.join(process.cwd(), 'mariner.js'), code);

    console.log('⛵\tInit: ', 'Configuration file generated'); // eslint-disable-line
  });

program.command('migrate <direction>')
  .option('-n, --number <number>', 'How many migrations to run', null)
  .description('Run database migrations; up defaults to running all, down defaults to running last')
  .action(function(direction, command) {
    const options = command.opts();
    const count = options.number ? Number(options.number) : null;

    Migrate.init(config)
    .then((migrate) => {
      return migrate.run(direction, count);
    })
    .then(() => {
      process.exit(0);
    })
    .catch(MarinerError, (err) => {
      console.error('⛵\tERROR: ', err.message);  // eslint-disable-line no-console
      process.exit(1);
    })
    .catch((err) => {
      console.error(err.stack);  // eslint-disable-line no-console
      process.exit(1);
    });
  });

program.parse(process.argv);
