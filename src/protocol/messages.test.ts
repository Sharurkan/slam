import { describe, expect, it } from 'vitest';
import { reduce } from '../game/reducer';
import { INITIAL_STATE } from '../game/state';
import type { PhoneAction } from './actions';
import {
  actionMessage,
  HEARTBEAT,
  parsePhoneMessage,
  parseTvMessage,
  PROTOCOL_VERSION,
  stateMessage,
} from './messages';
import { SINGLE_PHONE_ROOM } from './room';
import { toPublicView } from './view';

const invalid = { ok: false, reason: 'invalid' };
const otherVersion = { ok: false, reason: 'version' };

describe('parsePhoneMessage', () => {
  it.each<PhoneAction>([
    { type: 'startGame', teamNames: ['A', 'B'] },
    { type: 'startGame', teamNames: ['A', 'B', 'C', 'D'] },
    { type: 'buzz', team: 0 },
    { type: 'buzz', team: 3 },
    { type: 'resetBuzz' },
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
    const data = {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'resetBuzz', cheat: true },
      extra: 1,
    };
    expect(parsePhoneMessage(data)).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action: { type: 'resetBuzz' } },
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
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'hack' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz', team: 4 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz', team: -1 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz', team: 0.5 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'startGame', teamNames: ['A'] } },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'startGame', teamNames: ['A', 'B', 'C', 'D', 'E'] },
    },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'startGame', teamNames: ['A', 'B'.repeat(21)] },
    },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'startGame', teamNames: ['A', 2] } },
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
  it('accepts a state message, during the setup and the buzz test', () => {
    const started = reduce(INITIAL_STATE, { type: 'startGame', teamNames: ['A', 'B'] });
    const buzzed = reduce(started.state, { type: 'buzz', team: 1 });
    for (const result of [{ state: INITIAL_STATE, events: [] }, started, buzzed]) {
      const message = stateMessage(toPublicView(result.state, result.events), SINGLE_PHONE_ROOM);
      expect(parseTvMessage(message)).toEqual({ ok: true, message });
    }
  });

  it('accepts a heartbeat', () => {
    expect(parseTvMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('rejects an action', () => {
    expect(parseTvMessage(actionMessage({ type: 'resetBuzz' }))).toEqual(invalid);
  });

  it('rejects a malformed view', () => {
    const view = { ...toPublicView(INITIAL_STATE, []), phase: 'cheating' };
    expect(
      parseTvMessage({ v: PROTOCOL_VERSION, type: 'state', view, room: SINGLE_PHONE_ROOM }),
    ).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parseTvMessage({ v: PROTOCOL_VERSION + 1, type: 'state', view: {} })).toEqual(
      otherVersion,
    );
  });
});
