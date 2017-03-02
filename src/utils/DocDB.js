import { taffy }  from 'taffydb';

/**
 * Provides several utility methods and event bindings for the TJSDoc document / tag data using TaffyDB.
 *
 * An onPluginLoad callback also wires up DocDB to an eventbus via {@link PluginManager}.
 */
export default class DocDB
{
   /**
    * Initializes the TaffyDB instance with given document data.
    *
    * @param {DocObject[]} docData - TJSDoc document data.
    */
   constructor(docData)
   {
      /**
       * TaffyDB instance of docData.
       * @type {Taffy}
       */
      this._docDB = taffy(docData);
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
    * Wires up DocDB to plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @ignore
    */
   onPluginLoad(ev)
   {
      ev.eventbus.on('tjsdoc:docs:find', this.find, this);
      ev.eventbus.on('tjsdoc:docs:find:access:docs', this.findAccessDocs, this);
      ev.eventbus.on('tjsdoc:docs:find:all:identifiers:kind:grouping', this.findAllIdentifiersKindGrouping, this);
      ev.eventbus.on('tjsdoc:docs:find:by:name', this.findByName, this);
      ev.eventbus.on('tjsdoc:docs:find:sorted', this.findSorted, this);
      ev.eventbus.on('tjsdoc:docs:query', this.query, this);
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
}
