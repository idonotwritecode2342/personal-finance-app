const { getSetting, setSetting } = require('../../db/global-settings');

const ENV_MODEL = process.env.OPENROUTER_MODEL;
const FALLBACK_MODEL = ENV_MODEL || 'openai/gpt-oss-20b';
const SETTING_KEY = 'openrouter_model';

async function getModel() {
  // Prefer explicit env override (useful for tests/CI)
  if (ENV_MODEL) return ENV_MODEL;

  try {
    const value = await getSetting(SETTING_KEY);
    return value || FALLBACK_MODEL;
  } catch (err) {
    // If settings table not reachable, gracefully fall back
    return FALLBACK_MODEL;
  }
}

async function setModel(modelId) {
  return setSetting(SETTING_KEY, modelId);
}

module.exports = { getModel, setModel, FALLBACK_MODEL };
