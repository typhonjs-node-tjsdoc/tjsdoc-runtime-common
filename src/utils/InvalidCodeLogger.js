/**
 * Logs invalid code.
 */
export default class InvalidCodeLogger
{
   /**
    * Instantiates InvalidCodeLogger
    */
   constructor()
   {
      /**
       * Stores invalid code entries.
       * @type {Array}
       * @private
       */
      this._invalidCode = [];
   }

   /**
    * Helper event binding to add invalid code data. While most provided data is optional the following entries are
    * mandatory: either `filePath` or `code` in addition to `node`, `parseError`, or `fatalError` must be defined.
    *
    * @param {object}      data - The data object containing info or the invalid code.
    *
    * @property {string}   [filePath] - The file path of traversal failure or in memory code.
    *
    * @property {string}   [code] - The file path of traversal failure or in memory code.
    *
    * @property {ASTNode}  [message] - An optional message.
    *
    * @property {ASTNode}  [node] - The AST node where traversal failed.
    *
    * @property {object}   [parseError] - Error from parser.
    *
    * @property {Error}    [fatalError] - Any associated fatal error.
    */
   addInvalidCode(data = {})
   {
      if (typeof data !== 'object') { throw new TypeError(`'data' is not an 'object'.`); }

      if (typeof data.type !== 'undefined')
      {
         throw new ReferenceError(`'data.type' is automatically assigned; please remove it.`);
      }

      if (typeof data.filePath !== 'string' && typeof data.code !== 'string')
      {
         throw new ReferenceError(`'data.filePath' or 'data.code' is required to be a 'string'.`);
      }

      if (data.node && typeof data.node !== 'object') { throw new TypeError(`'data.parseError' is not an 'object'.`); }

      if (data.parserError && typeof data.parserError !== 'object')
      {
         throw new TypeError(`'data.parserError' is not an 'object'.`);
      }

      if (data.fatalError && !(data.fatalError instanceof Error))
      {
         throw new TypeError(`'data.fatalError' is not an 'Error'.`);
      }

      if (typeof data.filePath !== 'string' && typeof data.code !== 'string')
      {
         throw new Error(`'data.filePath' or 'data.code' is required to be a 'string'.`);
      }

      if (typeof data.node !== 'object' && typeof data.fatalError !== 'object' && typeof data.parserError !== 'object')
      {
         throw new ReferenceError(
          `'data.fatalError', 'data.node', or 'data.parserError' is required to be an 'object'.`);
      }

      // If parser error is not a specific instance of ParserError then make it a fatal error.
      // In this case there is a Babel issue with builtin extensions so instead of instanceof check we check for
      // the existence of `parserError.line|column`.
      // Please see: https://github.com/babel/babel/issues/3083
      if (data.parserError && typeof data.parserError.line !== 'number' && typeof data.parserError.column !== 'number')
      {
         data.fatalError = data.parseError;

         delete data.parserError;
      }

      if (typeof data.node === 'object')
      {
         // Make a copy of the node
         data.node = JSON.parse(JSON.stringify(data.node));

         // Sanitize node removing all children except comments, type, and range data.
         this._eventbus.trigger('tjsdoc:ast:node:sanitize:children', data.node);
      }

      // Determine type of invalid code.
      const type = data.code ? 'code' : 'file';

      this._invalidCode.push(Object.assign({ type }, data));
   }

   /**
    * Clears any logged invalid code.
    */
   clearLog()
   {
      this._invalidCode = [];
   }

   /**
    * Logs all invalid code previously added. Entries without `error.fatalError` defined are output first as warnings
    * and any entries with `error.fatalError` defined are output last as errors in addition to logging the fatal error.
    */
   logInvalidCode()
   {
      // Separate errors generated from internal failures of TJSDoc.
      const nonFatalEntries = this._invalidCode.filter((entry) => { return typeof entry.fatalError === 'undefined'; });
      const fatalEntries = this._invalidCode.filter((entry) => { return typeof entry.fatalError !== 'undefined'; });

      if (nonFatalEntries.length > 0)
      {
         this._eventbus.trigger('log:warn:raw', '\n[33m==================================[0m');
         this._eventbus.trigger('log:warn:raw', `[32mInvalidCodeLogger warnings[0m`);
         this._eventbus.trigger('log:warn:raw', '[33m==================================[0m');

         // warning title (yellow), body (light yellow)
         this._showEntries(nonFatalEntries, 'warning:', 'log:warn:raw', '[33m', '[32m');
      }

      if (fatalEntries.length > 0)
      {
         this._eventbus.trigger('log:error:raw', '\n[31m==================================[0m');
         this._eventbus.trigger('log:error:raw', `[1;31mInvalidCodeLogger errors (internal TJSDoc failure)\n[0m`);
         this._eventbus.trigger('log:error:raw',
          `[1;31mPlease report an issue after checking if a similar one already exists:[0m`);
         this._eventbus.trigger('log:error:raw', `[1;31mhttps://github.com/typhonjs-doc/tjsdoc/issues[0m`);
         this._eventbus.trigger('log:error:raw', '[31m==================================[0m');

         // error title (red), body (light red)
         this._showEntries(fatalEntries, 'error:', 'log:error:raw', '[31m', '[1;31m');
      }
   }

