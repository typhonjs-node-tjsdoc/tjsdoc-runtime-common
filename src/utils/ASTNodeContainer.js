/**
 * Provides simple storage for AST nodes and incrementing an id number sequentially on addition.
 */
export default class ASTNodeContainer
{
   /**
    * Instantiates ASTNodeContainer
    */
   constructor()
   {
      /**
       * Current doc / node ID.
       * @type {number}
       * @private
       */
      this._docId = 0;

      /**
       * Node storage.
       * @type {{docID: number, node: ASTNode}}
       * @private
       */
      this._nodes = {};
   }

   /**
    * Adds an AST node.
    *
    * @param {ASTNode}  node - An AST node to store
    *
    * @returns {number} ID for this node.
    */
   add(node)
   {
      this._nodes[this._docId] = node;

      return this._docId++;
   }

   /**
    * Gets an AST node by ID.
    *
    * @param {number}   id - An ID to retrieve a stored node.
    *
    * @returns {ASTNode}
    */
   get(id)
   {
      return this._nodes[id];
   }

   /**
    * Wires up ASTNodeContainer on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      eventbus.on('tjsdoc:ast:add:node', this.add, this);
      eventbus.on('tjsdoc:ast:get:node', this.get, this);
   }
}
