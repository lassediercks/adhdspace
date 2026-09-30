import { test, expect } from '@playwright/test';

test('flight renders and responds to its controls', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#coherence')).toBeVisible();
  await page.getByRole('button',{name:'Pause flight',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume flight',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause flight',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add beam'}).click();
  await expect(page.locator('#beam-count')).toHaveText('2');
  await page.waitForTimeout(2500);
  await page.screenshot({path:'test-results/second-beam.png'});
  await page.locator('#coherence').fill('100');
  await expect(page.locator('#coherence-output')).toHaveText('100%');
  await page.locator('#coherence').fill('0');
  await expect(page.locator('#coherence-output')).toHaveText('0%');
  await page.locator('#instability').fill('100');
  await expect(page.locator('#instability-output')).toHaveText('100%');
  await page.waitForTimeout(2000);
  await page.screenshot({path:'test-results/instability.png'});
  await page.getByRole('switch',{name:'Flight trail'}).click();
  await expect(page.getByRole('switch',{name:'Flight trail'})).toHaveAttribute('aria-checked','false');
  await page.getByRole('button',{name:'Reset flight',exact:true}).click();
  await expect(page.locator('#beam-count')).toHaveText('1');
  await expect(page.locator('#coherence-output')).toHaveText('43%');
  await expect(page.locator('#instability-output')).toHaveText('0%');
  await expect(page.getByRole('switch',{name:'Flight trail'})).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'About this experiment'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/desktop.png'});
  expect(errors).toEqual([]);
});

test('mobile layout and reduced motion work', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button',{name:'Resume flight',exact:true})).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#coherence')).toBeVisible();
  await expect(page.locator('#instability')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add beam'})).toBeVisible();
  await page.getByRole('button',{name:'Add beam'}).click();
  await expect(page.locator('#beam-count')).toHaveText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile.png'});
});


test('beam buttons enforce 1–10 and reset to one beam',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 const add=page.getByRole('button',{name:'Add beam'}),remove=page.getByRole('button',{name:'Remove beam'});
 await expect(remove).toBeDisabled();
 for(let count=2;count<=10;count++) {
  await add.click();await expect(page.locator('#beam-count')).toHaveText(String(count));
 }
 await expect(add).toBeDisabled();
 await page.waitForTimeout(1500);
 await page.screenshot({path:'test-results/ten-beams.png'});
 for(let count=9;count>=1;count--) {
  await remove.click();await expect(page.locator('#beam-count')).toHaveText(String(count));
 }
 await expect(remove).toBeDisabled();await expect(add).toBeEnabled();
 await add.click();await page.getByRole('button',{name:'Reset flight',exact:true}).click();
 await expect(page.locator('#beam-count')).toHaveText('1');
 expect(errors).toEqual([]);
});


test('triangle and square layouts render with coherence controls',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5173');
 const add=page.getByRole('button',{name:'Add beam'});
 await add.click();await add.click();
 await expect(page.locator('#beam-count')).toHaveText('3');
 await page.waitForTimeout(1000);
 await page.screenshot({path:'test-results/triangle-beams.png'});
 await add.click();
 await expect(page.locator('#beam-count')).toHaveText('4');
 await page.getByRole('slider',{name:'Coherence',exact:true}).fill('100');
 await page.waitForTimeout(1000);
 await page.screenshot({path:'test-results/square-beams.png'});
 expect(errors).toEqual([]);
});


test('refresh and restored form values stay synchronized with simulation defaults',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 const coherence=page.getByRole('slider',{name:'Coherence',exact:true});
 const instability=page.getByRole('slider',{name:'Instability',exact:true});
 await coherence.fill('100');await instability.fill('85');
 await page.reload();
 await expect(coherence).toHaveValue('43');await expect(instability).toHaveValue('0');
 await expect(page.locator('#coherence-output')).toHaveText('43%');
 await expect(page.locator('#instability-output')).toHaveText('0%');
 expect(await coherence.evaluate(el=>el.style.getPropertyValue('--fill'))).toBe('43%');
 expect(await instability.evaluate(el=>el.style.getPropertyValue('--fill'))).toBe('0%');
 // Simulate values restored after module initialization without input events.
 await page.evaluate(()=>{
  document.getElementById('coherence').value='91';
  document.getElementById('instability').value='72';
  window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
 });
 await expect(coherence).toHaveValue('43');await expect(instability).toHaveValue('0');
 await coherence.fill('10');await instability.fill('70');
 await page.getByRole('button',{name:'Reset flight',exact:true}).click();
 await expect(coherence).toHaveValue('43');await expect(instability).toHaveValue('0');
});
