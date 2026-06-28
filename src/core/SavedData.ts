import { runProgressStore } from './CampaignRun';
import { resetClientIdAfterStorageClear } from './leaderboard/clientId';
import { playerProfile } from './PlayerProfile';
import { settingsStore } from './SettingsStore';

/** Wipes all browser-stored game data (progress, options, nick, etc.). */
export function clearAllGameData(): void {
  try {
    localStorage.clear();
  } catch {
    // private browsing
  }
  runProgressStore.afterStorageClear();
  settingsStore.reloadFromStorage();
  playerProfile.afterStorageClear();
  resetClientIdAfterStorageClear();
}
