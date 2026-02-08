import { describe, it, expect } from 'vitest';
import { calculateMembershipSplit, applyPercentageSplit } from '../split-engine';

const NATIONAL_ID = 'national-chapter-uuid';
const STATE_ID = 'state-chapter-uuid';
const REGION_ID = 'region-chapter-uuid';
const COUNTY_ID = 'county-chapter-uuid';

describe('calculateMembershipSplit', () => {
  it('gives 100% to National when no state chapter exists', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: null,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({
      recipientChapterId: NATIONAL_ID,
      amountCents: 4500,
      isNational: true,
    });
  });

  it('gives National $15 and remainder to state for Individual ($45)', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({
      recipientChapterId: NATIONAL_ID,
      amountCents: 1500,
      isNational: true,
    });
    expect(result.allocations[1]).toEqual({
      recipientChapterId: STATE_ID,
      amountCents: 3000,
      isNational: false,
    });
    expect(result.allocations[0].amountCents + result.allocations[1].amountCents).toBe(4500);
  });

  it('gives National $15 and remainder to state for Student/Military ($30)', () => {
    const result = calculateMembershipSplit({
      totalCents: 3000,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(1500);
  });

  it('gives National $15 and remainder to state for Premium ($75)', () => {
    const result = calculateMembershipSplit({
      totalCents: 7500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(6000);
  });

  it('gives National $15 and remainder to state for Sustaining ($150)', () => {
    const result = calculateMembershipSplit({
      totalCents: 15000,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(13500);
  });

  it('gives National $15 and remainder to state for Roundtable ($1500)', () => {
    const result = calculateMembershipSplit({
      totalCents: 150000,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(148500);
  });

  it('gives 100% to National when amount equals national fee', () => {
    const result = calculateMembershipSplit({
      totalCents: 1500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[0].recipientChapterId).toBe(NATIONAL_ID);
  });

  it('gives 100% to National when amount is less than national fee', () => {
    const result = calculateMembershipSplit({
      totalCents: 500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amountCents).toBe(500);
  });

  it('sends remainder to state when state_managed disbursement', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: { disbursement_model: 'state_managed', is_active: true },
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientChapterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('applies sub-split rules when national_managed', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [
        { recipient_chapter_id: STATE_ID, percentage: 60, is_active: true },
        { recipient_chapter_id: REGION_ID, percentage: 30, is_active: true },
        { recipient_chapter_id: COUNTY_ID, percentage: 10, is_active: true },
      ],
    });

    // National gets $15 = 1500 cents
    expect(result.allocations[0].amountCents).toBe(1500);

    // Remainder = 3000 cents, split 60/30/10
    const subAllocations = result.allocations.slice(1);
    const totalSub = subAllocations.reduce((s, a) => s + a.amountCents, 0);
    expect(totalSub).toBe(3000);

    // 60% of 3000 = 1800
    const stateAlloc = subAllocations.find((a) => a.recipientChapterId === STATE_ID);
    expect(stateAlloc?.amountCents).toBe(1800);

    // 30% of 3000 = 900
    const regionAlloc = subAllocations.find((a) => a.recipientChapterId === REGION_ID);
    expect(regionAlloc?.amountCents).toBe(900);

    // 10% of 3000 = 300
    const countyAlloc = subAllocations.find((a) => a.recipientChapterId === COUNTY_ID);
    expect(countyAlloc?.amountCents).toBe(300);
  });

  it('falls back to state when national_managed but no active rules', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientChapterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('ignores inactive rules', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [
        { recipient_chapter_id: STATE_ID, percentage: 100, is_active: true },
        { recipient_chapter_id: REGION_ID, percentage: 50, is_active: false },
      ],
    });

    // Only active rule (state=100%) applies
    const subAllocations = result.allocations.slice(1);
    expect(subAllocations).toHaveLength(1);
    expect(subAllocations[0].recipientChapterId).toBe(STATE_ID);
    expect(subAllocations[0].amountCents).toBe(3000);
  });

  it('treats inactive config same as no config', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalChapterId: NATIONAL_ID,
      stateChapterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: false },
      splitRules: [
        { recipient_chapter_id: STATE_ID, percentage: 60, is_active: true },
        { recipient_chapter_id: REGION_ID, percentage: 40, is_active: true },
      ],
    });

    // Inactive config → all remainder to state
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientChapterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('total allocations always sum to total payment', () => {
    const tiers = [3000, 4500, 7500, 15000, 35000, 75000, 150000];
    for (const totalCents of tiers) {
      const result = calculateMembershipSplit({
        totalCents,
        nationalChapterId: NATIONAL_ID,
        stateChapterId: STATE_ID,
        splitConfig: { disbursement_model: 'national_managed', is_active: true },
        splitRules: [
          { recipient_chapter_id: STATE_ID, percentage: 50, is_active: true },
          { recipient_chapter_id: REGION_ID, percentage: 30, is_active: true },
          { recipient_chapter_id: COUNTY_ID, percentage: 20, is_active: true },
        ],
      });

      const sum = result.allocations.reduce((s, a) => s + a.amountCents, 0);
      expect(sum).toBe(totalCents);
    }
  });
});

describe('applyPercentageSplit', () => {
  it('splits evenly with no rounding issues', () => {
    const result = applyPercentageSplit(1000, [
      { recipient_chapter_id: 'a', percentage: 50, is_active: true },
      { recipient_chapter_id: 'b', percentage: 50, is_active: true },
    ]);

    expect(result).toHaveLength(2);
    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(1000);
    expect(result.find((r) => r.recipientChapterId === 'a')?.amountCents).toBe(500);
    expect(result.find((r) => r.recipientChapterId === 'b')?.amountCents).toBe(500);
  });

  it('handles rounding with largest-remainder method', () => {
    // 3333 cents split 33.33 / 33.33 / 33.34
    // Raw: 1110.89 / 1110.89 / 1111.22
    // Floor: 1110 / 1110 / 1111 = 3331
    // Leftover: 2 pennies → distributed to highest fractional
    const result = applyPercentageSplit(3333, [
      { recipient_chapter_id: 'a', percentage: 33.33, is_active: true },
      { recipient_chapter_id: 'b', percentage: 33.33, is_active: true },
      { recipient_chapter_id: 'c', percentage: 33.34, is_active: true },
    ]);

    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(3333);
  });

  it('handles single recipient at 100%', () => {
    const result = applyPercentageSplit(4500, [
      { recipient_chapter_id: 'a', percentage: 100, is_active: true },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(4500);
  });

  it('handles very uneven splits', () => {
    const result = applyPercentageSplit(10000, [
      { recipient_chapter_id: 'a', percentage: 99.99, is_active: true },
      { recipient_chapter_id: 'b', percentage: 0.01, is_active: true },
    ]);

    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(10000);
  });
});