   /**
    * Wires up InvalidCodeLogger on the plugin eventbus. The following event bindings are available:
    *
    * `tjsdoc:invalid:code:add`: Takes a data object which adds an invalid code object to be stored.
    *
    * `tjsdoc:invalid:code:clear`: Clears any currently logged invalid code.
    *
    * `tjsdoc:invalid:code:log`: Invokes `log:error:raw` or `log:warn:raw` with the formatted data.
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

      this._eventbus.on('tjsdoc:invalid:code:add', this.addInvalidCode, this);

      this._eventbus.on('tjsdoc:invalid:code:clear', this.clearLog, this);

      this._eventbus.on('tjsdoc:invalid:code:log', this.logInvalidCode, this);
   }

   /**
    * Logs an array of invalid code entries.
    *
    * @param {Array}    entries - An array of invalid code entries to log.
    *
    * @param {string}   label - A label to lead the log entry.
    *
    * @param {string}   event - Log event to invoke.
    *
    * @param {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param {string}   bodyColor - ANSI color to apply to body of entry.
    */
   _showEntries(entries, label, event, headerColor, bodyColor)
   {
      for (const entry of entries)
      {
         this._eventbus.trigger(event, `\n${headerColor}${label} could not process the following code.[0m`);

         if (typeof entry.message !== 'undefined')
         {
            this._eventbus.trigger(event, `${headerColor}${entry.message}[0m`);
         }

         if (typeof entry.filePath !== 'undefined')
         {
            this._eventbus.trigger(event, `${headerColor}${entry.filePath}[0m`);
         }

         switch (entry.type)
         {
            case 'code':
               if (entry.node)
               {
                  this._showCodeNode(entry, event, bodyColor);
               }
               else if (entry.parserError)
               {
                  this._showCodeParserError(entry, event, headerColor, bodyColor);
               }
               break;

            case 'file':
               if (entry.parserError)
               {
                  this._showFileParserError(entry, event, headerColor, bodyColor);
               }
               else if (entry.node)
               {
                  this._showFileNode(entry, event, bodyColor);
               }
               break;
         }

         // Output any fatal error after logging the invalid code.
         if (entry.fatalError) { this._eventbus.trigger('log:error', entry.fatalError); }
      }
   }

   /**
    * Show invalid code entry from in memory code from a parser error.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {object}   parserError - Parser error object.
    *
    * @param      {string}   event - The log event to invoke.
    *
    * @param      {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _showCodeParserError(entry, event, headerColor, bodyColor)
   {
      if (typeof entry.parserError.message !== 'undefined')
      {
         this._eventbus.trigger(event, `${headerColor}${entry.parserError.message}[0m`);
      }

      const lines = entry.code.split('\n');
      const start = Math.max(entry.parserError.line - 5, 0);
      const end = Math.min(entry.parserError.line + 3, lines.length);
      const targetLines = [];

      for (let cntr = start; cntr < end; cntr++) { targetLines.push(`${cntr + 1}| ${lines[cntr]}`); }

      this._eventbus.trigger(event, `${bodyColor}${targetLines.join('\n')}[0m`);
   }

   /**
    * Show invalid code entry from in memory code from an AST node.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {ASTNode}  node - An AST node to use to find comments and first line of node.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   event - The log event to invoke.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _showCodeNode(entry, event, bodyColor)
   {
      const result = this._eventbus.triggerSync('tjsdoc:ast:get:code:comment:and:first:line:from:node', entry.code,
       entry.node, true);

      this._eventbus.trigger(event, `${bodyColor}${result.text}[0m`);
   }

   /**
    * Show invalid code entry from a file and a parser error.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {object}   parserError - Parser error object.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   event - The log event to invoke.
    *
    * @param      {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _showFileParserError(entry, event, headerColor, bodyColor)
   {
      if (typeof entry.parserError.message !== 'undefined')
      {
         this._eventbus.trigger(event, `${headerColor}${entry.parserError.message}[0m`);
      }

      const start = entry.parserError.line - 5;
      const end = entry.parserError.line + 3;

      const targetLines = this._eventbus.triggerSync('typhonjs:util:file:read:lines', entry.filePath, start, end);

      this._eventbus.trigger(event, `${bodyColor}${targetLines.join('\n')}[0m`);
   }

   /**
    * Show invalid code entry from a file and an AST node.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {ASTNode}  node - An AST node to use to find comments and first line of node.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   event - The log event to invoke.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _showFileNode(entry, event, bodyColor)
   {
      const result = this._eventbus.triggerSync('tjsdoc:ast:get:file:comment:and:first:line:from:node', entry.filePath,
       entry.node, true);

      this._eventbus.trigger(event, `${bodyColor}${result.text}[0m`);
   }
}

