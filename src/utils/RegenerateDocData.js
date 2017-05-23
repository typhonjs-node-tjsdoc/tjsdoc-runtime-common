/**
 * Controls regenerating and merging new doc data for source and test files.
 *
 * By default when regenerating new doc data the following generation options are set: `handleError='throw'` and
 * `silent=false`. This will cause an exception to be thrown on any doc parsing / generating errors and code logging is
 * disabled. It is currently not possible to set `handleError='log'` to record any code errors for logging. If silent is
 * set to true then no immediate log messages are posted for parsing regenerated files.
 *
 * The event bindings supported are:
 *
 * `tjsdoc:system:regenerate:source:doc:data` - {@link RegenerateDocData#regenerateSourceDocData}
 *
 * `tjsdoc:system:regenerate:source:doc:data` - {@link RegenerateDocData#regenerateTestDocData}
 *
 * Each of these methods / event bindings takes the following object hash (only `filePath` is required):
 * ```
 * {string}       filePath - Path to a file to regenerate (it may be relative).
 *
 * {boolean}      [dependent=true] - When set to false only the file requested is regenerated; by default any dependent
 *                                   files based on class hierarchy relationship are also regenerated.
 *
 * {DocDB}        [docDB=this._mainDocDB] - Defaults to the main runtime DocDB otherwise provide a target DocDB.
 *
 * {TyphonEvents} [eventbus=this._eventbus] - Defaults to the plugin eventbus.
 *
 * {string}       [handleError='throw'] - Defaults to the 'throw'; no other setting is currently supported.
 *
 * {function}     [docFilter] - An optional function invoked with the static doc before inserting into the given DocDB.
 *
 * {boolean}      [resolve=true] - By default after regenerating and merging the core doc resolver is triggered to
 *                                 resolve the new docs.
 *
 * {boolean}      [silent=false] - By default immediate logging will occur for each file processed.
 * ```
 *
 * It currently isn't possible to incrementally regenerate virtual in memory code as the merging process of regenerated
 * doc objects requires a file path.
 *
 * When regeneration for a file is requested a DocDB will be created for new doc data generated and inserted after
 * removing any doc data with matching file paths with the existing main DocDB.
 *
 */
export default class RegenerateDocData
{
   /**
    * Provides eventbus bindings for regenerating DocObject and AST data for source and test files.
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

      // Add event bindings to regenerate source and test files.
      this._eventbus.on('tjsdoc:system:regenerate:source:doc:data', this.regenerateSourceDocData, this);
      this._eventbus.on('tjsdoc:system:regenerate:test:doc:data', this.regenerateTestDocData, this);
   }

   /**
    * Stores the main DocDB so that eventbus queries are reduced.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPreGenerate(ev)
   {
      this._mainDocDB = ev.data.docDB;
   }

   /**
    * Provides the internal doc regeneration process with generation of source or test files specified by the `event`
    * passed in as the first parameter. The second parameter is an object hash.
    *
    * @param {string}   event - The event to trigger for doc generation.
    *
    * @param {string}       filePath - Path to a file to regenerate (it may be relative).
    *
    * @param {boolean}      [dependent=true] - When set to false only the file requested is regenerated; by default any
    *                                          dependent files based on class hierarchy relationship are also
    *                                          regenerated.
    *
    * @param {DocDB}        [docDB=this._mainDocDB] - Defaults to the main runtime DocDB otherwise provide a target
    *                                                 DocDB.
    *
    * @param {TyphonEvents} [eventbus=this._eventbus] - Defaults to the plugin eventbus.
    *
    * @param {string}       [handleError='throw'] - Defaults to the 'throw'; no other setting is currently supported.
    *
    * @param {function}     [docFilter] - An optional function invoked with the static doc before inserting into the
    *                                     given DocDB.
    *
    * @param {boolean}      [resolve=true] - By default after regenerating and merging the core doc resolver is
    *                                        triggered to resolve the new docs.
    *
    * @param {boolean}      [silent=false] - By default immediate logging will occur for each file processed.
    *
    * @returns {string[]}
    * @private
    */
   _regenerateDocData(event, { dependent = true, docDB = this._mainDocDB, eventbus = this._eventbus, filePath,
    handleError = 'throw', docFilter = void 0, resolve = true, silent = false } = {})
   {
      if (typeof filePath !== 'string') { throw new TypeError(`'filePath' is not a 'string'.`); }
      if (typeof handleError !== 'string') { throw new TypeError(`'handleError' is not a 'string'.`); }

      // Create a DocDB to store regenerated docs and set mode to `regenerate`.
      const regenDocDB = this._eventbus.triggerSync('tjsdoc:system:docdb:create', { eventbus, mode: 'regenerate' });

      const generateOptions = { docDB: regenDocDB, eventbus, filePath, handleError, silent, docFilter };

      generateOptions.docDB = this._eventbus.triggerSync(event, generateOptions);

      if (dependent)
      {
         docDB.findDependentFiles(filePath).forEach((path) =>
         {
            generateOptions.filePath = path;

            this._eventbus.trigger(event, generateOptions);
         });
      }

      // Remove old doc data for all distinct file paths in docDB and insert all new doc data.
      const filePaths = docDB.removeAndInsertDB(generateOptions.docDB);

      // Run core resolver with the constraint of docs matching file paths regenerated.
      if (resolve)
      {
         this._eventbus.trigger('tjsdoc:system:resolver:docdb:resolve', { filePath: filePaths, silent });

         // Determine new dependent files after resolution.
         if (dependent)
         {
            filePaths.length = 0;
            filePaths.push(filePath);

            docDB.findDependentFiles(filePath, filePaths);
         }
      }

      return filePaths;
   }

