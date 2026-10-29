import { Claim } from '../../models/claim';
import { CLAIM_STATUSES, ClaimStatus } from '../../models/enums';
import {
  Actor,
  availableActions,
  canAssign,
  handledByManager,
  TRANSITIONS,
} from './claim-workflow';

const CLAIMANT: Actor = { id: 1, role: 'CLAIMANT' };
const OFFICER: Actor = { id: 3, role: 'OFFICER' };
const MANAGER: Actor = { id: 5, role: 'MANAGER' };

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 10,
    claimNumber: 'CLM-2026-000010',
    claimantId: 1,
    claimantName: 'Aiko Tanaka',
    market: 'JP',
    claimType: 'MOTOR',
    description: 'Rear-ended at a junction',
    claimAmount: 1200,
    incidentDate: '2026-09-01',
    status: 'OPEN',
    assignedOfficerId: null,
    infoRequest: null,
    lastReply: null,
    createdAt: '2026-09-02T10:00:00',
    updatedAt: '2026-09-02T10:00:00',
    ...overrides,
  };
}

const targets = (c: Claim, actor: Actor) => availableActions(c, actor).map((a) => a.target);

describe('claim workflow actions', () => {
  describe('claimant', () => {
    it('can answer an information request on their own claim', () => {
      const actions = availableActions(claim({ status: 'ON_HOLD' }), CLAIMANT);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        id: 'reply',
        target: 'UNDER_REVIEW',
        remarks: 'required',
      });
    });

    it('can do nothing else', () => {
      for (const status of CLAIM_STATUSES.filter((s) => s !== 'ON_HOLD')) {
        expect(availableActions(claim({ status }), CLAIMANT)).toEqual([]);
      }
    });

    it("cannot answer on someone else's claim", () => {
      expect(availableActions(claim({ status: 'ON_HOLD', claimantId: 2 }), CLAIMANT)).toEqual([]);
    });
  });

  describe('officer', () => {
    it('starts review or closes a claim assigned to them', () => {
      expect(targets(claim({ status: 'ASSIGNED', assignedOfficerId: 3 }), OFFICER)).toEqual([
        'UNDER_REVIEW',
        'CLOSED',
      ]);
    });

    it('can decide, or put on hold, a claim under review; rejecting and holding need a reason', () => {
      const actions = availableActions(
        claim({ status: 'UNDER_REVIEW', assignedOfficerId: 3 }),
        OFFICER,
      );

      expect(actions.map((a) => a.target)).toEqual(['APPROVED', 'REJECTED', 'ON_HOLD']);
      expect(actions.filter((a) => a.remarks === 'required').map((a) => a.target)).toEqual([
        'REJECTED',
        'ON_HOLD',
      ]);
    });

    it('can only close a claim that is waiting for the claimant', () => {
      expect(targets(claim({ status: 'ON_HOLD', assignedOfficerId: 3 }), OFFICER)).toEqual([
        'CLOSED',
      ]);
    });

    it('can pick up an unassigned open claim, which also starts the review', () => {
      const actions = availableActions(claim({ status: 'OPEN', assignedOfficerId: null }), OFFICER);

      expect(actions.map((a) => a.label)).toEqual(['Pick up and start review', 'Close claim']);
    });

    it("has no actions on another officer's claim", () => {
      expect(
        availableActions(claim({ status: 'UNDER_REVIEW', assignedOfficerId: 4 }), OFFICER),
      ).toEqual([]);
    });

    it('has no actions on an unassigned claim that is not open', () => {
      expect(
        availableActions(claim({ status: 'APPROVED', assignedOfficerId: null }), OFFICER),
      ).toEqual([]);
    });
  });

  describe('manager', () => {
    it('can start the review of an open claim themselves, with no officer, or close it', () => {
      const open = claim({ status: 'OPEN', assignedOfficerId: null });

      const actions = availableActions(open, MANAGER);

      expect(actions.map((a) => a.target)).toEqual(['UNDER_REVIEW', 'CLOSED']);
      expect(actions.map((a) => a.label)).toEqual(['Start review', 'Close claim']);
      expect(actions[0].description).toContain('no officer assigned');
    });

    it('can still hand an open claim to an officer instead', () => {
      expect(canAssign(claim({ status: 'OPEN' }), MANAGER)).toBe(true);
    });

    it('takes a claim all the way from open to closed without an officer', () => {
      // Each step is what the backend allows next, and none of them needs the claim to be assigned.
      const path: ClaimStatus[] = ['UNDER_REVIEW', 'APPROVED', 'SETTLED', 'CLOSED'];
      let status: ClaimStatus = 'OPEN';
      for (const next of path) {
        expect(targets(claim({ status, assignedOfficerId: null }), MANAGER)).toContain(next);
        status = next;
      }
    });

    it('can ask for information, or reject, a claim it is reviewing itself, and both need a reason', () => {
      const reviewing = claim({ status: 'UNDER_REVIEW', assignedOfficerId: null });

      const byTarget = Object.fromEntries(
        availableActions(reviewing, MANAGER).map((a) => [a.target, a]),
      );

      expect(Object.keys(byTarget)).toEqual(['APPROVED', 'REJECTED', 'ON_HOLD']);
      expect(byTarget['REJECTED'].remarks).toBe('required');
      expect(byTarget['ON_HOLD'].remarks).toBe('required');
    });

    it.each<[ClaimStatus, ClaimStatus[]]>([
      ['ASSIGNED', ['UNDER_REVIEW', 'CLOSED']],
      ['UNDER_REVIEW', ['APPROVED', 'REJECTED', 'ON_HOLD']],
      ['ON_HOLD', ['CLOSED']],
      ['APPROVED', ['SETTLED']],
      ['REJECTED', ['CLOSED']],
      ['SETTLED', ['CLOSED']],
      ['CLOSED', []],
    ])('from %s can go to %j', (status, expected) => {
      expect(targets(claim({ status, assignedOfficerId: 3 }), MANAGER)).toEqual(expected);
    });

    it('can assign or reassign only while a claim is open or in progress', () => {
      for (const status of CLAIM_STATUSES) {
        const expected = ['OPEN', 'ASSIGNED', 'UNDER_REVIEW', 'ON_HOLD'].includes(status);
        expect(canAssign(claim({ status }), MANAGER)).toBe(expected);
      }
    });

    it('is the only role that can assign', () => {
      expect(canAssign(claim(), OFFICER)).toBe(false);
      expect(canAssign(claim(), CLAIMANT)).toBe(false);
    });
  });

  describe('a claim a manager is handling directly', () => {
    it('is one past open with no officer', () => {
      expect(handledByManager(claim({ status: 'UNDER_REVIEW', assignedOfficerId: null }))).toBe(
        true,
      );
      expect(handledByManager(claim({ status: 'ON_HOLD', assignedOfficerId: null }))).toBe(true);
      expect(handledByManager(claim({ status: 'OPEN', assignedOfficerId: null }))).toBe(false);
      expect(handledByManager(claim({ status: 'UNDER_REVIEW', assignedOfficerId: 3 }))).toBe(false);
    });

    it('is not something an officer can act on, which is what the backend enforces', () => {
      for (const status of CLAIM_STATUSES.filter((s) => s !== 'OPEN')) {
        expect(availableActions(claim({ status, assignedOfficerId: null }), OFFICER)).toEqual([]);
      }
    });

    it('leaves an officer to pick up an open claim as before, never to skip the pick-up', () => {
      const actions = availableActions(claim({ status: 'OPEN', assignedOfficerId: null }), OFFICER);

      expect(actions.map((a) => a.label)).toEqual(['Pick up and start review', 'Close claim']);
    });
  });

  it('never offers ASSIGNED as a status move, and never a move the backend would refuse', () => {
    for (const status of CLAIM_STATUSES) {
      for (const actor of [CLAIMANT, OFFICER, MANAGER]) {
        const c = claim({ status, assignedOfficerId: 3, claimantId: 1 });
        for (const target of targets(c, actor)) {
          expect(target).not.toBe('ASSIGNED');
          const allowed =
            status === 'ON_HOLD' && actor.role === 'CLAIMANT'
              ? ['UNDER_REVIEW']
              : TRANSITIONS[status];
          expect(allowed).toContain(target);
        }
      }
    }
  });
});
