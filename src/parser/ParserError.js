/**
 * Provides a generic parser error with start and end lines for the error.
 */
export default class ParserError extends Error
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
