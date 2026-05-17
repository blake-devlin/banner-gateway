'use strict';

const TEMP_WARN_F = 100;
const VEL_WARN_MM_S = 1.0;

function parseSensorReading(parsedPayload) {
  const empty = {
    gateway_id: null, gateway_time_raw: null, gateway_time_display: null,
    temp_f_raw: null, temp_f: null,
    temp_c_raw: null, temp_c: null,
    hfe_accel_raw: null, hfe_accel: null,
    x_vel_raw: null, x_vel_mm_s: null,
    y_vel_raw: null, y_vel_mm_s: null,
    z_vel_raw: null, z_vel_mm_s: null,
  };

  try {
    if (!parsedPayload || typeof parsedPayload !== 'object') return empty;
    const reported = parsedPayload?.state?.reported;
    if (!reported || typeof reported !== 'object') return empty;

    const gen = (reported.gen && typeof reported.gen === 'object') ? reported.gen : {};
    const regs = (reported.regs && typeof reported.regs === 'object') ? reported.regs : {};

    const gateway_id = (typeof gen.id === 'string') ? gen.id : null;
    const gateway_time_raw = (typeof gen.time === 'string') ? gen.time : null;
    let gateway_time_display = null;
    if (gateway_time_raw && /^\d{14}$/.test(gateway_time_raw)) {
      const t = gateway_time_raw;
      gateway_time_display =
        `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ` +
        `${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`;
    }

    const rawNum = (key) => {
      const v = regs[key];
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    };
    const scale = (v, divisor, decimals) =>
      v !== null ? +(v / divisor).toFixed(decimals) : null;

    const temp_f_raw   = rawNum('QM30 Temp F Raw');
    const temp_c_raw   = rawNum('QM30 Temp C Raw');
    const hfe_accel_raw = rawNum('QM30 HFE Accel Raw');
    const x_vel_raw    = rawNum('QM30 X Vel mm/s Raw');
    const y_vel_raw    = rawNum('QM30 Y Vel mm/s Raw');
    const z_vel_raw    = rawNum('QM30 Z Vel mm/s Raw');

    return {
      gateway_id, gateway_time_raw, gateway_time_display,
      temp_f_raw, temp_f:   scale(temp_f_raw, 100, 2),
      temp_c_raw, temp_c:   scale(temp_c_raw, 100, 2),
      hfe_accel_raw, hfe_accel: scale(hfe_accel_raw, 1000, 4),
      x_vel_raw, x_vel_mm_s: scale(x_vel_raw, 1000, 4),
      y_vel_raw, y_vel_mm_s: scale(y_vel_raw, 1000, 4),
      z_vel_raw, z_vel_mm_s: scale(z_vel_raw, 1000, 4),
    };
  } catch {
    return empty;
  }
}

module.exports = { parseSensorReading, TEMP_WARN_F, VEL_WARN_MM_S };
