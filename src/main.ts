import './fonts';
import './style.css';
import { migrateStorageKeys } from './core/migrations';
import { createStorage } from './core/storage';
import { App } from './ui/app';

async function waitForMusicFont(): Promise<void> {
  // VexFlow registers the Bravura font on import; draw only once it is loaded.
  try {
    await Promise.race([
      document.fonts.load('30px Bravura'),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // draw anyway
  }
}

await waitForMusicFont();
const storage = createStorage();
migrateStorageKeys(storage);
new App(storage).start();
