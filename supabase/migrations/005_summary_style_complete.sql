ALTER TABLE digest_configs DROP CONSTRAINT IF EXISTS digest_configs_summary_style_check;
ALTER TABLE digest_configs ADD CONSTRAINT digest_configs_summary_style_check
  CHECK (summary_style IN ('executive', 'detailed', 'complete'));
