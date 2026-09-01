import { test, expect } from '@playwright/test';

/**
 * Project A.E.G.I.S — End-to-End Mission Loop (Phase 10 §10)
 *
 * Drives the fallback console — the exact harness anyone without a
 * WebMCP-capable browser uses (Phase 0) — through the §0 loop: scan,
 * a real BLOCKED_GEOMETRY rejection, autonomous recovery via
 * override_facility_mechanism, a successful re-stage, human approval
 * through the Authority Gate HUD, and execution. Every step calls the
 * same `execute()` handler a live agent would call; this test never
 * touches internal state directly.
 */

test.describe('A.E.G.I.S mission loop via fallback console', () => {
  test('scan -> rejected stage -> mechanism override -> re-stage -> approve -> execute', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for the shell to mount (Header renders immediately, independent
    // of the client-only 3D canvas chunk).
    await expect(page.getByText('A.E.G.I.S', { exact: true })).toBeVisible();

    // Exercise the Phase 10 postprocessing quality toggle in a real
    // browser — Effects.tsx / @react-three/postprocessing has no other
    // coverage, and it's exactly the kind of GPU-pipeline code that fails
    // silently or throws only at runtime, never at typecheck. Pass 1's
    // header redesign demoted this to a small "FX" dev-tools button whose
    // state is conveyed by aria-pressed, not by its label text.
    const qualityToggle = page.getByRole('button', { name: 'FX', exact: true });
    await expect(qualityToggle).toHaveAttribute('aria-pressed', 'false');
    await qualityToggle.click();
    await expect(qualityToggle).toHaveAttribute('aria-pressed', 'true');
    // Give the EffectComposer a moment to mount and render a frame; the
    // page must stay alive and interactive, not crash into the error
    // boundary or a blank tab.
    await page.waitForTimeout(500);
    await expect(page.getByText('3D VIEWPORT RENDER FAILURE')).toHaveCount(0);
    await qualityToggle.click();
    await expect(qualityToggle).toHaveAttribute('aria-pressed', 'false');

    // Open the fallback console — the Phase 0 dev harness that calls the
    // exact same execute() functions a WebMCP agent would.
    await page.getByRole('button', { name: 'CONSOLE', exact: true }).click();
    await expect(page.getByText('WEBMCP ACTION & READ HARNESS')).toBeVisible();

    const invokeButton = page.getByRole('button', { name: 'INVOKE TOOL DIRECTLY' });
    const resultText = page.locator('pre code').first();

    async function invokeAndParse(): Promise<any> {
      await invokeButton.click();
      await expect(resultText).not.toHaveText('', { timeout: 10_000 });
      const text = await resultText.textContent();
      return JSON.parse(text ?? '{}');
    }

    // 1. scan_spatial_environment — perception call, always safe.
    await page.getByRole('button', { name: 'scan_spatial_environment', exact: true }).click();
    const scanResult = await invokeAndParse();
    expect(scanResult.status ?? 'OK').not.toBe('INTERNAL_ERROR');

    // 2. stage_locomotion_plan targeting the extraction point — blocked by
    // the armed laser_gate_02 in the default facility state. This is the
    // real rejection: a REJECTED_STABILITY/BLOCKED_GEOMETRY loop, not a
    // scripted demo.
    await page.getByRole('button', { name: 'stage_locomotion_plan', exact: true }).click();
    await page.getByRole('button', { name: /Stage Walk to Extraction/ }).click();
    const blockedResult = await invokeAndParse();
    expect(blockedResult.status).toBe('BLOCKED_GEOMETRY');
    expect(blockedResult.suggested_action).toContain('laser_gate_02');

    // 3. Autonomous recovery: override_facility_mechanism to disarm the
    // blocking gate, exactly as suggested_action instructed.
    await page.getByRole('button', { name: 'override_facility_mechanism', exact: true }).click();
    await page.getByRole('button', { name: /Disarm laser_gate_02/ }).click();
    const overrideResult = await invokeAndParse();
    expect(overrideResult.new_state).toBe('DISARMED');
    expect(overrideResult.passable).toBe(true);

    // 4. Re-stage the same target — now succeeds and stages a real
    // proposal in the Human Authority Gate.
    await page.getByRole('button', { name: 'stage_locomotion_plan', exact: true }).click();
    await page.getByRole('button', { name: /Stage Walk to Extraction/ }).click();
    const stagedResult = await invokeAndParse();
    expect(stagedResult.status).toBe('PENDING_APPROVAL');
    expect(stagedResult.proposal_id).toBeTruthy();

    // 5. Human Authority Gate — under the default MANUAL_APPROVAL policy,
    // motion cannot commit without this. Approve it as the operator.
    // Pass 1's redesign made this a fixed-height region (not a dialog) with
    // a status badge that renders the raw approvalStatus enum as its text.
    const gate = page.getByRole('region', { name: 'Human Authority Gate' });
    await expect(gate).toBeVisible();
    await expect(gate.getByText('PENDING_APPROVAL')).toBeVisible();
    await gate.getByRole('button', { name: 'Approve Route' }).click();
    await expect(gate.getByText('AUTHORIZED — awaiting execute_staged_proposal')).toBeVisible();

    // 6. execute_staged_proposal — the console auto-fills proposal_id from
    // the currently staged proposal. Strictly enforces the gate we just
    // satisfied (execute_staged_proposal.ts rejects with GATE_LOCKED
    // otherwise).
    await page.getByRole('button', { name: 'execute_staged_proposal', exact: true }).click();
    const executeResult = await invokeAndParse();
    expect(executeResult.status).toBe('EXECUTING');

    // EMERGENCY STOP only renders in the EXECUTING state — an unambiguous signal.
    await expect(gate.getByRole('button', { name: 'EMERGENCY STOP' })).toBeVisible();
  });
});
