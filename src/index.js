import ConfigData          from './ConfigData.js';

import ParserError         from './parser/ParserError.js';

import ASTNodeContainer    from './utils/ASTNodeContainer.js';
import DocDB               from './utils/DocDB.js';
import FileUtil            from './utils/FileUtil.js';
import InvalidCodeLogger   from './utils/InvalidCodeLogger.js';
import LintDocLogger       from './utils/LintDocLogger.js';
import NamingUtil          from './utils/NamingUtil.js';
import TraverseUtil        from './utils/TraverseUtil.js';

/**
 * Adds all common runtime plugins.
 *
 * @param {PluginEvent} ev - The plugin event.
 *
 * @ignore
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   const resolverDataOverride = ev.pluginOptions.resolverData || {};

   // Instances are being loaded into the plugin manager so auto log filtering needs an explicit filter.
   eventbus.trigger('log:add:filter', {
      type: 'inclusive',
      name: 'tjsdoc-runtime-common',
      filterString: '(tjsdoc-runtime-common\/dist|tjsdoc-runtime-common\/src)'
   });

   eventbus.trigger('plugins:add:all', [
      // External plugins.
      { name: 'tjsdoc-docs-common', instance: require('tjsdoc-docs-common'), options: { logAutoFilter: false } },
      { name: 'typhonjs-ast-walker', instance: require('typhonjs-ast-walker'), options: { logAutoFilter: false } },
      { name: 'typhonjs-package-util', instance: require('typhonjs-package-util') },
      { name: 'typhonjs-path-resolver', instance: require('typhonjs-path-resolver') },
      {
         name: 'tjsdoc-config-resolver',
         instance: require('typhonjs-config-resolver'),
         options:
         {
            eventPrepend: 'tjsdoc',
            logEvent: 'log:info:raw',
            resolverData: ConfigData.createResolverData(ev.eventbus, resolverDataOverride)
         }
      },

      // Local plugins.
      { name: 'tjsdoc-file-util', instance: new FileUtil() },
      { name: 'tjsdoc-invalid-code-logger', instance: new InvalidCodeLogger() },
      { name: 'tjsdoc-lint-doc-logger', instance: new LintDocLogger() },
      { name: 'tjsdoc-naming-util', instance: new NamingUtil() },
      { name: 'tjsdoc-node-container', instance: new ASTNodeContainer() },
      { name: 'tjsdoc-traverse-util', instance: new TraverseUtil() }
   ]);

   /**
    * Add doc database plugin with final doc data.
    */
   eventbus.on('tjsdoc:create:doc:db', (docData) =>
   {
      const docDB = new DocDB(docData);

      eventbus.trigger('plugins:add', { name: 'tjsdoc-doc-database', instance: docDB });

      // Allows any plugins to modify document database.
      eventbus.trigger('plugins:invoke:sync:event', 'onHandleDocDB', void 0, { docDB });
   });

   /**
    * Provides an event binding to create a ParserError.
    */
   eventbus.on('tjsdoc:create:parser:error',
    ({ line = void 0, column = void 0, message = void 0, position = void 0, fileName = void 0 } = {}) =>
   {
      if (!Number.isInteger(line)) { throw new TypeError(`'line' is not an 'integer'`); }
      if (!Number.isInteger(column)) { throw new TypeError(`'column' is not an 'integer'`); }

      return new ParserError(line, column, message, position, fileName);
   });
}
