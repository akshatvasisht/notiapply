import { test, expect } from '@playwright/test';

test.describe('Notiapply Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Handle Welcome Screen if it appears
        const getStartedButton = page.getByText('Get Started');
        if (await getStartedButton.isVisible()) {
            await getStartedButton.click();
        }

        // Handle Setup Wizard if it appears (bypass with DEV button)
        // Correct text is "[DEV] Skip Setup" as per SetupWizard.tsx
        const skipButton = page.getByText('[DEV] Skip Setup');
        if (await skipButton.isVisible()) {
            await skipButton.click();
        }
    });

    test('should load the dashboard and show the jobs board by default', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        await expect(page.getByText('Notiapply')).toBeVisible();
        await expect(page.getByText('Incoming')).toBeVisible();
        await expect(page.getByText('Ready')).toBeVisible();
    });

    test('should toggle between Jobs and CRM views', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        // Switch to CRM
        await page.click('text=Outreach CRM', { force: true });
        await expect(page.getByText('Prospects')).toBeVisible();
        await expect(page.getByText('Drafting')).toBeVisible();

        // Switch back to Jobs
        await page.click('text=Jobs Pipeline', { force: true });
        await expect(page.getByText('Incoming')).toBeVisible();
    });

    test('should open a Job Detail modal on card click', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        // Click the first job card - search for a specific title in mock data
        await page.locator('div').filter({ hasText: /^Backend Engineer$/ }).nth(0).click();

        // Verify modal is open
        await expect(page.getByText('‹ Back')).toBeVisible();
        await expect(page.getByText('Status')).toBeVisible();
    });

    test('should filter cards when searching', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        const searchInput = page.getByPlaceholder('Search by title, company, location…');
        await searchInput.fill('NonExistentJob123');

        // Verify no cards are visible (search indicator)
        await expect(page.locator('div[style*="border-left"]')).not.toBeVisible();

        // Verify Incoming count badge is NOT visible (since it's 0)
        await expect(page.locator('div').filter({ hasText: /^Incoming$/ }).locator('..').getByText('0')).not.toBeVisible();
    });

    test('should properly display enriched contact info in CRM', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        await page.click('text=Outreach CRM', { force: true });

        // Click on Dario Amodei
        await page.click('text=Dario Amodei');

        // Check for Notiapply-specific enrichment (Outreach Coaching)
        await expect(page.getByText('consider a follow-up')).toBeVisible();

        // Check for Company Intel
        await expect(page.getByText('Artificial Intelligence')).toBeVisible();
        await expect(page.getByText('Series D')).toBeVisible();

        // Check for Recent Activity digest
        await expect(page.getByText('Recent LinkedIn Activity')).toBeVisible();
    });

    test('should move a contact card via drag and drop', async ({ page }) => {
        // Wait for loading to disappear
        await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

        await page.click('text=Outreach CRM', { force: true });

        // Get the first card in 'Prospects' (Dario Amodei)
        const darioCard = page.locator('div').filter({ hasText: /^Dario Amodei$/ }).nth(0);
        const draftingColumn = page.locator('div').filter({ hasText: /^Drafting$/ }).nth(0);

        // Perform drag and drop
        await darioCard.dragTo(draftingColumn);

        // Verify the card is now in the 'Drafting' section or the count changed
        // In this app, we can check if the card is visible under the 'Drafting' label
        await expect(draftingColumn.locator('..').getByText('Dario Amodei')).toBeVisible();
    });
});
