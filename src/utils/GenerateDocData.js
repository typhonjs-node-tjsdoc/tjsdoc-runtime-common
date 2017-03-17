import path             from 'path';

import ASTNodeContainer from './ASTNodeContainer.js';

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
   }

   /**
    * Store TJSDocConfig object.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onStart(ev)
   {
      /**
       * @type {TJSDocConfig}
       * @private
       */
      this._config = ev.data.config;
   }

   /**
    * Generates doc data from the given source code.
    *
    * @param {string}            code - Source code to parse.
    *
    * @param {DocObject[]}       [docData] - DocObject data is pushed to this array.
    *
    * @param {ASTData[]}         [astData] - AST data is pushed to this array.
    *
    * @param {ASTNodeContainer}  [astNodeContainer] - All doc object AST nodes are added to this object.
    *
    * @param {string}            [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @returns {*}
    */
   generateCodeDocData({ code = void 0, docData = [], astData = [], astNodeContainer = new ASTNodeContainer(),
    handleError = 'throw' } = {})
   {
      // Traverse the file generating doc data.
      const result = s_TRAVERSE_CODE(code, astNodeContainer, this._eventbus, handleError);

      // Push any generated doc and AST data output.
      if (result)
      {
         docData.push(...result.docData);

         astData.push({ filePath: 'unknown', ast: result.ast });
      }

      return { docData, astData, astNodeContainer };
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}            filePath - Doc data is generated from this file path.
    *
    * @param {DocObject[]}       [docData] - DocObject data is pushed to this array.
    *
    * @param {ASTData[]}         [astData] - AST data is pushed to this array.
    *
    * @param {ASTNodeContainer}  [astNodeContainer] - All doc object AST nodes are added to this object.
    *
    * @param {string}            [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @param {boolean}           [log=true] - If true a log statement is emitted.
    *
    * @returns {*}
    */
   generateFileDocData({ filePath = void 0, docData = [], astData = [], astNodeContainer = new ASTNodeContainer(),
    handleError = 'throw', log = true } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (!Array.isArray(docData)) { throw new TypeError(`'docData' is not an 'array'.`); }
      if (!Array.isArray(astData)) { throw new TypeError(`'astData' is not an 'array'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

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

      // Traverse the file generating doc data.
      const result = s_TRAVERSE_FILE(filePath, astNodeContainer, this._eventbus, handleError);

      // Push any generated doc and AST data output.
      if (result)
      {
         docData.push(...result.docData);

         astData.push({ filePath: relativeFilePath, ast: result.ast });
      }

      return { docData, astData, astNodeContainer };
   }

   /**
    * Generates doc data from a file path and supporting data.
    *
    * @param {string}            filePath - Doc data is generated from this file path.
    *
    * @param {DocObject[]}       [docData] - DocObject data is pushed to this array.
    *
    * @param {ASTData[]}         [astData] - AST data is pushed to this array.
    *
    * @param {ASTNodeContainer}  [astNodeContainer] - All doc object AST nodes are added to this object.
    *
    * @param {string}            [handleError='throw'] - Determines how to handle errors. Options are `log` and `throw`
    *                                                    with the default being to throw any errors encountered.
    *
    * @param {boolean}           [log=true] - If true a log statement is emitted.
    *
    * @returns {*}
    */
   generateTestDocData({ filePath = void 0, docData = [], astData = [], astNodeContainer = new ASTNodeContainer(),
    handleError = 'throw', log = true } = {})
   {
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

      const result = s_TRAVERSE_TEST(this._config.test.type, filePath, astNodeContainer, this._eventbus, handleError);

      if (result)
      {
         docData.push(...result.docData);

         astData.push({ filePath: relativeFilePath, ast: result.ast });
      }

      return { docData, astData, astNodeContainer };
   }
}

// Module private ---------------------------------------------------------------------------------------------------

/**
 * Traverse doc comments in given code.
 *
 * @param {object|string}     code - target JavaScript code.
 *
 * @param {ASTNodeContainer}  astNodeContainer - All doc object AST nodes are added to this object.
 *
 * @param {EventProxy}        eventbus - The plugin event proxy.
 *
 * @param {string}            handleError - Determines how to handle errors. Options are `log` and `throw` with the
 *                                          default being to throw any errors encountered.
 *
 * @returns {Object} - return document that is traversed.
 *
 * @property {DocObject[]} docData - this is contained JavaScript file.
 *
 * @property {AST}         ast - this is AST of JavaScript file.
 *
 * @private
 */
const s_TRAVERSE_CODE = (code, astNodeContainer, eventbus, handleError) =>
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
      ast = eventbus.triggerSync('tjsdoc:system:parser:code:source:parse', actualCode);
   }
   catch (parserError)
   {
      switch (handleError)
      {
         case 'log':
            eventbus.trigger('tjsdoc:system:invalid:code:add', { code: actualCode, filePath, message, parserError });
            return void 0;

         case 'throw':
            throw parserError;
      }
   }

   const factory = eventbus.triggerSync('tjsdoc:system:doc:factory:code:create',
    { ast, astNodeContainer, code: actualCode, filePath });

   eventbus.trigger('typhonjs:ast:walker:traverse', ast,
   {
      enterNode: (node, parent) =>
      {
         try
         {
            factory.push(node, parent);
         }
         catch (fatalError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add', { code: actualCode, message, node, fatalError });
                  break;

               case 'throw':
                  throw fatalError;
            }
         }
      }
   });

   return { docData: factory.docData, ast };
};

/**
 * Traverse doc comments in given file.
 *
 * @param {string}            filePath - target JavaScript file path.
 *
 * @param {ASTNodeContainer}  astNodeContainer - All doc object AST nodes are added to this object.
 *
 * @param {EventProxy}        eventbus - The plugin event proxy.
 *
 * @param {string}            handleError - Determines how to handle errors. Options are `log` and `throw` with the
 *                                          default being to throw any errors encountered.
 *
 * @returns {Object} - return document that is traversed.
 *
 * @property {DocObject[]} docData - this is contained JavaScript file.
 *
 * @property {AST}         ast - this is AST of JavaScript file.
 *
 * @private
 */
const s_TRAVERSE_FILE = (filePath, astNodeContainer, eventbus, handleError) =>
{
   let ast;

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
            return void 0;

         case 'throw':
            throw parserError;
      }
   }

   const factory = eventbus.triggerSync('tjsdoc:system:doc:factory:file:create', { ast, astNodeContainer, filePath });

   eventbus.trigger('typhonjs:ast:walker:traverse', ast,
   {
      enterNode: (node, parent) =>
      {
         try
         {
            factory.push(node, parent);
         }
         catch (fatalError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add', { filePath, node, fatalError });
                  break;

               case 'throw':
                  throw fatalError;
            }
         }
      }
   });

   return { docData: factory.docData, ast };
};

/**
 * Traverse doc comments in test code files.
 *
 * @param {string}            type - test code type.
 *
 * @param {string}            filePath - target test code file path.
 *
 * @param {ASTNodeContainer}  astNodeContainer - All doc object AST nodes are added to this object.
 *
 * @param {EventProxy}        eventbus - The plugin event proxy.
 *
 * @param {string}            handleError - Determines how to handle errors. Options are `log` and `throw` with the
 *                                          default being to throw any errors encountered.
 *
 * @returns {Object} return document info that is traversed.
 *
 * @property {DocObject[]} docData - this is contained test code.
 *
 * @property {AST}         ast - this is AST of test code.
 *
 * @private
 */
const s_TRAVERSE_TEST = (type, filePath, astNodeContainer, eventbus, handleError) =>
{
   let ast;

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
            return void 0;

         case 'throw':
            throw parserError;
      }
   }

   const factory = eventbus.triggerSync('tjsdoc:system:doc:factory:test:create',
    { type, ast, astNodeContainer, filePath });

   eventbus.trigger('typhonjs:ast:walker:traverse', ast,
   {
      enterNode: (node, parent) =>
      {
         try
         {
            factory.push(node, parent);
         }
         catch (fatalError)
         {
            switch (handleError)
            {
               case 'log':
                  eventbus.trigger('tjsdoc:system:invalid:code:add', { filePath, node, fatalError });
                  break;

               case 'throw':
                  throw fatalError;
            }
         }
      }
   });

   return { docData: factory.docData, ast };
};
