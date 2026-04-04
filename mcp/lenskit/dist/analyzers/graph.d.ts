/**
 * graph.ts -- Dependency graph analysis.
 *
 * Parses import statements across all source files to build a directed
 * dependency graph. Detects circular dependencies, hub/leaf files,
 * layer classifications, and layer violations.
 */
export interface GraphEdge {
    from: string;
    to: string;
}
export interface HubFile {
    file: string;
    importerCount: number;
}
export interface LayerViolation {
    file: string;
    imports: string;
    violation: string;
}
export interface GraphResult {
    nodes: string[];
    edges: GraphEdge[];
    circularDeps: string[][];
    hubs: HubFile[];
    leaves: string[];
    layerViolations: LayerViolation[];
}
export declare function analyzeGraph(cwd: string): Promise<GraphResult>;
