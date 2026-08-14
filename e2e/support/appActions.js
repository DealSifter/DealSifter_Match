export async function openLogin(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  const desktopLogin = page.getByTestId('nav-login');
  if (await desktopLogin.isVisible().catch(() => false)) {
    await desktopLogin.click();
    return;
  }
  await page.getByTestId('nav-app-menu').click();
  await page.getByTestId('nav-login-mobile').click();
}

export async function loginAs(page, user) {
  await openLogin(page);
  await page.getByTestId('auth-tab-login').click();
  await page.getByTestId('auth-email').fill(user.email);
  await page.getByTestId('auth-password').fill(user.password);
  const loginResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/v1/token'));
  await page.getByTestId('auth-submit').click({ force: true });
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    throw new Error(`E2E login failed with ${loginResponse.status()}: ${await loginResponse.text()}`);
  }
  await page.getByTestId('dashboard-root').waitFor({ state: 'visible' });
}

export async function logout(page) {
  await page.evaluate(async () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) keys.push(key);
    }
    keys
      .filter((key) => key.includes('auth') || key.includes('supabase'))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('ds_last_page', 'landing');
  });
}

export async function openMaxxis(page) {
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await page.getByTestId('maxxis-panel').waitFor({ state: 'visible' });
}
