import { taffy }  from 'taffydb';

/**
 * Provides several utility methods and event bindings for the TJSDoc document / tag data using TaffyDB.
 *
 * An onPluginLoad callback also wires up DocDB to an eventbus via {@link PluginManager}.
 */
export class DocDB
{
   /**
    * Initializes the TaffyDB instance with given document data.
    *
    * @param {DocObject[]}    [docData] - DocObject data.
    *
    * @param {TyphonEvents}   [eventbus] - An eventbus instance to set for this DocDB instance.
    *
    * @param {string}      [mode='generate'] - Defines the operational mode. By default this is `generate` which
    *                                          normally occurs during initial full generation of all docs, but it is
    *                                          possible to regenerate docs for a subset of files incrementally and in
    *                                          this case mode is set to `regenerate`. The mode is passed into the
    *                                          `onHandleDocObject` plugin callback in `insertStaticDoc` allowing plugins
    *                                          to optionally handle doc objects based on `mode`.
    */
   constructor({ docData = void 0, eventbus = void 0, mode = 'generate' } = {})
   {
      /**
       * TaffyDB instance of docData.
       * @type {TaffyDB}
       */
      this._docDB = taffy(docData);

      this._docID = 0; // TODO determine highest __docId__ from any given docData

      this._mode = mode;

      this.setEventbus(eventbus);
   }

   /**
    * Filters out any unnecessary DocObject data based on the target project TJSDocConfig.
    *
    * @param {DocObject}   doc - The DocObject to filter.
    *
    * @returns {DocObject}
    */
   filterDoc(doc)
   {
      // Filter out any file content.
      if (doc.content) { doc.content = ''; }

      // Filter out any AST.
      if (doc.ast) { delete doc.ast; }

      if (this._config)
      {
         // Filter out any AST node data as it is not further processed.
         if (!this._config.outputASTData) { delete doc.node; }
      }

      return doc;
   }

   /**
    * Find doc object with given filter options.
    *
    * @param {...TaffyDBQuery}   [query] - A TaffyDB query.
    *
    * @returns {DocObject[]} found doc objects.
    */
   find(...query)
   {
      return this.findSorted(void 0, ...query);
   }

   /**
    * Returns an object Find doc objects for each access based on the given query.
    *
    * @param {...TaffyDBQuery}   [query] - A TaffyDB query.
    *
    * @returns {AccessDocs}
    */
   findAccessDocs(...query)
   {
      return {
         Public: this.find(...query, { access: 'public' }).filter((v) => !v.builtinVirtual),
         Protected: this.find(...query, { access: 'protected' }).filter((v) => !v.builtinVirtual),
         Private: this.find(...query, { access: 'private' }).filter((v) => !v.builtinVirtual)
      };
   }

