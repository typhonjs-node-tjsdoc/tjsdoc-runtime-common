import path       from 'path';
import Resolver   from 'typhonjs-path-resolver';

/**
 * Provides event bindings to generate DocObject and AST data for in memory code and files for main and tests.
 */
export default class GenerateDocData
{
   /**
    * Provides eventbus bindings for generating DocObject and AST data for in memory code and files for main and tests.
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

      this._eventbus.on('tjsdoc:system:generate:code:doc:data', this.generateCodeDocData, this);
      this._eventbus.on('tjsdoc:system:generate:file:doc:data', this.generateFileDocData, this);
      this._eventbus.on('tjsdoc:system:generate:test:doc:data', this.generateTestDocData, this);

      this._eventbus.on('tjsdoc:system:path:resolver:create',
       (filePath, rootPath = this._rootPath, packageName = this._packageName, mainFilePath = this._mainFilePath) =>
      {
         return new Resolver(rootPath, filePath, packageName, mainFilePath);
      });
   }

   /**
    * Store the TJSDocConfig object and other relevant data for generating doc data.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPreGenerate(ev)
   {
      /**
       * @type {TJSDocConfig}
       * @private
       */
      this._config = ev.data.config;

      /**
       * @type {DocFactory}
       * @private
       */
      this._docFactory = ev.eventbus.triggerSync('tjsdoc:system:doc:factory:get');

      /**
       * @type {TestDocFactory}
       * @private
       */
      this._testDocFactory = ev.eventbus.triggerSync('tjsdoc:system:doc:factory:test:get');

      /**
       * The target project current working directory.
       * @type {string}
       */
      this._rootPath = ev.data.config._dirPath;

      /**
       * The target project NPM package name.
       * @type {string}
       */
      this._packageName = ev.data.packageObj.name || void 0;

      /**
       * The target project NPM main file path.
       * @type {string}
       */
      this._mainFilePath = ev.data.packageObj.main || void 0;

      this._pathResolver = new Resolver(this._rootPath, '', this._packageName, this._mainFilePath);
   }

   /**
    * Generates doc data from the given source code.
    *
    * @param {string}   code - Source code to parse.
    *
    * @param {DocDB}    [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {string}   [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                           with the default being to throw any errors encountered.
    *
    * @returns {*}
    */
   generateCodeDocData({ code = void 0, docDB = void 0, handleError = 'throw' } = {})
   {
      if (typeof code !== 'string' && typeof code !== 'object')
      {
         throw new TypeError(`'code' is not a 'string' or 'object'.`);
      }

      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create');

      if (typeof docDB !== 'object') { throw new TypeError(`'docDB' is not an 'object'.`); }

      this._resetDocFactory(this._docFactory, docDB, this._eventbus, handleError, void 0, code);

      // Traverse the code generating doc data.
      s_TRAVERSE(this._docFactory, this._eventbus, handleError);

      return docDB;
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}   filePath - Doc data is generated from this file path.
    *
    * @param {DocDB}    [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {string}   [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @param {boolean}  [log=true] - If true a log statement is emitted.
    *
    * @returns {*}
    */
   generateFileDocData({ filePath = void 0, docDB = void 0, handleError = 'throw', log = true } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create');

      if (typeof docDB !== 'object') { throw new TypeError(`'docDB' is not an 'object'.`); }

      const relativeFilePath = path.relative(this._config._dirPath, filePath);

      let match = false;

      // Match filePath against any includes / excludes RegExp instance.
      for (const reg of this._config._includes)
      {
         if (relativeFilePath.match(reg))
         {
            match = true;
            break;
         }
      }

      if (!match) { return void 0; }

      for (const reg of this._config._excludes)
      {
         if (relativeFilePath.match(reg)) { return void 0; }
      }

      if (log) { this._eventbus.trigger('log:info:raw', `parse: ${filePath}`); }

      this._resetDocFactory(this._docFactory, docDB, this._eventbus, handleError, filePath);

      // Traverse the file generating doc data.
      s_TRAVERSE(this._docFactory, this._eventbus, handleError);

      return docDB;
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}   filePath - Doc data is generated from this file path.
    *
    * @param {DocDB}    [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {string}   [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @param {boolean}  [log=true] - If true a log statement is emitted.
    *
    * @returns {*}
    */
   generateTestDocData({ filePath = void 0, docDB = void 0, handleError = 'throw', log = true } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create');

      if (typeof docDB !== 'object') { throw new TypeError(`'docDB' is not an 'object'.`); }

      const relativeFilePath = path.relative(this._config._dirPath, filePath);

      let match = false;

      for (const reg of this._config.test._includes)
      {
         if (relativeFilePath.match(reg))
         {
            match = true;
            break;
         }
      }

      if (!match) { return void 0; }

      for (const reg of this._config.test._excludes)
      {
         if (relativeFilePath.match(reg)) { return void 0; }
      }

      if (log) { this._eventbus.trigger('log:info:raw', `parse: ${filePath}`); }

      this._resetDocFactory(this._testDocFactory, docDB, this._eventbus, handleError, filePath);

      // Traverse the file generating doc data.
      s_TRAVERSE(this._testDocFactory, this._eventbus, handleError);

      return docDB;
   }

   /**
    * Resets the given static doc factory
    *
    * @param {DocFactory|TestDocFactory}  docFactory - Target doc factory to reset.
    *
    * @param {DocDB}                      docDB - Target DocDB.
    *
    * @param {EventProxy}                 eventbus - The plugin eventbus proxy.
    *
    * @param {string}                     handleError - 'log' or 'throw' determines how any errors are handled.
    *
    * @param {string|undefined}           filePath - Target file path.
    *
    * @param {string}                     [code] - Target in memory code.
    *
    * @returns {*}
    * @private
    */
   _resetDocFactory(docFactory, docDB, eventbus, handleError, filePath, code)
   {
      let ast;
      let actualCode;

      if (code)
      {
         filePath = 'unknown';

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
            ast = eventbus.triggerSync('tjsdoc:system:parser:code:source:parse', actualCode);
         }
         catch (parserError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add',
                   { code: actualCode, filePath, message, parserError });
                  return void 0;

               case 'throw':
                  throw parserError;
            }
         }
      }
      else
      {
         try
         {
            ast = eventbus.triggerSync('tjsdoc:system:parser:code:file:parse', filePath);
         }
         catch (parserError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add', { filePath, parserError });
                  return;

               case 'throw':
                  throw parserError;
            }
         }
      }

      this._pathResolver.setPathData(this._rootPath, filePath, this._packageName, this._mainFilePath);

      docFactory.reset(ast, docDB, this._pathResolver, eventbus, actualCode);
   }
}

// Module private ---------------------------------------------------------------------------------------------------

/**
 * Traverse doc comments in given file.
 *
 * @param {DocFactory|TestDocFactory}  docFactory - Target doc factory to reset.
 *
 * @param {EventProxy}  eventbus - The plugin event proxy.
 *
 * @param {string}      handleError - Determines how to handle errors. Options are `log` and `throw` with the
 *                                    default being to throw any errors encountered.
 * @private
 */
const s_TRAVERSE = (docFactory, eventbus, handleError) =>
{
   eventbus.trigger('typhonjs:ast:walker:traverse', docFactory.ast,
   {
      enterNode: (node, parent) =>
      {
         try
         {
            docFactory.push(node, parent);
         }
         catch (fatalError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add',
                   { filePath: docFactory.filePath, node, fatalError });
                  break;

               case 'throw':
                  throw fatalError;
            }
         }
      }
   });
};
