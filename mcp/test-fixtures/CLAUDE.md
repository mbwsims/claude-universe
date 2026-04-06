# Project Instructions

## Code Style

- Use TypeScript strict mode
- Always use named exports
- No default exports except in pages/
- Try to write clean code when possible
- Generally prefer functional approaches

## Testing

1. Run `vitest run` before committing
2. Write tests for all new functions
3. Use describe/it blocks, not standalone test()
4. In test files, always use describe/it blocks

## Imports

- Use absolute imports via path aliases (@/, @db/, @services/)
- Always use absolute imports for all source files
- No relative imports with ../

## Architecture

- Components must not import from db/ directly
- Keep services in src/services/
- Always run eslint --fix after editing TypeScript files

## Workflow

- Use camelCase for variables
- Handle errors properly
- Follow REST conventions
