import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}\n${(e.stack||'').split('\n').slice(0,8).join('\n')}`));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`[console.error] ${m.text().slice(0,400)}`); });
await p.goto('http://127.0.0.1:3002/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
async function step(label, fn) {
  try { await fn(); } catch (e) { errs.push(`[step ${label} threw] ${e.message.slice(0,200)}`); }
  await p.waitForTimeout(900);
  errs.push(`--- after: ${label} ---`);
}
await step('add text', () => p.getByRole('button', { name: /add text/i }).first().click());
await step('add mark', () => p.getByRole('button', { name: /add mark/i }).first().click());
await step('hoodie', () => p.getByRole('button', { name: /^hoodie$/i }).first().click({ force: true }));
await step('back view', () => p.getByRole('button', { name: /^back$/i }).first().click({ force: true }));
await step('stitch', () => p.getByRole('button', { name: /^stitch$/i }).first().click({ force: true }));
await step('tee', () => p.getByRole('button', { name: /^t-shirt$/i }).first().click({ force: true }));
await step('front view', () => p.getByRole('button', { name: /^front$/i }).first().click({ force: true }));
await step('reload with state', async () => { await p.reload({ waitUntil: 'networkidle' }); });
console.log(errs.join('\n').slice(0, 5000));
await p.screenshot({ path: '/tmp/err.png' });
await b.close();
