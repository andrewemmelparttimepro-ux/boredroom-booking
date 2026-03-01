/**
 * BoredRoom Booking — Slot Generation Engine
 * 
 * Core algorithm for finding available appointment slots.
 * 
 * getAvailableSlots(businessId, serviceId, staffId, date)
 *   → [{ time: '09:00', staffId, staffName }]
 * 
 * Algorithm:
 * 1. Load service duration + buffer from DB
 * 2. Load staff working hours for that day
 * 3. Generate all possible start times (15-min increments)
 * 4. Load existing appointments, build blocked windows
 * 5. Remove overlapping slots
 * 6. Return remaining available slots
 */

const pool = require('../db/pool');

/**
 * Get available slots for a given business, service, staff, and date.
 * 
 * @param {string} businessId - UUID of the business
 * @param {string} serviceId - UUID of the service
 * @param {string|null} staffId - UUID of specific staff, or 'any' for all qualified staff
 * @param {string} dateStr - Date string in YYYY-MM-DD format (in business timezone)
 * @returns {Array<{time: string, staffId: string, staffName: string}>}
 */
async function getAvailableSlots(businessId, serviceId, staffId, dateStr) {
  // 1. Load service details
  const svcResult = await pool.query(
    'SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1 AND business_id = $2 AND is_active = true',
    [serviceId, businessId]
  );
  if (svcResult.rows.length === 0) {
    throw new Error('Service not found or inactive');
  }
  const { duration_minutes, buffer_minutes } = svcResult.rows[0];
  const totalMinutes = duration_minutes + (buffer_minutes || 0);

  // Load business timezone
  const bizResult = await pool.query('SELECT timezone FROM businesses WHERE id = $1', [businessId]);
  const timezone = bizResult.rows.length > 0 ? bizResult.rows[0].timezone : 'America/Chicago';

  // 2. Determine which staff members to check
  let staffMembers = [];
  if (staffId && staffId !== 'any') {
    // Specific staff member
    const staffResult = await pool.query(
      'SELECT id, name FROM staff WHERE id = $1 AND business_id = $2 AND is_active = true',
      [staffId, businessId]
    );
    if (staffResult.rows.length === 0) {
      throw new Error('Staff member not found or inactive');
    }
    staffMembers = staffResult.rows;
  } else {
    // All staff who perform this service
    const staffResult = await pool.query(
      `SELECT s.id, s.name FROM staff s
       JOIN staff_services ss ON s.id = ss.staff_id
       WHERE ss.service_id = $1 AND s.business_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [serviceId, businessId]
    );
    staffMembers = staffResult.rows;

    // If no staff assigned to this service, try all active staff
    if (staffMembers.length === 0) {
      const allStaff = await pool.query(
        'SELECT id, name FROM staff WHERE business_id = $1 AND is_active = true ORDER BY name',
        [businessId]
      );
      staffMembers = allStaff.rows;
    }
  }

  if (staffMembers.length === 0) {
    return []; // No staff available
  }

  // Parse the date
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sunday

  const allSlots = [];

  for (const staff of staffMembers) {
    // 3. Get working hours for this staff on this day
    const availResult = await pool.query(
      `SELECT is_working, start_time, end_time FROM staff_availability
       WHERE staff_id = $1 AND day_of_week = $2`,
      [staff.id, dayOfWeek]
    );

    let isWorking, startTime, endTime;

    if (availResult.rows.length > 0) {
      // Use staff-specific availability
      const avail = availResult.rows[0];
      isWorking = avail.is_working;
      startTime = avail.start_time;
      endTime = avail.end_time;
    } else {
      // Fall back to business hours
      const bizHoursResult = await pool.query(
        `SELECT is_open, open_time, close_time FROM business_hours
         WHERE business_id = $1 AND day_of_week = $2`,
        [businessId, dayOfWeek]
      );
      if (bizHoursResult.rows.length > 0) {
        const bh = bizHoursResult.rows[0];
        isWorking = bh.is_open;
        startTime = bh.open_time;
        endTime = bh.close_time;
      } else {
        isWorking = false;
      }
    }

    // Skip if staff not working this day
    if (!isWorking || !startTime || !endTime) continue;

    // Parse time strings to minutes since midnight
    const workStart = parseTimeToMinutes(startTime);
    const workEnd = parseTimeToMinutes(endTime);

    // 4. Load existing appointments for this staff on this date
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;
    
    const apptResult = await pool.query(
      `SELECT start_time, end_time FROM appointments
       WHERE staff_id = $1 AND status NOT IN ('cancelled')
       AND start_time >= $2::timestamptz AND start_time <= $3::timestamptz`,
      [staff.id, dayStart, dayEnd]
    );

    // Build blocked windows as arrays of [startMin, endMin]
    const blocked = apptResult.rows.map(a => {
      const s = new Date(a.start_time);
      const e = new Date(a.end_time);
      return [
        s.getUTCHours() * 60 + s.getUTCMinutes(),
        e.getUTCHours() * 60 + e.getUTCMinutes()
      ];
    });

    // 5. Generate slots in 15-minute increments
    for (let min = workStart; min + totalMinutes <= workEnd; min += 15) {
      const slotEnd = min + totalMinutes;

      // Check if this slot overlaps any blocked window
      const hasConflict = blocked.some(([bStart, bEnd]) => {
        return min < bEnd && slotEnd > bStart;
      });

      if (!hasConflict) {
        allSlots.push({
          time: minutesToTimeString(min),
          staffId: staff.id,
          staffName: staff.name,
        });
      }
    }
  }

  // 6. Sort by time, then by staff name
  allSlots.sort((a, b) => a.time.localeCompare(b.time) || a.staffName.localeCompare(b.staffName));

  return allSlots;
}

/**
 * Parse a TIME string like "09:00:00" or "09:00" to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}

/**
 * Convert minutes since midnight to "HH:MM" string
 */
function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

module.exports = { getAvailableSlots, parseTimeToMinutes, minutesToTimeString };
