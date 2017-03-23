import ConfigData          from './ConfigData.js';

import * as DocDB          from './doc/DocDB.js';

import * as ParserError    from './parser/ParserError.js';

import FileUtil            from './utils/FileUtil.js';
import GenerateDocData     from './utils/GenerateDocData.js';
import InvalidCodeLogger   from './utils/InvalidCodeLogger.js';
import LintDocLogger       from './utils/LintDocLogger.js';
import MergeDocData        from './utils/MergeDocData.js';
import NamingUtil          from './utils/NamingUtil.js';
import PathResolver        from './utils/PathResolver.js';

/**
 * Adds all common runtime plugins.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   const resolverDataOverride = ev.pluginOptions.resolverData || {};

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
            resolverData: ConfigData.createResolverData(ev.eventbus, resolverDataOverride)
         }
      },

      // Local plugins.
      { name: 'tjsdoc-docdb', instance: DocDB },
      { name: 'tjsdoc-docdb-generate', instance: new GenerateDocData() },
      { name: 'tjsdoc-docdb-merge', instance: new MergeDocData() },
      { name: 'tjsdoc-file-util', instance: new FileUtil() },
      { name: 'tjsdoc-invalid-code-logger', instance: new InvalidCodeLogger() },
      { name: 'tjsdoc-naming-util', instance: new NamingUtil() },
      { name: 'tjsdoc-parser-error', instance: ParserError },
      { name: 'tjsdoc-path-resolver', instance: new PathResolver() }
   ]);
}

/**
 * Handles adding plugins before generation that may be needed based on the target project TJSDocConfig.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPreGenerate(ev)
{
   // If enabled add lint doc logger.
   if (ev.data.config.docLint)
   {
      ev.eventbus.trigger('plugins:add', { name: 'tjsdoc-lint-doc-logger', instance: new LintDocLogger() });
   }
}

/**
 * Handle any removal of data plugins for documentation regeneration.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onRegenerate(ev)
{
   const eventbus = ev.eventbus;

   eventbus.trigger('plugins:remove', 'tjsdoc-docs-common');
}
