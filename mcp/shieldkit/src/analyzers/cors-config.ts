/**
 * CORS misconfiguration analyzer.
 *
 * Detects overly permissive CORS configurations such as wildcard origins,
 * cors({ origin: '*' }), cors({ origin: true }), variable-stored configs,
 * and credentials:true + wildcard origin combinations.
 */

export interface CorsConfigLocation {
  line: number;
  text: string;
  credentialsWithWildcard?: boolean;
}

export interface CorsConfigResult {
  count: number;
  locations: CorsConfigLocation[];
}

const CONTEXT_WINDOW = 10;

export function analyzeCorsConfig(content: string): CorsConfigResult {
  const lines = content.split('\n');
  const locations: CorsConfigLocation[] = [];
  const reportedLines = new Set<number>();

  // Pre-scan: check if credentials: true appears near any wildcard origin
  // within a 10-line window
  const credentialsLines = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (/credentials\s*:\s*true\b/.test(lines[i])) {
      credentialsLines.add(i);
    }
  }

  function hasNearbyCredentials(lineIndex: number): boolean {
    for (let j = Math.max(0, lineIndex - CONTEXT_WINDOW); j < Math.min(lines.length, lineIndex + CONTEXT_WINDOW); j++) {
      if (credentialsLines.has(j)) return true;
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip commented-out lines
    if (/^\s*\/\//.test(line) || /^\s*#/.test(line) || /^\s*\/?\*/.test(line)) {
      continue;
    }

    if (reportedLines.has(lineNum)) continue;

    // Detect Access-Control-Allow-Origin with wildcard *
    if (/Access-Control-Allow-Origin/.test(line) && /['"`]\*['"`]/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect cors({ origin: '*' }) on same line
    if (/cors\s*\(/.test(line) && /origin\s*:\s*['"`]\*['"`]/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect cors({ origin: true }) on same line
    if (/cors\s*\(/.test(line) && /origin\s*:\s*true\b/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect standalone origin: '*' or origin: true in config-like contexts
    if (/origin\s*:\s*['"`]\*['"`]/.test(line) || /origin\s*:\s*true\b/.test(line)) {
      // Check if this is in a CORS context by looking at expanded surrounding lines (10-line window)
      const contextStart = Math.max(0, i - CONTEXT_WINDOW);
      const contextEnd = Math.min(lines.length, i + CONTEXT_WINDOW + 1);
      const surroundingContext = lines.slice(contextStart, contextEnd).join('\n');

      if (/cors/i.test(surroundingContext) || /Access-Control/i.test(surroundingContext) ||
          /corsOptions?/i.test(surroundingContext) || /corsConfig/i.test(surroundingContext)) {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: line.trim(),
          credentialsWithWildcard: hasNearbyCredentials(i),
        });
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
