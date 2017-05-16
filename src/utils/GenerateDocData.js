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
       * @type {DocGenerator}
       * @private
       */
      this._docGenerator = ev.eventbus.triggerSync('tjsdoc:system:doc:generator:get');

      /**
       * @type {TestDocGenerator}
       * @private
       */
      this._testDocGenerator = ev.eventbus.triggerSync('tjsdoc:system:doc:generator:test:get');

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

      /**
       * A recycled path resolver instance to repeatedly use.
       * @type {Resolver}
       */
      this._pathResolver = new Resolver(this._rootPath, '', this._packageName, this._mainFilePath);
   }

   /**
    * Generates doc data from the given source code.
    *
    * @param {string}         code - Source code to parse.
    *
    * @param {DocDB}          [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {TyphonEvents}   [eventbus] - An eventbus instance to set for any created DocDB instance.
    *
    * @param {string}         [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                 with the default being to throw any errors encountered.
    *
    * @returns {*}
    */
   generateCodeDocData({ code = void 0, docDB = void 0, eventbus = void 0, handleError = 'throw' } = {})
   {
      if (typeof code !== 'string' && typeof code !== 'object')
      {
         throw new TypeError(`'code' is not a 'string' or 'object'.`);
      }

      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      // When creating a new DocDB when one is not provided optionally also attach an eventbus.
      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create', { eventbus });

      if (typeof docDB !== 'object') { throw new TypeError(`'docDB' is not an 'object'.`); }

      this._resetAndTraverse(this._docGenerator, docDB, handleError, void 0, code);

      return docDB;
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}         filePath - Doc data is generated from this file path.
    *
    * @param {DocDB}          [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {TyphonEvents}   [eventbus] - An eventbus instance to set for any created DocDB instance.
    *
    * @param {string}         [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @param {boolean}        [silent=false] - If true a log statement is not emitted.
    *
    * @returns {*}
    */
   generateFileDocData(
    { filePath = void 0, docDB = void 0, eventbus = void 0, handleError = 'throw', silent = false } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create', { eventbus });

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

      if (!silent) { this._eventbus.trigger('log:info:raw', `tjsdoc-docdb-generate - parse: ${filePath}`); }

      this._resetAndTraverse(this._docGenerator, docDB, handleError, filePath);

      return docDB;
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}         filePath - Doc data is generated from this file path.
    *
    * @param {DocDB}          [docDB] - The target DocDB instance; or one will be created.
    *
    * @param {TyphonEvents}   [eventbus] - An eventbus instance to set for any created DocDB instance.
    *
    * @param {string}         [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                 with the default being to throw any errors encountered.
    *
    * @param {boolean}        [silent=false] - If true a log statement is not emitted.
    *
    * @returns {*}
    */
   generateTestDocData(
    { filePath = void 0, docDB = void 0, eventbus = void 0, handleError = 'throw', silent = false } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      docDB = docDB ? docDB : this._eventbus.triggerSync('tjsdoc:system:docdb:create', { eventbus });

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

      if (!silent) { this._eventbus.trigger('log:info:raw', `tjsdoc-docdb-generate - parse: ${filePath}`); }

      this._resetAndTraverse(this._testDocGenerator, docDB, handleError, filePath);

      return docDB;
   }

   /**
    * Resets the given static doc generator and traverses the AST for doc object / DocDB insertion.
    *
    * @param {DocGenerator|TestDocGenerator} docGenerator - Target doc generator to reset.
    *
    * @param {DocDB}                         docDB - Target DocDB.
    *
    * @param {string}                        handleError - 'log' or 'throw' determines how any errors are handled.
    *
    * @param {string|undefined}              filePath - Target file path.
    *
    * @param {string}                        [code] - Target in memory code.
    *
    * @returns {*}
    * @private
    */
   _resetAndTraverse(docGenerator, docDB, handleError, filePath, code)
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
            ast = this._eventbus.triggerSync('tjsdoc:system:parser:code:source:parse', actualCode);
         }
         catch (parserError)
         {
            switch (handleError)
            {
               case 'log':
                  this._eventbus.trigger('tjsdoc:system:invalid:code:add',
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
            ast = this._eventbus.triggerSync('tjsdoc:system:parser:code:file:parse', filePath);
         }
         catch (parserError)
         {
            switch (handleError)
            {
               case 'log':
                  this._eventbus.trigger('tjsdoc:system:invalid:code:add', { filePath, parserError });
                  return;

               case 'throw':
                  throw parserError;
            }
         }
      }

      this._pathResolver.setPathData(this._rootPath, filePath, this._packageName, this._mainFilePath);

      docGenerator.resetAndTraverse(ast, docDB, this._pathResolver, this._eventbus, handleError, actualCode);
   }
}
