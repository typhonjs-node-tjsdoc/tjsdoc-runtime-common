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
    * @param {DocObject[]} [docData] - TJSDoc document data.
    */
   constructor(docData = void 0)
   {
      /**
       * TaffyDB instance of docData.
       * @type {Taffy}
       */
      this._docDB = taffy(docData);
      this._docID = 0;
   }

   /**
    * Find doc object with given filter options.
    *
    * @param {...Object} cond - find condition.
    *
    * @returns {DocObject[]} found doc objects.
    */
   find(...cond)
   {
      return this.findSorted(null, ...cond);
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

      /* eslint-disable default-case */
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
    * @param {...Object}   [cond] - condition objects - A TaffyDB filter query.
    *
    * @returns {DocObject[]} found doc objects.
    */
   findSorted(order = void 0, ...cond)
   {
      const data = this._docDB(...cond);

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
    * Inserts a DocObject, array of DocObjects, or DocDB.
    *
    * @param {DocObject|DocObject[]|DocDB}   docObjectOrDB - A single instance or array of DocObjects or DocDB to merge.
    *
    * @returns {Taffy}
    */
   insert(docObjectOrDB)
   {
      if (docObjectOrDB instanceof DocDB)
      {
         if (docObjectOrDB === this._docDB)
         {
            throw new ReferenceError(`'docObject' is the same instance as this DocDB.`);
         }

         return this._docDB.insert(docObjectOrDB.find());
      }
      else if (typeof docObjectOrDB === 'object')
      {
         return this._docDB.insert(docObjectOrDB);
      }

      throw new ReferenceError(`'docObject' is not an 'object' or 'array'.`);
   }

   /**
    * Merges a DocObject, array of DocObjects, or DocDB.
    *
    * @param {DocObject|DocObject[]|DocDB}   docObjectOrDB - A single instance or array of DocObjects or DocDB to merge.
    *
    * @param {*}                             key - Identity column to be used to match records against the existing
    *                                              db. The TaffyDB default is: `id`.
    *
    * @returns {Taffy}
    */
   merge(docObjectOrDB, key = void 0)
   {
      if (docObjectOrDB instanceof DocDB)
      {
         if (docObjectOrDB === this._docDB)
         {
            throw new ReferenceError(`'docObject' is the same instance as this DocDB.`);
         }

         return this._docDB.merge(docObjectOrDB.find(), key);
      }
      else if (typeof docObjectOrDB === 'object')
      {
         return this._docDB.merge(docObjectOrDB, key);
      }

      throw new ReferenceError(`'docObject' is not an 'object' or 'array'.`);
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
      ev.eventbus.on('tjsdoc:data:docdb:current:id:get', this.getCurrentID, this);
      ev.eventbus.on('tjsdoc:data:docdb:current:id:increment:get', this.getCurrentIDAndIncrement, this);
      ev.eventbus.on('tjsdoc:data:docdb:find', this.find, this);
      ev.eventbus.on('tjsdoc:data:docdb:find:access:docs', this.findAccessDocs, this);
      ev.eventbus.on('tjsdoc:data:docdb:find:all:identifiers:kind:grouping', this.findAllIdentifiersKindGrouping, this);
      ev.eventbus.on('tjsdoc:data:docdb:find:by:name', this.findByName, this);
      ev.eventbus.on('tjsdoc:data:docdb:find:sorted', this.findSorted, this);
      ev.eventbus.on('tjsdoc:data:docdb:get', () => this, this);
      ev.eventbus.on('tjsdoc:data:docdb:insert', this.insert, this);
      ev.eventbus.on('tjsdoc:data:docdb:merge', this.merge, this);
      ev.eventbus.on('tjsdoc:data:docdb:query', this.query, this);
      ev.eventbus.on('tjsdoc:data:docdb:reset', this.reset, this);
   }

   /**
    * Performs a TaffyDB query.
    *
    * @param {object|undefined}  [query] - An optional TaffyDB query.
    *
    * @see http://www.taffydb.com/
    * @returns {Taffy}
    */
   query(query = void 0)
   {
      return this._docDB(query);
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

   // Create an event binding to filter out source code in provided `docDB` based on `config.includeSource`.
   eventbus.on('tjsdoc:system:docdb:filter:include:source', (docDB) =>
   {
      const config = eventbus.triggerSync('tjsdoc:data:config:get');

      // Optionally remove source code from all file / testFile document data.
      if (!config.includeSource)
      {
         docDB.query({ kind: ['file', 'testFile'] }).each((doc) => doc.content = '');
      }
   });
}
