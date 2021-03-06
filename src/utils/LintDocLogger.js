import path from 'path';

/**
 * Documentation lint logger. Detects parameter mismatches between function and class methods and documentation storing
 * the results for later logging.
 *
 * Since AST node data for each doc object is required for validation this must occur in `onHandleDocObject` which is
 * invoked in `DocDB->insertStaticDoc` before any AST node is removed. Logging is only enabled if the DocDB mode is set
 * to `generate` which is the case for a full generation of docs. For instance incremental regeneration via
 * `RegenerateDocData` sets the mode to `regenerate` and lint doc logging does not occur.
 *
 * If TJSDocConfig `docLint` is set to false this plugin is not enabled.
 */
export default class LintDocLogger
{
   /**
    * Instantiates LintDocLogger
    */
   constructor()
   {
      /**
       * Holds any lint doc warning messages.
       * @type {Array}
       * @private
       */
      this._results = [];
   }

   /**
    * Gets variable names from method arguments.
    *
    * @param {DocObject} doc - target doc object.
    *
    * @returns {string[]} variable names.
    * @private
    */
   _getParamsFromDoc(doc)
   {
      const params = doc.params || [];

      return params.map((v) => v.name).filter((v) => !v.includes('.')).filter((v) => !v.includes('['));
   }

   /**
    * Logs any lint doc warnings uncovered and clears warnings after logging.
    */
   logWarnings()
   {
      if (this._results.length > 0)
      {
         this._eventbus.trigger('log:warn:raw', '\n================================================');
         this._eventbus.trigger('log:warn:raw', `[33mLintDocLogger warnings:[0m`);
         this._eventbus.trigger('log:warn:raw', '================================================');

         for (const message of this._results)
         {
            this._eventbus.trigger('log:warn:raw', message);
         }

         this._results.length = 0;
      }
   }

   /**
    * Checks if code parameters matches document parameters.
    *
    * @param {string[]}  codeParams - Code parameters.
    * @param {string[]}  docParams - Document parameters.
    *
    * @returns {boolean}
    * @private
    */
   _match(codeParams, docParams)
   {
      if (codeParams.length !== docParams.length) { return false; }

      for (let i = 0; i < codeParams.length; i++)
      {
         if (codeParams[i] === '*')
         {
            // do nothing
         }
         else if (codeParams[i] !== docParams[i])
         {
            return false;
         }
      }

      return true;
   }

   /**
    * During the TJSDoc `onComplete` callback if documentation linting is enabled then output any lint warnings.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onRuntimeCompleteAsync(ev)
   {
      if (ev.data.mainConfig.docLint) { this.logWarnings(); }
   }

   /**
    * Handles parsing any created DocObject before it is inserted into the DB. This always allows parsing `doc.node`
    * which may be removed prior to insertion into the DocDB if `outputASTData` is not true (the default).
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onHandleDocObject(ev)
   {
      const doc = ev.data.docObject;
      const mode = ev.data.mode;

      // Only handle class method and module function docs that have an AST node and when the DocDB `mode` is
      // `generate`.
      if (!mode || mode !== 'generate' || doc.undocument || !doc.node ||
       (doc.kind !== 'ClassMethod' && doc.kind !== 'ModuleFunction'))
      {
         return;
      }

      // Get AST / parser specific parsing of the node returning any method params.
      const codeParams = this._eventbus.triggerSync('tjsdoc:system:ast:method:params:from:node:get', doc.node);

      const docParams = this._getParamsFromDoc(doc);

      if (this._match(codeParams, docParams)) { return; }

      const absFilePath = path.resolve(this._mainConfig._dirPath, doc.filePath);

      const comment = this._eventbus.triggerSync('tjsdoc:system:ast:file:comment:first:line:from:node:get', doc.node,
       absFilePath);

      const lintMessage = `\n[33mwarning: signature mismatch: ${doc.name} ${doc.filePath}#${comment.lineStart}[32m\n${
       comment.text}[0m'`;

      this._results.push(lintMessage);
   }

   /**
    * Wires up LintDocLogger on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      /**
       * Stores the plugin eventbus proxy.
       * @type {EventProxy}
       */
      this._eventbus = ev.eventbus;

      this._eventbus.on('tjsdoc:system:lint:doc:log', this.logWarnings, this);
   }

   /**
    * Stores TJSDocConfig.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onRuntimePreGenerateAsync(ev)
   {
      /**
       * The target project TJSDoc config.
       * @type {TJSDocConfig}
       * @private
       */
      this._mainConfig = ev.data.mainConfig;
   }
}