   /**
    * Fuzzy find doc object by name.
    * - equal with longname
    * - equal with name
    * - included in longname
    * - included in ancestor
    *
    * @param {string} name - Target identifier name.
    * @param {string} [kind] - Target kind.
    * @param {string} [qualifier] - Target qualifier.
    *
    * @returns {DocObject[]} found doc objects.
    */
   findByName(name, kind = void 0, qualifier = void 0)
   {
      let docs;

      const query = { longname: name };

      if (kind) { query.kind = kind; }
      if (qualifier) { query.qualifier = qualifier; }

      docs = this.findSorted(void 0, query);

      if (docs.length) { return docs; }

      delete query.longname;
      query.name = name;

      docs = this.findSorted(void 0, query);

      if (docs.length) { return docs; }

      const regex = new RegExp(`[~]${name.replace('*', '\\*')}$`); // if name is `*`, need to escape.

      delete query.name;
      query.longname = { regex };

      docs = this.findSorted(void 0, query);

      if (docs.length) { return docs; }

      // inherited method?
      const matched = name.match(/(.*)[.#](.*)$/); // instance method(Foo#bar) or static method(Foo.baz)

      if (matched)
      {
         const parent = matched[1];
         const childName = matched[2];
         const parentDoc = this.findByName(parent, 'ModuleClass')[0];

         if (parentDoc && parentDoc._custom_extends_chains)
         {
            for (const superLongname of parentDoc._custom_extends_chains)
            {
               if (docs.length) { return this.find({ memberof: superLongname, name: childName }); }
            }
         }
      }

      return [];
   }

   /**
    * Returns all unique dependent file paths from ModuleFile docs which already have been resolved by CoreDocResolver.
    *
    * @param {string|Array<string>} filePath - A file path string or array of strings to find associated file docs.
    *
    * @param {Array<string>}        [output=[]] - An array to push additional dependent files paths.
    *
    * @returns {Array<string>}
    */
   findDependentFiles(filePath, output = [])
   {
      const docs = this.find({ kind: 'ModuleFile', filePath });

      const dependent = new Set();

      for (const doc of docs)
      {
         // Forward dependencies from parent to child docs.
         if (Array.isArray(doc._custom_dependent_file_paths))
         {
            for (const file of doc._custom_dependent_file_paths) { dependent.add(file); }
         }

         // Backward dependencies from child to parent docs.
         if (Array.isArray(doc._custom_dependent_file_paths))
         {
            for (const file of doc._custom_dependent_file_paths) { dependent.add(file); }
         }
      }

      output.push(...dependent);

      return output;
   }

   /**
    * Find all identifiers with grouping by kind.
    *
    * @returns {IdentifierKindDocs} found doc objects.
    */
   findIdentifierKindDocs()
   {
      return {
         ModuleClass: this.find({ 'kind': 'ModuleClass', 'interface': false }),
         ModuleFunction: this.find({ kind: 'ModuleFunction' }),
         ModuleInterface: this.find({ 'kind': 'ModuleClass', 'interface': true }),
         ModuleVariable: this.find({ category: 'ModuleVariable' }),
         VirtualExternal: this.find({ kind: 'VirtualExternal' }).filter((v) => !v.builtinVirtual),
         VirtualTypedef: this.find({ kind: 'VirtualTypedef' })
      };
   }

   /**
    * Find doc objects sorted by name and any optional sorting criteria passed in as the first parameter.
    *
    * @param {string}            [order] - doc objects order(``column asec`` or ``column desc``).
    * @param {...TaffyDBQuery}   [query] - A TaffyDB query.
    *
    * @returns {DocObject[]} found doc objects.
    */
   findSorted(order = void 0, ...query)
   {
      const data = this._docDB(...query);

      return data.order(order ? `${order}, name asec` : 'name asec').map((v) => v);
   }

   /**
    * Gets the current source documentation coverage data for this DocDB.
    *
    * @param {string|string[]}   [filePath] - An optional string or array of string to limit data collection.
    *
    * @param {boolean}           [includeFiles=false] - If true then include documentation coverage for each file.
    *
    * @returns {DocDBCoverage}
    */
   getSourceCoverage({ filePath = void 0, includeFiles = false } = {})
   {
      const docs = filePath ? this.find({ kind: s_SOURCE_COVERAGE_KIND, filePath }) :
       this.find({ kind: s_SOURCE_COVERAGE_KIND });

      let actualCount = 0;
      const expectedCount = docs.length;
      const files = {};

      if (includeFiles)
      {
         for (const doc of docs)
         {
            const filePath = doc.filePath;

            if (!files[filePath]) { files[filePath] = { expectedCount: 0, actualCount: 0, undocumentedLines: [] }; }

            files[filePath].expectedCount++;

            if (doc.undocument)
            {
               files[filePath].undocumentedLines.push(doc.lineNumber);
            }
            else
            {
               actualCount++;
               files[filePath].actualCount++;
            }
         }

         for (const filePath in files)
         {
            files[filePath] = Object.assign(files[filePath], s_CALC_COVERAGE(files[filePath].actualCount,
             files[filePath].expectedCount));
         }
      }
      else
      {
         for (const doc of docs)
         {
            if (!doc.undocument) { actualCount++; }
         }
      }

      return Object.assign({ files }, s_CALC_COVERAGE(actualCount, expectedCount));
   }

   /**
    * Logs current coverage status by triggering 'log:info:raw' messages on any assigned eventbus.
    *
    * @param {TyphonEvents}      [eventbus=this._eventbus] - An optional eventbus to post log events to.
    *
    * @param {string|string[]}   [filePath] - An optional string or array of string file paths to log.
    *
    * @param {boolean}           [includeFiles=false] - If true then include documentation coverage for each file.
    */
   logSourceCoverage({ eventbus = this._eventbus, filePath = void 0, includeFiles = false } = {})
   {
      const coverage = this.getSourceCoverage({ filePath, includeFiles });

      if (eventbus)
      {
         eventbus.trigger('log:info:raw', '================================================');

         if (includeFiles)
         {
            for (const filePath in coverage.files)
            {
               const fileCoverage = coverage.files[filePath];

               eventbus.trigger('log:info:raw', `${fileCoverage.ansiColor}${filePath}: ${fileCoverage.text} (${
                fileCoverage.actualCount}/${fileCoverage.expectedCount})[0m`);
            }

            eventbus.trigger('log:info:raw', '');
         }

         eventbus.trigger('log:info:raw', `${coverage.ansiColor}Documentation coverage: ${coverage.text} (${
          coverage.actualCount}/${coverage.expectedCount})[0m`);

         eventbus.trigger('log:info:raw', '================================================');
      }
   }

   /**
    * Returns the current doc ID.
    *
    * @returns {number}
    */
   getCurrentID()
   {
      return this._docID;
   }

   /**
    * Returns the current doc ID then post-increments it.
    *
    * @returns {number}
    */
   getCurrentIDAndIncrement()
   {
      return this._docID++;
   }

   /**
    * Gets any currently associated eventbus.
    *
    * @returns {EventProxy|TyphonEvents}
    */
   getEventbus()
   {
      return this._eventbus;
   }

   /**
    * Gets the current DocDB mode.
    *
    * @returns {string}
    */
   getMode()
   {
      return this._mode;
   }

   /**
    * Inserts an object, array of objects, or a DocDB into this instance.
    *
    * @param {DocObject|DocObject[]|DocDB}   objectOrDB - A single instance or array of DocObjects or DocDB to merge.
    *
    * @returns {TaffyDB}
    */
   insert(objectOrDB)
   {
      if (objectOrDB instanceof DocDB)
      {
         if (objectOrDB === this._docDB)
         {
            throw new ReferenceError(`'objectOrDB' is the same instance as this DocDB.`);
         }

         return this._docDB.insert(objectOrDB.find().map((doc) => this.filterDoc(doc)));
      }
      else if (typeof objectOrDB === 'object')
      {
         return this._docDB.insert(this.filterDoc(objectOrDB));
      }

      throw new ReferenceError(`'objectOrDB' is not an 'object' or 'array'.`);
   }

   /**
    * Invokes the `onHandleDocObject` plugin callback for each DocObject given before inserting into this DocDB
    * instance. The DocObject is by default destroyed upon insertion. This allows it to go out of scope. Before
    * insertion into the DocDB the doc value is filtered removing any unnecessary data such as AST content
    * based on the target project TJSDocConfig instance.
    *
    * @param {StaticDoc}   staticDoc - The static doc generator to retrieve a DocObject to insert.
    *
    * @param {function}    [docFilter] - An optional function invoked with the static doc before inserting into the
    *                                    given DocDB.
    *
    * @param {boolean}     [reset=true] - Resets the StaticDoc removing all internal data references so that it can
    *                                     go out of scope.
    * @returns {TaffyDB|undefined}
    * @private
    */
   insertStaticDoc(staticDoc, docFilter = void 0, reset = true)
   {
      // Retrieve the docObject data.
      const docObject = staticDoc.value;

      if (typeof docFilter === 'function')
      {
         const addDoc = docFilter(docObject) || true;

         if (!addDoc) { return; }
      }

      // If this DocDB is associated with an eventbus then invoke `onHandleDocObject`.
      if (this._eventbus)
      {
         this._eventbus.trigger('plugins:invoke:sync:event', 'onHandleDocObject', void 0,
          { docDB: this, docObject, mode: this._mode });
      }

      // Resets the StaticDoc so that all data goes out of scope.
      if (reset && typeof staticDoc.reset === 'function') { staticDoc.reset(); }

      // Inserts the doc object into the TaffyDB instance.
      return this._docDB.insert(this.filterDoc(docObject));
   }

   /**
    * Merges an object, array of objects, or a DocDB into this instance with a default identity column of `id`. The
    * given key if defines the identity column for the merge.
    *
    * @param {DocObject|DocObject[]|DocDB}   objectOrDB - A single instance or array of DocObjects or DocDB to merge.
    *
    * @param {*}                             key - Identity column to be used to match records against the existing
    *                                              db. The TaffyDB default is: `id`.
    *
    * @returns {TaffyDB}
    */
   merge(objectOrDB, key = void 0)
   {
      if (objectOrDB instanceof DocDB)
      {
         if (objectOrDB === this._docDB)
         {
            throw new ReferenceError(`'objectOrDB' is the same instance as this DocDB.`);
         }

         return this._docDB.merge(objectOrDB.find().map((doc) => this.filterDoc(doc)), key);
      }
      else if (typeof objectOrDB === 'object')
      {
         return this._docDB.merge(objectOrDB, key);
      }

      throw new ReferenceError(`'objectOrDB' is not an 'object' or 'array'.`);
   }

   /**
    * Wires up DocDB to plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @ignore
    */
   onPluginLoad(ev)
   {
      this._eventbus = ev.eventbus;

      this._config = this._eventbus.triggerSync('tjsdoc:data:config:get');

      let eventPrepend = 'tjsdoc';

      // If `eventPrepend` is defined then it is prepended before all event bindings.
      if (typeof ev.pluginOptions.eventPrepend === 'string') { eventPrepend = `${ev.pluginOptions.eventPrepend}`; }

      this._eventbus.on(`${eventPrepend}:data:docdb:coverage:source:get`, this.getSourceCoverage, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:coverage:source:log`, this.logSourceCoverage, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:current:id:get`, this.getCurrentID, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:current:id:increment:get`, this.getCurrentIDAndIncrement, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find`, this.find, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:access:docs`, this.findAccessDocs, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:by:name`, this.findByName, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:files:dependent`, this.findDependentFiles, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:identifier:kind:docs`, this.findIdentifierKindDocs, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:sorted`, this.findSorted, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:get`, () => this, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:insert:doc:static`, this.insertStaticDoc, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:insert`, this.insert, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:merge`, this.merge, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:mode:get`, this.getMode, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:mode:set`, this.setMode, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:query`, this.query, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:remove`, this.remove, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:reset`, this.reset, this);
   }

   /**
    * Performs a TaffyDB query.
    *
    * @param {...TaffyDBQuery}   [query] - A TaffyDB query.
    *
    * @see http://www.taffydb.com/
    * @returns {TaffyDB}
    */
   query(...query)
   {
      return this._docDB(...query);
   }

   /**
    * Removes docs that match the query or if a DocDB is provided then all docs are removed by `filePath` in this
    * instance that are found in the given DocDB.
    *
    * @param {...TaffyDBQuery}   [query] - A TaffyDB query.
    *
    * @returns {number} - count of docs removed.
    */
   remove(...query)
   {
      if (query.length.length > 0 && query[0] instanceof DocDB)
      {
         const removeDocDB = query[0];

         if (removeDocDB === this._docDB)
         {
            throw new ReferenceError(`'removeDocDB' is the same instance as this DocDB.`);
         }

         const distinctPaths = removeDocDB.query().distinct('filePath');

         return distinctPaths.length > 0 ? this._docDB({ filePath: distinctPaths }).remove() : 0;
      }
      else
      {
         return this._docDB(...query).remove();
      }
   }

   /**
    * Removes all distinct doc data entries in this DocDB found in the insertion DocDB instance. After removal all
    * the given DocDB is inserted.
    *
    * @param {DocDB} docDB - The DocDB instance to insert after removing existing doc data by distinct file paths.
    *
    * @returns {string[]}  Array of distinct file paths in given DocDB to insert.
    */
   removeAndInsertDB(docDB)
   {
      // Distinct file paths found in the given DocDB to insert.
      const filePath = docDB.query().distinct('filePath');

      // Remove old doc data for all distinct file paths.
      this.remove({ filePath });

      // Insert given DocDB into this instance.
      this.insert(docDB);

      return filePath;
   }

   /**
    * Resets the DocDB.
    */
   reset()
   {
      this._docDB().remove();
      this._docID = 0;
   }

   /**
    * Sets an active eventbus useful when inserting static docs for the `onHandleDocObject` plugin callbacks for DocDB
    * instances which may not be added as a plugin.
    *
    * @param {TyphonEvents}   eventbus - An eventbus instance.
    */
   setEventbus(eventbus)
   {
      this._eventbus = eventbus;
   }

   /**
    * Sets the current DocDB mode.
    *
    * @param {string} mode - Defines the operational mode.
    */
   setMode(mode)
   {
      this._mode = mode;
   }
}

/**
 * Adds module scoped event binding to create a DocDB instance from DocDBConfig which is an object with entries for
 * `docData` (DocObject[]) and / or `eventbus` assigning it to the new DocDB instance created.
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   eventbus.on('tjsdoc:system:docdb:create', (docDBConfig) => new DocDB(docDBConfig));
}

// Module private ---------------------------------------------------------------------------------------------------

/**
 * Defines the doc object kinds which contribute to source documentation coverage.
 * @type {string[]}
 */
const s_SOURCE_COVERAGE_KIND =
[
   'ClassMember',
   'ClassMethod',
   'ClassProperty',
   'ModuleAssignment',
   'ModuleClass',
   'ModuleFunction',
   'ModuleVariable'
];

/**
 * Calculates coverage data based on actual and expected counts.
 *
 * @param {number} actualCount - Actual covered doc objects.
 *
 * @param {number} expectedCount - Expected covered doc objects.
 *
 * @returns {{text: string, percent: number, expectedCount: number, actualCount: number, ansiColor: string, htmlColor: string}}
 */
function s_CALC_COVERAGE(actualCount, expectedCount)
{
   const percent = (expectedCount === 0 ? 0 : Math.floor(10000 * actualCount / expectedCount) / 100);

   let ansiColor = '[32m'; // green
   let htmlColor = '#4fc921';

   if (percent < 90) { ansiColor = '[33m'; htmlColor = '#dab226'; } // yellow
   if (percent < 50) { ansiColor = '[31m'; htmlColor = '#db654f'; } // red
   if (percent < 25) { ansiColor = '[1;31m'; htmlColor = '#ff654f'; } // light red

   // Return an object hash of coverage data.
   return {
      text: `${percent}%`,
      percent,
      expectedCount,
      actualCount,
      ansiColor,
      htmlColor
   };
}
