import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, cp, symlink, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('polling hot-updates CSS and reloads JavaScript and HTML', async ({ page }) => {
  await page.setViewportSize({width:800,height:600});
  // Use an isolated source copy so this check never edits the user's running app.
  const root = await mkdtemp(join(tmpdir(), 'helix-hmr-'));
  let server;
  try {
    await cp('src', join(root, 'src'), { recursive: true });
    await cp('index.html', join(root, 'index.html'));
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    server = await createServer({
      root, configFile: false, cacheDir: join(root, '.vite-cache'),
      server: { host: '127.0.0.1', port: 0, watch: { usePolling: true, interval: 150 } },
    });
    await server.listen();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.evaluate(() => { window.hmrDocumentMarker = 'unchanged'; });
    const cssPath = join(root, 'src/style.css');
    await writeFile(cssPath, await readFile(cssPath, 'utf8') + '\nbody { --hmr-probe: updated; }\n');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--hmr-probe').trim())).toBe('updated');
    expect(await page.evaluate(() => window.hmrDocumentMarker)).toBe('unchanged');

    const jsPath = join(root, 'src/main.js');
    await writeFile(jsPath, await readFile(jsPath, 'utf8') + '\nwindow.hmrScriptUpdated = true;\n');
    await page.waitForFunction(() => window.hmrScriptUpdated === true);
    expect(await page.evaluate(() => window.hmrDocumentMarker)).toBeUndefined();
    await expect(page.locator('canvas')).toHaveCount(1);

    const htmlPath = join(root, 'index.html');
    await writeFile(htmlPath, (await readFile(htmlPath, 'utf8')).replace('<title>HELIX — Orbital flight experiment</title>', '<title>Live HTML update</title>'));
    await expect(page).toHaveTitle('Live HTML update');
  } finally {
    await page.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
