import { describe, expect, it } from 'vitest';
import { INITIAL_STATE } from '../game/state';
import type { PhoneAction } from './actions';
import {
  actionMessage,
  HEARTBEAT,
  parsePhoneMessage,
  parseTvMessage,
  PROTOCOL_VERSION,
} from './messages';
import { SINGLE_PHONE_ROOM } from './room';
import { toPublicView } from './view';

const invalid = { ok: false, reason: 'invalid' };
const otherVersion = { ok: false, reason: 'version' };

function withAction(action: unknown) {
  return { v: PROTOCOL_VERSION, type: 'action', action };
}

describe('parsePhoneMessage', () => {
  it.each<PhoneAction>([
    { type: 'startGame', teamNames: ['A', 'B'] },
    { type: 'startGame', teamNames: ['A', 'B', 'C', 'D'], firstRound: 3, gridId: 'f-01' },
    { type: 'buzz', team: 0 },
    { type: 'buzz', team: 3 },
    { type: 'submitLetter', letter: 'é' },
    { type: 'skipQuestion' },
    { type: 'chooseWord', word: 12 },
    { type: 'submitWord', answer: 'Éléphant' },
    { type: 'cancelWord' },
    { type: 'startSlam' },
    { type: 'submitSlam', answers: [{ word: 1, answer: 'chat' }] },
    { type: 'revealGrid' },
    { type: 'nextRound' },
    { type: 'pickFinalNumber', index: 7 },
    { type: 'submitFinalWord', answer: 'chat' },
    { type: 'passFinalWord' },
    { type: 'abandonGame' },
    { type: 'newGame' },
  ])('accepts the action %j', (action) => {
    expect(parsePhoneMessage(actionMessage(action))).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action },
    });
  });

  it('accepts a heartbeat', () => {
    expect(parsePhoneMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('drops unknown fields', () => {
    const data = { ...withAction({ type: 'startSlam', cheat: true }), extra: 1 };
    expect(parsePhoneMessage(data)).toEqual({
      ok: true,
      message: withAction({ type: 'startSlam' }),
    });
  });

  it.each([
    null,
    'buzz',
    42,
    [],
    {},
    { v: PROTOCOL_VERSION },
    { v: PROTOCOL_VERSION, type: 'action' },
    withAction({ type: 'hack' }),
    withAction({ type: 'finalTick' }),
    withAction({ type: 'resumeFinal' }),
    withAction({ type: 'buzz', team: 4 }),
    withAction({ type: 'buzz', team: -1 }),
    withAction({ type: 'buzz', team: 0.5 }),
    withAction({ type: 'submitLetter', letter: '' }),
    withAction({ type: 'submitLetter', letter: 'ABC' }),
    withAction({ type: 'chooseWord', word: 0 }),
    withAction({ type: 'chooseWord', word: 13 }),
    withAction({ type: 'submitWord', answer: 'A'.repeat(31) }),
    withAction({ type: 'submitWord' }),
    withAction({ type: 'submitSlam', answers: [{ word: 1 }] }),
    withAction({ type: 'pickFinalNumber', index: 8 }),
    withAction({ type: 'startGame', teamNames: ['A'] }),
    withAction({ type: 'startGame', teamNames: ['A', 'B', 'C', 'D', 'E'] }),
    withAction({ type: 'startGame', teamNames: ['A', 'B'.repeat(21)] }),
    withAction({ type: 'startGame', teamNames: ['A', 'B'], firstRound: 4 }),
    { v: PROTOCOL_VERSION, type: 'state', view: toPublicView(INITIAL_STATE, []) },
    { v: '1', type: 'heartbeat' },
  ])('rejects %j as invalid', (data) => {
    expect(parsePhoneMessage(data)).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parsePhoneMessage({ v: PROTOCOL_VERSION + 1, type: 'action' })).toEqual(otherVersion);
  });
});

describe('parseTvMessage', () => {
  it('accepts a heartbeat', () => {
    expect(parseTvMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('rejects an action', () => {
    expect(parseTvMessage(actionMessage({ type: 'startSlam' }))).toEqual(invalid);
  });

  it('rejects a malformed view', () => {
    const view = { ...toPublicView(INITIAL_STATE, []), phase: 'cheating' };
    const message = { v: PROTOCOL_VERSION, type: 'state', view, room: SINGLE_PHONE_ROOM };
    expect(parseTvMessage(message)).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parseTvMessage({ v: PROTOCOL_VERSION + 1, type: 'state', view: {} })).toEqual(
      otherVersion,
    );
  });
});
