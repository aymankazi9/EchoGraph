// cytoscape-layout-utilities ships no top-level types of its own — minimal ambient declaration.
declare module 'cytoscape-layout-utilities' {
  import type cytoscape from 'cytoscape'
  const extension: cytoscape.Ext
  export default extension
}
