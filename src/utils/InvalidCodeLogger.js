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
    * Add invalid code data. While most provided data is optional the following entries are
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

      // Determine type of invalid code.
      const type = data.code ? 'code' : 'file';

      // Immediately build the formatted log output entry and store. This allows any given data including AST nodes to
      // not be retained.
      this._invalidCode.push(this._buildEntryDispatch(Object.assign({}, data, { _output: '', type })));
   }

   /**
    * Builds the output message for warnings and errors then returns the minimal entry object hash containing the
    * constructed log message output.
    *
    * @param {object}   entry - Invalid code entry.
    *
    * @returns{object}
    * @private
    */
   _buildEntryDispatch(entry)
   {
      // Separate errors generated from internal failures of TJSDoc.
      if (typeof entry.fatalError === 'undefined')
      {
         // warning title (yellow), body (light yellow)
         this._buildEntry(entry, 'warning:', '[33m', '[32m');
      }
      else
      {
         // error title (red), body (light red)
         this._buildEntry(entry, 'error:', '[31m', '[1;31m');
      }

      return { fatalError: entry.fatalError, output: entry._output };
   }

   /**
    * Controls the output message building for an invalid code entry.
    *
    * @param {object}   entry - An invalid code entry to log.
    *
    * @param {string}   label - A label to lead the log entry.
    *
    * @param {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param {string}   bodyColor - ANSI color to apply to body of entry.
    */
   _buildEntry(entry, label, headerColor, bodyColor)
   {
      entry._output += `\n${headerColor}${label} could not process the following code.[0m\n`;

      if (typeof entry.message !== 'undefined') { entry._output += `${headerColor}${entry.message}[0m\n`; }
      if (typeof entry.filePath !== 'undefined') { entry._output += `${headerColor}${entry.filePath}[0m\n`; }

      switch (entry.type)
      {
         case 'code':
            if (entry.node)
            {
               this._buildCodeNode(entry, bodyColor);
            }
            else if (entry.parserError)
            {
               this._buildCodeParserError(entry, headerColor, bodyColor);
            }
            break;

         case 'file':
            if (entry.parserError)
            {
               this._buildFileParserError(entry, headerColor, bodyColor);
            }
            else if (entry.node)
            {
               this._buildFileNode(entry, bodyColor);
            }
            break;
      }
   }

   /**
    * Builds invalid code entry from in memory code from a parser error.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {object}   parserError - Parser error object.
    *
    * @param      {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _buildCodeParserError(entry, headerColor, bodyColor)
   {
      if (typeof entry.parserError.message !== 'undefined')
      {
         entry._output += `${headerColor}${entry.parserError.message}[0m\n`;
      }

      const lines = entry.code.split('\n');
      const start = Math.max(entry.parserError.line - 5, 0);
      const end = Math.min(entry.parserError.line + 3, lines.length);
      const targetLines = [];

      for (let cntr = start; cntr < end; cntr++) { targetLines.push(`${cntr + 1}| ${lines[cntr]}`); }

      entry._output += `${bodyColor}${targetLines.join('\n')}[0m`;
   }

   /**
    * Builds invalid code entry from in memory code from an AST node.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {ASTNode}  node - An AST node to use to find comments and first line of node.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _buildCodeNode(entry, bodyColor)
   {
      const result = this._eventbus.triggerSync('tjsdoc:system:ast:code:comment:first:line:from:node:get',
       entry.node, entry.code, true);

      entry._output += `${bodyColor}${result.text}[0m`;
   }

   /**
    * Builds invalid code entry from a file and a parser error.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {object}   parserError - Parser error object.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   headerColor - ANSI color to apply for header entry / message.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _buildFileParserError(entry, headerColor, bodyColor)
   {
      if (typeof entry.parserError.message !== 'undefined')
      {
         entry._output += `${headerColor}${entry.parserError.message}[0m\n`;
      }

      const start = entry.parserError.line - 5;
      const end = entry.parserError.line + 3;

      const targetLines = this._eventbus.triggerSync('typhonjs:util:file:lines:read', entry.filePath, start, end);

      entry._output += `${bodyColor}${targetLines.join('\n')}[0m`;
   }

   /**
    * Builds invalid code entry from a file and an AST node.
    *
    * @param      {object}   entry - A data entry with `code`, `parseError`.
    *
    * @property   {object}   code - Code to parse / log.
    *
    * @property   {ASTNode}  node - An AST node to use to find comments and first line of node.
    *
    * @property   {string}   [message] - Additional message to prepend.
    *
    * @param      {string}   bodyColor - An ANSI color code to apply to the body.
    */
   _buildFileNode(entry, bodyColor)
   {
      const result = this._eventbus.triggerSync('tjsdoc:system:ast:file:comment:first:line:from:node:get',
       entry.node, entry.filePath, true);

      entry._output += `${bodyColor}${result.text}[0m`;
   }

   /**
    * Logs all invalid code previously added. Entries without `error.fatalError` defined are output first as warnings
    * and any entries with `error.fatalError` defined are output last as errors in addition to logging the fatal error.
    *
    * The log is automatically reset unless reset is `false`.
    *
    * @param {boolean}  [reset=true] - If true the stored invalid code log entries are deleted after logging.
    */
   logInvalidCode(reset = true)
   {
      // Separate errors generated from internal failures of TJSDoc.
      const nonFatalEntries = this._invalidCode.filter((entry) => { return typeof entry.fatalError === 'undefined'; });
      const fatalEntries = this._invalidCode.filter((entry) => { return typeof entry.fatalError !== 'undefined'; });

      if (nonFatalEntries.length > 0)
      {
         this._eventbus.trigger('log:warn:raw', '\n[33m==================================[0m');
         this._eventbus.trigger('log:warn:raw', `[32mInvalidCodeLogger warnings[0m`);
         this._eventbus.trigger('log:warn:raw', '[33m==================================[0m');

         for (const entry of nonFatalEntries) { this._eventbus.trigger('log:warn:raw', entry.output); }
      }

      if (fatalEntries.length > 0)
      {
         this._eventbus.trigger('log:error:raw', '\n[31m==================================[0m');
         this._eventbus.trigger('log:error:raw', `[1;31mInvalidCodeLogger errors (internal TJSDoc failure)\n[0m`);
         this._eventbus.trigger('log:error:raw',
          `[1;31mPlease report an issue after checking if a similar one already exists:[0m`);
         this._eventbus.trigger('log:error:raw', `[1;31mhttps://github.com/typhonjs-doc/tjsdoc/issues[0m`);
         this._eventbus.trigger('log:error:raw', '[31m==================================[0m');

         for (const entry of fatalEntries)
         {
            this._eventbus.trigger('log:error:raw', entry.output);
            this._eventbus.trigger('log:error', entry.fatalError);
         }
      }

      if (reset) { this._invalidCode.length = 0; }
   }

   /**
    * Wires up InvalidCodeLogger on the plugin eventbus. The following event bindings are available:
    *
    * `tjsdoc:system:invalid:code:add`: Takes a data object which adds an invalid code object to be stored.
    *
    * `tjsdoc:system:invalid:code:clear`: Clears any currently logged invalid code.
    *
    * `tjsdoc:system:invalid:code:log`: Logs any accumulated invalid code.
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

      this._eventbus.on('tjsdoc:system:invalid:code:add', this.addInvalidCode, this);

      this._eventbus.on('tjsdoc:system:invalid:code:reset', this.resetLog, this);

      this._eventbus.on('tjsdoc:system:invalid:code:log', this.logInvalidCode, this);
   }

   /**
    * Clears any logged invalid code.
    */
   resetLog()
   {
      this._invalidCode.length = 0;
   }
}

