'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSensorReading, TEMP_WARN_F, VEL_WARN_MM_S } = require('../src/ingest/parseSensorReading');

// Representative real-world payload from a QM30VT3-MQP sensor via DXM700
const REAL_PAYLOAD = {
  state: {
    reported: {
      gen: { id: 'DXM700-0001', time: '20260516123045' },
      regs: {
        'QM30 Temp F Raw':      8853,
        'QM30 Temp C Raw':      3141,
        'QM30 HFE Accel Raw':   21,
        'QM30 X Vel mm/s Raw':  25,
        'QM30 Y Vel mm/s Raw':  53,
        'QM30 Z Vel mm/s Raw':  67,
      },
    },
  },
};

// ── Scaling ───────────────────────────────────────────────────────────────────

describe('parseSensorReading — scaling', () => {
  it('scales temp_f_raw by /100', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.temp_f_raw, 8853);
    assert.equal(r.temp_f, 88.53);
  });

  it('scales temp_c_raw by /100', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.temp_c_raw, 3141);
    assert.equal(r.temp_c, 31.41);
  });

  it('scales hfe_accel_raw by /1000', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.hfe_accel_raw, 21);
    assert.equal(r.hfe_accel, 0.021);
  });

  it('scales x_vel_raw by /1000', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.x_vel_raw, 25);
    assert.equal(r.x_vel_mm_s, 0.025);
  });

  it('scales y_vel_raw by /1000', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.y_vel_raw, 53);
    assert.equal(r.y_vel_mm_s, 0.053);
  });

  it('scales z_vel_raw by /1000', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.z_vel_raw, 67);
    assert.equal(r.z_vel_mm_s, 0.067);
  });
});

// ── Gateway metadata ──────────────────────────────────────────────────────────

describe('parseSensorReading — gateway metadata', () => {
  it('extracts gateway_id from gen.id', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.gateway_id, 'DXM700-0001');
  });

  it('extracts gateway_time_raw from gen.time', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.gateway_time_raw, '20260516123045');
  });

  it('formats gateway_time_display as YYYY-MM-DD HH:MM:SS', () => {
    const r = parseSensorReading(REAL_PAYLOAD);
    assert.equal(r.gateway_time_display, '2026-05-16 12:30:45');
  });

  it('sets gateway_time_display null when gen.time is absent', () => {
    const payload = { state: { reported: { gen: {}, regs: {} } } };
    const r = parseSensorReading(payload);
    assert.equal(r.gateway_time_display, null);
  });

  it('sets gateway_time_display null when gen.time has wrong format', () => {
    const payload = { state: { reported: { gen: { time: '2026-05-16' }, regs: {} } } };
    const r = parseSensorReading(payload);
    assert.equal(r.gateway_time_display, null);
  });
});

// ── Missing fields ────────────────────────────────────────────────────────────

describe('parseSensorReading — missing fields', () => {
  it('returns all-null when called with null', () => {
    const r = parseSensorReading(null);
    assert.equal(r.temp_f, null);
    assert.equal(r.temp_c, null);
    assert.equal(r.hfe_accel, null);
    assert.equal(r.x_vel_mm_s, null);
  });

  it('returns all-null when called with a non-object', () => {
    const r = parseSensorReading('not an object');
    assert.equal(r.gateway_id, null);
    assert.equal(r.temp_f, null);
  });

  it('returns all-null when state.reported is missing', () => {
    const r = parseSensorReading({ state: {} });
    assert.equal(r.temp_f, null);
    assert.equal(r.gateway_id, null);
  });

  it('returns all-null when state is missing entirely', () => {
    const r = parseSensorReading({ foo: 'bar' });
    assert.equal(r.temp_f, null);
  });

  it('handles missing regs block — all sensor fields null', () => {
    const payload = { state: { reported: { gen: { id: 'GW1', time: '20260516120000' } } } };
    const r = parseSensorReading(payload);
    assert.equal(r.gateway_id, 'GW1');
    assert.equal(r.temp_f, null);
    assert.equal(r.x_vel_mm_s, null);
  });

  it('handles missing gen block — gateway fields null, regs still parsed', () => {
    const payload = {
      state: { reported: { regs: { 'QM30 Temp F Raw': 8000 } } },
    };
    const r = parseSensorReading(payload);
    assert.equal(r.gateway_id, null);
    assert.equal(r.temp_f_raw, 8000);
    assert.equal(r.temp_f, 80.0);
  });

  it('returns null for individual missing register keys', () => {
    const payload = {
      state: { reported: { gen: {}, regs: { 'QM30 Temp F Raw': 9000 } } },
    };
    const r = parseSensorReading(payload);
    assert.equal(r.temp_f_raw, 9000);
    assert.equal(r.temp_c_raw, null);
    assert.equal(r.temp_c, null);
    assert.equal(r.x_vel_mm_s, null);
  });

  it('ignores non-finite register values', () => {
    const payload = {
      state: { reported: { gen: {}, regs: { 'QM30 Temp F Raw': NaN } } },
    };
    const r = parseSensorReading(payload);
    assert.equal(r.temp_f_raw, null);
    assert.equal(r.temp_f, null);
  });

  it('ignores string register values', () => {
    const payload = {
      state: { reported: { gen: {}, regs: { 'QM30 Temp F Raw': '8853' } } },
    };
    const r = parseSensorReading(payload);
    assert.equal(r.temp_f_raw, null);
  });
});

// ── Threshold constants ───────────────────────────────────────────────────────

describe('parseSensorReading — threshold constants', () => {
  it('exports TEMP_WARN_F as 100', () => {
    assert.equal(TEMP_WARN_F, 100);
  });

  it('exports VEL_WARN_MM_S as 1.0', () => {
    assert.equal(VEL_WARN_MM_S, 1.0);
  });
});
