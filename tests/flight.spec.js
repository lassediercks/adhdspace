import { test, expect } from '@playwright/test';

async function seedField(page,seed=31) {
 await page.addInitScript(seed=>{
  const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=seed;return array;}return original(array);};
 },seed);
}

test('flight offers only coherence and rescue, with read-only weather and an always-on trail',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 await expect(page.locator('canvas')).toBeVisible();await expect(page.locator('#error')).toBeHidden();
 const controls=page.getByRole('region',{name:'Flight controls'});
 await expect(controls.getByRole('slider')).toHaveCount(1);
 await expect(controls.getByRole('button')).toHaveCount(1);
 await expect(page.getByRole('switch')).toHaveCount(0);
 await expect(page.getByRole('meter',{name:'Instability',exact:true})).toBeVisible();
 await expect(page.getByRole('meter',{name:'Fuel',exact:true})).toBeVisible();
 await expect(page.locator('#fuel-rate')).toHaveText(/−[0-9]+\.[0-9]{2}% \/ s/);
 await expect(page.getByRole('button',{name:'Rescue boost',exact:true})).toBeDisabled();
 const coherence=page.getByRole('slider',{name:'Stabilizer engines',exact:true});
 await coherence.fill('100');await expect(page.locator('#coherence-output')).toHaveText('100%');
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/coherence-transition.png'});
 await coherence.fill('0');await expect(page.locator('#coherence-output')).toHaveText('0%');
 await page.getByRole('button',{name:'About this experiment'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:'test-results/desktop.png'});expect(errors).toEqual([]);
});

test('mobile controls and the right-hand weather indicator fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedField(page);
 await page.goto('http://127.0.0.1:5173');
 await expect(page.getByRole('slider',{name:'Stabilizer engines',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Rescue boost',exact:true})).toBeVisible();
 const meter=page.getByRole('meter',{name:'Instability',exact:true});await expect(meter).toBeVisible();
 expect((await meter.boundingBox()).x).toBeGreaterThan(300);
 expect((await page.getByRole('meter',{name:'Fuel',exact:true}).boundingBox()).x).toBeLessThan(90);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png'});
});

test('refresh and restored form values stay synchronized with coherence defaults',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const coherence=page.getByRole('slider',{name:'Stabilizer engines',exact:true});await coherence.fill('100');
 await page.reload();await expect(coherence).toHaveValue('43');
 await expect(page.locator('#coherence-output')).toHaveText('43%');
 expect(await coherence.evaluate(el=>el.style.getPropertyValue('--fill'))).toBe('43%');
 await page.evaluate(()=>{document.getElementById('coherence').value='91';window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await expect(coherence).toHaveValue('43');
});

test('a real seeded lock loss enables rescue and the burn recovers control',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await seedField(page,6511);await page.goto('http://127.0.0.1:5173');
 const rescue=page.getByRole('button',{name:'Rescue boost',exact:true});
 await expect(rescue).toBeEnabled({timeout:15000});
 await page.getByRole('slider',{name:'Stabilizer engines',exact:true}).fill('100');
 await page.waitForTimeout(1000);await expect(rescue).toBeEnabled();
 await rescue.click();await expect(rescue).toBeDisabled();
 await expect(rescue).toHaveText(/Boosting · [0-9]+s/);
 await expect(rescue).toHaveText(/Rescue boost · [0-9]+s/,{timeout:30000});
 await expect(rescue).toBeDisabled();expect(errors).toEqual([]);
});


test('stabilizer lever moves vertically with pointer and keyboard input',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const lever=page.getByRole('slider',{name:'Stabilizer engines',exact:true});
 await expect(lever).toHaveAttribute('aria-orientation','vertical');
 const box=await lever.boundingBox();expect(box.height).toBeGreaterThan(box.width*2);
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.9);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.1,{steps:10});await page.mouse.up();
 expect(Number(await lever.inputValue())).toBeGreaterThan(80);
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.1);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.9,{steps:10});await page.mouse.up();
 expect(Number(await lever.inputValue())).toBeLessThan(20);
 await lever.focus();await page.keyboard.press('Home');await expect(lever).toHaveValue('0');
 await page.keyboard.press('ArrowUp');await expect(lever).toHaveValue('1');
});
