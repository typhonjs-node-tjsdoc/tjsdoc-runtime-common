/**
 * Provides a generic parser error with start and end lines for the error.
 */
export class ParserError extends Error
{
   /**
    * Instantiate ParserError.
    *
    * @param {number}   line - The line of the error.
    * @param {number}   column - The column of the error.
    * @param {string}   [message] - An extra message.
    * @param {number}   [position] - The character position of the error.
    * @param {string}   [fileName] - The file name where the error occurs.
    */
   constructor(line = 0, column = 0, message = void 0, position = void 0, fileName = void 0)
   {
      super(message, fileName, line);

      /**
       * The line of the error.
       * @type {number}
       */
      this.line = line;

      /**
       * The column of the error.
       * @type {number}
       */
      this.column = column;

      /**
       * The character position of the error.
       * @type {number}
       */
      this.position = position;

      Object.freeze(this);
   }
}

/**
 * When module loaded as a plugin add event binding to create a ParserError.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPluginLoad(ev)
{
   /**
    * Provides an event binding to create a ParserError.
    */
   ev.eventbus.on('tjsdoc:error:parser:create',
    ({ line = void 0, column = void 0, message = void 0, position = void 0, fileName = void 0 } = {}) =>
   {
      if (!Number.isInteger(line)) { throw new TypeError(`'line' is not an 'integer'`); }
      if (!Number.isInteger(column)) { throw new TypeError(`'column' is not an 'integer'`); }

      return new ParserError(line, column, message, position, fileName);
   });
}
