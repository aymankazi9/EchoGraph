// cytoscape-fcose ships no types of its own — minimal ambient declaration.
declare module 'cytoscape-fcose' {
  import type cytoscape from 'cytoscape'
  const extension: cytoscape.Ext
  export default extension
}
