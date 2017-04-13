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
    * @param {DocObject[]} [docData] - DocObject data.
    */
   constructor(docData = void 0)
   {
      /**
       * TaffyDB instance of docData.
       * @type {Taffy}
       */
      this._docDB = taffy(docData);

      this._docID = 0; // TODO determine highest __docId__ from any given docData
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
    * @param {...Object} query - find query.
    *
    * @returns {DocObject[]} found doc objects.
    */
   find(...query)
   {
      return this.findSorted(null, ...query);
   }

   /**
    * find doc object for each access.
    *
    * @param {DocObject}   doc - parent doc object.
    * @param {string}      kind - kind property condition.
    * @param {boolean}     [isStatic=true] - static property condition
    *
    * @returns {*[]} found doc objects.
    * ```
    * (Array[]) 0 - ['Public', DocObject[]]
    * (Array[]) 1 - ['Protected', DocObject[]]
    * (Array[]) 2 - ['Private', DocObject[]]
    * ```
    */
   findAccessDocs(doc, kind, isStatic = true)
   {
      const cond = { kind, 'static': isStatic };

      if (doc) { cond.memberof = doc.longname; }

      switch (kind)
      {
         case 'class':
            cond.interface = false;
            break;

         case 'interface':
            cond.kind = 'class';
            cond.interface = true;
            break;

         case 'member':
            cond.kind = ['member', 'get', 'set'];
            break;
      }

      const publicDocs = this.find(cond, { access: 'public' }).filter((v) => !v.builtinVirtual);
      const protectedDocs = this.find(cond, { access: 'protected' }).filter((v) => !v.builtinVirtual);
      const privateDocs = this.find(cond, { access: 'private' }).filter((v) => !v.builtinVirtual);

      // access docs
      return [['Public', publicDocs], ['Protected', protectedDocs], ['Private', privateDocs]];
   }

   /**
    * Find all identifiers with grouping by kind.
    *
    * @returns {{class: DocObject[], interface: DocObject[], function: DocObject[], variable: DocObject[], typedef: DocObject[], external: DocObject[]}} found doc objects.
    */
   findAllIdentifiersKindGrouping()
   {
      return {
         'class': this.find([{ 'kind': 'class', 'interface': false }]),
         'interface': this.find([{ 'kind': 'class', 'interface': true }]),
         'function': this.find([{ kind: 'function' }]),
         'variable': this.find([{ kind: 'variable' }]),
         'typedef': this.find([{ kind: 'typedef' }]),
         'external': this.find([{ kind: 'external' }]).filter((v) => !v.builtinVirtual)
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
    *
    * @returns {DocObject[]} found doc objects.
    */
   findByName(name, kind = void 0)
   {
      let docs;

      docs = this.findSorted(null, kind ? { longname: name, kind } : { longname: name });

      if (docs.length) { return docs; }

      docs = this.findSorted(null, kind ? { name, kind } : { name });

      if (docs.length) { return docs; }

      const regex = new RegExp(`[~]${name.replace('*', '\\*')}$`); // if name is `*`, need to escape.

      docs = this.findSorted(null, kind ? { longname: { regex }, kind } : { longname: { regex } });

      if (docs.length) { return docs; }

      // inherited method?
      const matched = name.match(/(.*)[.#](.*)$/); // instance method(Foo#bar) or static method(Foo.baz)

      if (matched)
      {
         const parent = matched[1];
         const childName = matched[2];
         const parentDoc = this.findByName(parent, 'class')[0];

         if (parentDoc && parentDoc._custom_extends_chains)
         {
            for (const superLongname of parentDoc._custom_extends_chains)
            {
               if (docs.length) { return this.find({ memberof: superLongname, name: childName }); }  // docs
            }
         }
      }

      return [];
   }

   /**
    * Find doc objects sorted by name and any optional sorting criteria passed in as the first parameter.
    *
    * @param {string}      [order] - doc objects order(``column asec`` or ``column desc``).
    * @param {...Object}   [query] - condition objects - A TaffyDB filter query.
    *
    * @returns {DocObject[]} found doc objects.
    */
   findSorted(order = void 0, ...query)
   {
      const data = this._docDB(...query);

      return data.order(order ? `${order}, name asec` : 'name asec').map((v) => v);
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
    * Inserts an object, array of objects, or a DocDB into this instance.
    *
    * @param {DocObject|DocObject[]|DocDB}   objectOrDB - A single instance or array of DocObjects or DocDB to merge.
    *
    * @returns {Taffy}
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
    * @param {boolean}     [reset=true] - Resets the StaticDoc removing all internal data references so that it can
    *                                     go out of scope.
    * @returns {Taffy}
    * @private
    */
   insertStaticDoc(staticDoc, reset = true)
   {
      // Retrieve the docObject data.
      const docObject = staticDoc.value;

      // If this DocDB is associated with an eventbus then invoke `onHandleDocObject`.
      if (this._eventbus)
      {
         this._eventbus.trigger('plugins:invoke:sync:event', 'onHandleDocObject', void 0, { docObject });
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
    * @returns {Taffy}
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

      this._eventbus.on(`${eventPrepend}:data:docdb:current:id:get`, this.getCurrentID, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:current:id:increment:get`, this.getCurrentIDAndIncrement, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find`, this.find, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:access:docs`, this.findAccessDocs, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:all:identifiers:kind:grouping`,
       this.findAllIdentifiersKindGrouping, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:by:name`, this.findByName, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:find:sorted`, this.findSorted, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:get`, () => this, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:insert:doc:object`, this.insertDocObject, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:insert`, this.insert, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:merge`, this.merge, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:query`, this.query, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:remove`, this.remove, this);
      this._eventbus.on(`${eventPrepend}:data:docdb:reset`, this.reset, this);
   }

   /**
    * Performs a TaffyDB query.
    *
    * @param {Array|function|object|string}  [query] - An optional TaffyDB query; one or more Strings, records, filter
    *                                                  objects, arrays, or functions.
    *
    * @see http://www.taffydb.com/
    * @returns {Taffy}
    */
   query(...query)
   {
      return this._docDB(...query);
   }

   /**
    * Removes docs that match the query or if a DocDB is provided then all docs are removed by `filePath` in this
    * instance that are found in the given DocDB.
    *
    * @param {Array|DocDB|function|object|string|undefined} [query] - A DocDB instance to query for doc file paths to
    *                                                                 remove or an optional TaffyDB query.
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
    * Resets the DocDB.
    */
   reset()
   {
      this._docDB().remove();
      this._docID = 0;
   }
}

/**
 * Adds event binding to create a DocDB instance from docData / DocObject[].
 *
 * @param {PluginEvent} ev - The plugin event.
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   eventbus.on('tjsdoc:system:docdb:create', (docData) => new DocDB(docData));
}
