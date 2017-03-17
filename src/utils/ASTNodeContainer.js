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
    * Clears any stored nodes.
    */
   clear()
   {
      this._nodes = {};
      this._docId = 0;
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
    * Sets an AST node by ID.
    *
    * @param {number}   id - An ID to retrieve a stored node.
    * @param {ASTNode}  node - AST node to set.
    */
   set(id, node)
   {
      this._nodes[id] = node;
   }

   /**
    * Wires up ASTNodeContainer on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      ev.eventbus.on('tjsdoc:data:ast:node:container:get', () => this);
   }
}
