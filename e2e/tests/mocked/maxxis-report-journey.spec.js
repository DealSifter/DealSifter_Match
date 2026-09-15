import { test, expect } from '../../fixtures/cardIntegrityFixture.js';
import { loginBaseline, openMatches, selectBaselineProperty } from '../../support/baselineActions.js';

const viewports=[['desktop',1440,900],['tablet',900,1100],['mobile',390,844]];
for(const [name,width,height] of viewports){
  test(`report journey approved layout — ${name}`,async({page,mockBackend})=>{
    await page.setViewportSize({width:1440,height:900});
    await loginBaseline(page,mockBackend.users.investor);
    await openMatches(page); await selectBaselineProperty(page);
    await page.locator('[data-guide="matches-export"]').click();
    if(name==='mobile') await page.getByRole('button',{name:'Close dialog'}).click();
    await page.setViewportSize({width,height});
    if(name==='mobile'){
      await page.getByText('Portfolio',{exact:true}).click();
      await page.locator('[data-guide="matches-portfolio"]').getByText('Dallas, TX',{exact:true}).first().click();
      await page.locator('[data-guide="matches-export"]:visible').click();
    }
    const selector=page.getByTestId('report-experience-selector');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveAttribute('data-stage','delivery');
    await expect(selector.getByText('BASIC PROPERTY RELEASE',{exact:true})).toHaveCount(2);
    await expect(selector.getByText('MAXXIS AI ANALYSIS',{exact:true})).toBeVisible();
    await expect(selector.locator('.is-selected')).toHaveCount(0);
    const rows=selector.locator('.report-action-row');
    const first=await rows.nth(0).boundingBox(); const second=await rows.nth(1).boundingBox();
    expect(first&&second&&second.y>first.y+first.height-2).toBeTruthy();
    await selector.getByLabel('Preview BASIC PROPERTY RELEASE').first().click();
    await expect(page.locator('.report-experience-selector').getByText(/Page 1 of 1/)).toBeVisible();
    await page.locator('.report-experience-selector').getByRole('button',{name:/Back/}).click();
    await selector.getByLabel('Preview MAXXIS AI ANALYSIS').click();
    const analysisPreview=page.locator('.report-experience-selector');
    await expect(analysisPreview.getByText(/Page 1 of 3/)).toBeVisible();
    await analysisPreview.getByRole('button',{name:'Next page'}).click();
    await analysisPreview.getByRole('button',{name:'Next page'}).click();
    await expect(analysisPreview.getByText(/Page 3 of 3/)).toBeVisible();
    await analysisPreview.getByRole('button',{name:/Back/}).click();
    await selector.getByText('AI-powered property analysis').click();
    await expect(selector).toHaveAttribute('data-stage','intelligence');
    await expect(selector.getByText('DEAL INTELLIGENCE REPORT')).toBeVisible();
    await selector.getByLabel('Preview DEAL INTELLIGENCE REPORT').click();
    await expect(page.locator('.report-experience-selector').getByText(/Page 1 of 6/)).toBeVisible();
    const box=await page.locator('.report-experience-selector .report-preview-sheet').boundingBox();
    expect(box&&box.height>280&&box.x>=0&&box.y>=0&&box.y+box.height<=height).toBeTruthy();
    await page.screenshot({path:`test-results/report-journey-${name}.png`,fullPage:false});
  });
}
