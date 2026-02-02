-- Migration 005: Ensure ai_messages has tool metadata columns
-- Safe, idempotent: adds columns only if they are missing

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_messages' AND column_name = 'tool_name'
  ) THEN
    ALTER TABLE ai_messages ADD COLUMN tool_name VARCHAR(120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_messages' AND column_name = 'tool_payload'
  ) THEN
    ALTER TABLE ai_messages ADD COLUMN tool_payload JSONB;
  END IF;
END $$;
