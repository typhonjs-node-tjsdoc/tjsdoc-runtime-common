import path from 'path';

const addTargets = { 'babylon': true, 'default': false };

/**
 * Defines the default runtime targets for testing against published modules.
 *
 * @type {*[]}
 */
const s_DEFAULT_TARGET = [];

if (addTargets.babylon)
{
   s_DEFAULT_TARGET.push({
      name: 'babylon',
      cli: 'tjsdoc-babylon/src/TJSDocBabylonCLI.js', // TODO: This may need to be changed to 'dist' due to require.
      tjsdoc: 'tjsdoc-babylon',
      runtime: 'tjsdoc-babylon',
      publisher: 'tjsdoc-publisher-static-html',
      type: 'ecmascript'
   });
}

/**
 * Defines the development runtime targets for testing against local source code.
 *
 * @type {*[]}
 */
const s_DEV_TARGET = [];

if (addTargets.babylon)
{
   s_DEV_TARGET.push({
      name: 'babylon',
      cli: path.resolve('../tjsdoc-babylon/src/TJSDocBabylonCLI.js'),
      tjsdoc: path.resolve('../tjsdoc-babylon/src/TJSDocBabylon.js'),
      runtime: path.resolve('../tjsdoc-babylon/src/TJSDocBabylon.js'),
      publisher: path.resolve('../tjsdoc-publisher-static-html/src/Publisher.js'),
      type: 'ecmascript'
   });
}

if (addTargets.default)
{
   s_DEV_TARGET.push({
      name: 'default',
      cli: path.resolve('../tjsdoc/src/TJSDocCLI.js'),
      tjsdoc: path.resolve('../tjsdoc/src/TJSDoc.js'),
      runtime: path.resolve('../tjsdoc-babylon/src/TJSDocBabylon.js'),
      publisher: path.resolve('../tjsdoc-publisher-static-html/src/Publisher.js'),
      type: 'ecmascript'
   });
}

/**
 * Defines the runtime targets for each NPM test script.
 *
 * @type {object}
 */
const targets =
{
   'dev-test': s_DEV_TARGET,
   'dev-test-coverage': s_DEV_TARGET,
   'dev-test-npm': s_DEV_TARGET,

   'test': s_DEFAULT_TARGET,
   'test-coverage': s_DEFAULT_TARGET
};

/**
 * Defines local test category overrides.
 *
 * @type {{config: boolean, doc: boolean, html: boolean, html_doc: boolean}}
 */
const category =
{
   cli: false,
   config: false,
   config_raw_data: false,
   html: false,
   html_doc: false,
   runtime_babylon: false,
   runtime_common: true
};

const emptyDest = true;

const generateMain = true;

export { category, emptyDest, generateMain, targets };
