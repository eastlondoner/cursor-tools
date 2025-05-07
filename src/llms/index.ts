import type { PackageRuleItem } from 'vibe-rules';
import { VIBE_TOOLS_CORE_CONTENT, VIBE_TOOLS_RULES_VERSION } from '../vibe-rules.js';

const processedRuleContent = VIBE_TOOLS_CORE_CONTENT.replace(
  '${VIBE_TOOLS_RULES_VERSION}',
  VIBE_TOOLS_RULES_VERSION
);

const rules: PackageRuleItem[] = [
  {
    name: 'vibe-tools-rule',
    description: 'Vibe Tools',
    rule: processedRuleContent,
    alwaysApply: true,
    globs: ['*', '**/*'],
  },
];

export default rules;
