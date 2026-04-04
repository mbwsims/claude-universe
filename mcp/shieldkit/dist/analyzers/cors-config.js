/**
 * CORS misconfiguration analyzer.
 *
 * Detects overly permissive CORS configurations such as wildcard origins
 * and cors({ origin: '*' }) or cors({ origin: true }).
 */
export function analyzeCorsConfig(content) {
    const lines = content.split('\n');
    const locations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Detect Access-Control-Allow-Origin with wildcard *
        if (/Access-Control-Allow-Origin/.test(line) && /['"`]\*['"`]/.test(line)) {
            locations.push({
                line: lineNum,
                text: line.trim(),
            });
            continue;
        }
        // Detect cors({ origin: '*' })
        if (/cors\s*\(/.test(line) && /origin\s*:\s*['"`]\*['"`]/.test(line)) {
            locations.push({
                line: lineNum,
                text: line.trim(),
            });
            continue;
        }
        // Detect cors({ origin: true })
        if (/cors\s*\(/.test(line) && /origin\s*:\s*true\b/.test(line)) {
            locations.push({
                line: lineNum,
                text: line.trim(),
            });
            continue;
        }
        // Detect standalone origin: '*' or origin: true in CORS-like config blocks
        // (when cors( is on a previous line)
        if (/origin\s*:\s*['"`]\*['"`]/.test(line) || /origin\s*:\s*true\b/.test(line)) {
            // Check if this is in a CORS context by looking at surrounding lines
            const surroundingContext = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
            if (/cors/i.test(surroundingContext) || /Access-Control/i.test(surroundingContext)) {
                locations.push({
                    line: lineNum,
                    text: line.trim(),
                });
            }
        }
    }
    return {
        count: locations.length,
        locations,
    };
}
//# sourceMappingURL=cors-config.js.map