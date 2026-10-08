// Shared: open the Math tester on a primitive + eval mode, generate, return { page, data }.
import { chromium } from 'playwright-core';
export const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';

export async function open({ primitive, mode, grade }) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);
  await page.getByText('Developer Tools').first().click();
  for (let i = 0; i < 10; i++) {
    await page.getByText('Math Primitives', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    if (await page.getByRole('button', { name: /Generate with AI/ }).count()) break;
  }
  await page.getByRole('button', { name: new RegExp(primitive) }).first().click();
  await page.waitForTimeout(800);
  if (grade) await page.locator('label:has-text("Grade Level") + select').selectOption({ label: grade }).catch(() => {});
  await page.getByRole('button', { name: new RegExp(mode.replace(/[()]/g, '\\$&')) }).first().click();
  await page.waitForTimeout(500);
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate with AI/ }).click();
  const data = await (await resp).json().catch(() => null);
  await page.waitForTimeout(4000);
  return { browser, page, data: data?.data ?? data, errors };
}

export const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
