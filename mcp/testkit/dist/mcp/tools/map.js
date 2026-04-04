/**
 * testkit_map -- Test-to-source coverage mapping.
 *
 * Discovers all test files, maps them to source files, identifies untested
 * source files, and classifies them by criticality.
 */
import { buildSourceMapping } from '../../analyzers/discovery.js';
export async function mapTool(cwd) {
    const mapping = await buildSourceMapping(cwd);
    return {
        framework: mapping.framework,
        testFiles: mapping.testFiles.length,
        sourceFiles: mapping.sourceFiles.length,
        coverageRatio: mapping.coverageRatio,
        mapped: mapping.testFiles.map(t => ({
            test: t.path,
            source: t.sourcePath,
        })),
        untested: mapping.untested,
    };
}
//# sourceMappingURL=map.js.map