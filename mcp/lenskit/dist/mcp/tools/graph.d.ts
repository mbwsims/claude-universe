/**
 * lenskit_graph -- Dependency graph for the whole project.
 *
 * Builds a directed dependency graph, detects circular dependencies,
 * identifies hub/leaf files, classifies modules by layer, and detects
 * layer violations.
 */
import { type GraphResult } from '../../analyzers/graph.js';
export declare function graphTool(cwd: string): Promise<GraphResult>;