   /**
    * Regenerates a source file returning any file paths including dependent files regenerated.
    *
    * @param {object}            config - Object hash providing configuration options.
    *
    * @property {string}         config.event - The event to trigger for doc generation.
    *
    * @property {string}         config.filePath - Path to a file to regenerate (it may be relative).
    *
    * @property {boolean}        [config.dependent=true] - When set to false only the file requested is regenerated; by
    *                                                      default any dependent files based on class hierarchy
    *                                                      relationship are also regenerated.
    *
    * @property {DocDB}          [config.docDB=this._mainDocDB] - Defaults to the main runtime DocDB otherwise provide
    *                                                             a target DocDB.
    *
    * @property {TyphonEvents}   [config.eventbus=this._eventbus] - Defaults to the plugin eventbus.
    *
    * @property {string}         [config.handleError='throw'] - Defaults to the 'throw'; no other setting is currently
    *                                                           supported.
    *
    * @property {function}       [docFilter] - An optional function invoked with the static doc before inserting into
    *                                          the given DocDB.
    *
    * @property {boolean}        [config.resolve=true] - By default after regenerating and merging the core doc resolver
    *                                                    is triggered to resolve the new docs.
    *
    * @property {boolean}        [config.silent=false] - By default immediate logging will occur for each file processed.
    *
    * @returns {string[]} - file paths including any dependencies regenerated.
    */
   regenerateSourceDocData(config)
   {
      return this._regenerateDocData('tjsdoc:system:generate:source:doc:data', config);
   }

   /**
    * Regenerates a test file returning any file paths including dependent files regenerated.
    *
    * @param {object}            config - Object hash providing configuration options.
    *
    * @property {string}         config.event - The event to trigger for doc generation.
    *
    * @property {string}         config.filePath - Path to a file to regenerate (it may be relative).
    *
    * @property {boolean}        [config.dependent=true] - When set to false only the file requested is regenerated; by
    *                                                      default any dependent files based on class hierarchy
    *                                                      relationship are also regenerated.
    *
    * @property {DocDB}          [config.docDB=this._mainDocDB] - Defaults to the main runtime DocDB otherwise provide
    *                                                             a target DocDB.
    *
    * @property {TyphonEvents}   [config.eventbus=this._eventbus] - Defaults to the plugin eventbus.
    *
    * @property {string}         [config.handleError='throw'] - Defaults to the 'throw'; no other setting is currently
    *                                                           supported.
    *
    * @property {function}       [docFilter] - An optional function invoked with the static doc before inserting into
    *                                          the given DocDB.
    *
    * @property {boolean}        [config.resolve=true] - By default after regenerating and merging the core doc resolver
    *                                                    is triggered to resolve the new docs.
    *
    * @property {boolean}        [config.silent=false] - By default immediate logging will occur for each file processed.
    *
    * @returns {string[]} - file paths including any dependencies regenerated.
    */
   regenerateTestDocData(config)
   {
      return this._regenerateDocData('tjsdoc:system:generate:test:doc:data', config);
   }
}
