/**
 * Provides utilities to traverse in memory code and files for main and test parsing generating DocObject and AST data.
 */
export default class TraverseUtil
{
   /**
    * Provides eventbus bindings for traversing in memory code and files for main and test parsing generating DocObject
    * and AST data.
    *
    * @param {PluginEvent}    ev - The plugin eventbus proxy.
    */
   onPluginLoad(ev)
   {
      /**
       * Stores the plugin eventbus proxy.
       * @type {EventProxy}
       */
      this._eventbus = ev.eventbus;

      this._eventbus.on('tjsdoc:traverse:code', this.traverseCode, this);
      this._eventbus.on('tjsdoc:traverse:file', this.traverseFile, this);
      this._eventbus.on('tjsdoc:traverse:test', this.traverseTest, this);
   }

   /**
    * Traverse doc comments in given code.
    *
    * @param {string}      inDirPath - root directory path.
    *
    * @param {object|string}  code - target JavaScript code.
    *
    *
    * @returns {Object} - return document that is traversed.
    *
    * @property {DocObject[]} docData - this is contained JavaScript file.
    *
    * @property {AST} ast - this is AST of JavaScript file.
    *
    * @private
    */
   traverseCode(inDirPath, code)
   {
      let ast;

      let actualCode;
      let filePath = 'unknown';
      let message;

      if (typeof code === 'string') { actualCode = code; }

      // A code instance can be an object with an optional message to be displayed with any error.
      if (typeof code === 'object')
      {
         if (typeof code.code === 'string') { actualCode = code.code; }
         if (typeof code.message === 'string') { message = code.message; }
         if (typeof code.filePath === 'string') { filePath = code.filePath; }
      }

      try
      {
         ast = this._eventbus.triggerSync('tjsdoc:parse:code', actualCode);
      }
      catch (parserError)
      {
         this._eventbus.trigger('tjsdoc:add:invalid:code', { code: actualCode, filePath, message, parserError });

         return null;
      }

      const factory = this._eventbus.triggerSync('tjsdoc:create:code:doc:factory', ast, actualCode, inDirPath,
       filePath);

      this._eventbus.trigger('ast:walker:traverse', ast,
      {
         enterNode: (node, parent) =>
         {
            try
            {
               factory.push(node, parent);
            }
            catch (fatalError)
            {
               this._eventbus.trigger('tjsdoc:add:invalid:code', { code: actualCode, message, node, fatalError });
            }
         }
      });

      return { docData: factory.docData, ast };
   }

   /**
    * Traverse doc comments in given file.
    *
    * @param {string}      inDirPath - root directory path.
    *
    * @param {string}      filePath - target JavaScript file path.
    *
    * @param {string}      [packageName] - npm package name of target.
    *
    * @param {string}      [mainFilePath] - npm main file path of target.
    *
    *
    * @returns {Object} - return document that is traversed.
    *
    * @property {DocObject[]} docData - this is contained JavaScript file.
    *
    * @property {AST} ast - this is AST of JavaScript file.
    *
    * @private
    */
   traverseFile(inDirPath, filePath, packageName, mainFilePath)
   {
      let ast;

      try
      {
         ast = this._eventbus.triggerSync('tjsdoc:parse:file', filePath);
      }
      catch (parserError)
      {
         this._eventbus.trigger('tjsdoc:add:invalid:code', { filePath, parserError });

         return null;
      }

      const factory = this._eventbus.triggerSync('tjsdoc:create:file:doc:factory', ast, inDirPath, filePath,
       packageName, mainFilePath);

      this._eventbus.trigger('ast:walker:traverse', ast,
      {
         enterNode: (node, parent) =>
         {
            try
            {
               factory.push(node, parent);
            }
            catch (fatalError)
            {
               this._eventbus.trigger('tjsdoc:add:invalid:code', { filePath, node, fatalError });
            }
         }
      });

      return { docData: factory.docData, ast };
   }

   /**
    * Traverse doc comments in test code files.
    *
    * @param {string}      type - test code type.
    *
    * @param {string}      inDirPath - root directory path.
    *
    * @param {string}      filePath - target test code file path.
    *
    *
    * @returns {Object} return document info that is traversed.
    *
    * @property {DocObject[]} docData - this is contained test code.
    *
    * @property {AST} ast - this is AST of test code.
    *
    * @private
    */
   traverseTest(type, inDirPath, filePath)
   {
      let ast;

      try
      {
         ast = this._eventbus.triggerSync('tjsdoc:parse:file', filePath);
      }
      catch (parserError)
      {
         this._eventbus.trigger('tjsdoc:add:invalid:code', { filePath, parserError });

         return null;
      }

      const factory = this._eventbus.triggerSync('tjsdoc:create:test:doc:factory', type, ast, inDirPath, filePath);

      this._eventbus.trigger('ast:walker:traverse', ast,
      {
         enterNode: (node, parent) =>
         {
            try
            {
               factory.push(node, parent);
            }
            catch (fatalError)
            {
               this._eventbus.trigger('tjsdoc:add:invalid:code', { filePath, node, fatalError });
            }
         }
      });

      return { docData: factory.docData, ast };
   }
}
