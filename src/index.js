import ConfigData          from './ConfigData.js';

import * as DocDB          from './doc/DocDB.js';

import * as ParserError    from './parser/ParserError.js';

import PublisherRuntime    from './publisher/PublisherRuntime.js';

import FileUtil            from './utils/FileUtil.js';
import GenerateDocData     from './utils/GenerateDocData.js';
import InvalidCodeLogger   from './utils/InvalidCodeLogger.js';
import LintDocLogger       from './utils/LintDocLogger.js';
import NamingUtil          from './utils/NamingUtil.js';
import RegenerateDocData   from './utils/RegenerateDocData.js';

/**
 * Adds all common runtime plugins.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   // Any resolver data overrides from parent runtime.
   const resolverDataOverride = ev.pluginOptions.resolverData || {};

   // Retrieve any publisher resolver data overrides.
   const pubResolverDataOverride = eventbus.triggerSync('tjsdoc:data:publisher:config:resolver:get') || {};

   // Instances are being loaded into the plugin manager so auto log filtering needs an explicit filter.
   eventbus.trigger('log:filter:add', {
      type: 'inclusive',
      name: 'tjsdoc-runtime-common',
      filterString: '(tjsdoc-runtime-common\/dist|tjsdoc-runtime-common\/src)'
   });

   eventbus.trigger('plugins:add:all', [
      // External plugins.
      { name: 'tjsdoc-docs-common', instance: require('tjsdoc-docs-common'), options: { logAutoFilter: false } },
      { name: 'typhonjs-ast-walker', instance: require('typhonjs-ast-walker'), options: { logAutoFilter: false } },
      { name: 'typhonjs-object-util', instance: require('typhonjs-object-util') },
      { name: 'typhonjs-package-util', instance: require('typhonjs-package-util') },
      {
         name: 'tjsdoc-config-resolver',
         instance: require('typhonjs-config-resolver'),
         options:
         {
            eventPrepend: 'tjsdoc:system',
            logEvent: 'log:info:raw',
            resolverData: ConfigData.createResolverData(ev.eventbus, resolverDataOverride, pubResolverDataOverride)
         }
      },

      // Local plugins.
      { name: 'tjsdoc-docdb', instance: DocDB },
      { name: 'tjsdoc-docdb-generate', instance: new GenerateDocData() },
      { name: 'tjsdoc-docdb-regenerate', instance: new RegenerateDocData() },
      { name: 'tjsdoc-file-util', instance: new FileUtil() },
      { name: 'tjsdoc-invalid-code-logger', instance: new InvalidCodeLogger() },
      { name: 'tjsdoc-lint-doc-logger', instance: new LintDocLogger() },
      { name: 'tjsdoc-naming-util', instance: new NamingUtil() },
      { name: 'tjsdoc-parser-error', instance: ParserError },
      { name: 'tjsdoc-runtime-publisher', instance: new PublisherRuntime() }
   ]);
}

/**
 * Handles removing plugins before generation that may not be needed based on the target project TJSDocConfig.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPreGenerate(ev)
{
   // If doc linting is not enabled then remove LintDocLogger
   if (!ev.data.mainConfig.docLint)
   {
      ev.eventbus.trigger('plugins:remove', 'tjsdoc-lint-doc-logger');
   }
}
