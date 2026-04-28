#!/usr/bin/env node
import { runSkillValidationCli } from '../dist/validate-skills.js';

const targetDir = process.argv[2] ?? process.cwd();
const exitCode = await runSkillValidationCli(targetDir);
process.exit(exitCode);
