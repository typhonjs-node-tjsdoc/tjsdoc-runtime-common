import path from 'path';

/**
 * Lint output logger. Detects parameter mismatches between code and documentation and logs the results.
 */
export default class LintDocLogger
{
   /**
    * Executes writing source code for each file
    */
   exec()
   {
      const results = [];
      const docs = this._eventbus.triggerSync('tjsdoc:data:docdb:find', { kind: ['method', 'function'] });

      for (const doc of docs)
      {
         if (doc.undocument) { continue; }

         const node = this._eventbus.triggerSync('tjsdoc:data:ast:nodes:get', doc.__docId__);

         // Get AST / parser specific parsing of the node returning any method params.
         const codeParams = this._eventbus.triggerSync('tjsdoc:ast:get:method:params:from:node', node);

         const docParams = this._getParamsFromDoc(doc);

         if (this._match(codeParams, docParams)) { continue; }

         results.push({ node, doc, codeParams, docParams });
      }

      this._showResult(results);
   }

   /**
    * Gets variable names of from method arguments.
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

      this._eventbus.on('tjsdoc:system:lint:docdb:log', this.exec, this);
   }

   /**
    * Show invalid lint code.
    *
    * @param {Array<{doc: DocObject, node: ASTNode, codeParams: string[], docParams: string[]}>} results - target
    *
    * @private
    */
   _showResult(results)
   {
      // Early out if there are no results to show.
      if (results.length <= 0) { return; }

      const config = this._eventbus.triggerSync('tjsdoc:data:config:get');

      this._eventbus.trigger('log:warn:raw', '\n[33m==================================[0m');
      this._eventbus.trigger('log:warn:raw', `[33mLintDocLogger warnings:[0m`);
      this._eventbus.trigger('log:warn:raw', '[33m==================================[0m');

      for (const result of results)
      {
         const doc = result.doc;
         const node = result.node;
         const filePath = doc.longname.split('~')[0];
         const name = doc.longname.split('~')[1];
         const absFilePath = path.resolve(config._dirPath, filePath);

         const comment = this._eventbus.triggerSync('tjsdoc:ast:get:file:comment:and:first:line:from:node',
          absFilePath, node);

         this._eventbus.trigger('log:warn:raw',
          `\n[33mwarning: signature mismatch: ${name} ${filePath}#${comment.startLine}[32m`);

         this._eventbus.trigger('log:warn:raw', `[32m${comment.text}[0m'`);
      }
   }
}
