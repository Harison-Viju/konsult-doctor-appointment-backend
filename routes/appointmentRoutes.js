
const express = require("express");
const router = express.Router();
const pool = require("../db/db.js");

// Middleware to parse JSON
router.use(express.json());

// Endpoint to book an appointment
router.post("/book", async (req, res) => {
  const { doctorId, patientId, appointmentDate, appointmentTime } = req.body;

  try {
    // Transaction begins
    const client = await pool.connect();
    await client.query("BEGIN");

    // Check if the slot is already booked
    const checkSlotQuery = `
      SELECT * FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3
    `;
    const slotResult = await client.query(checkSlotQuery, [
      doctorId,
      appointmentDate,
      appointmentTime,
    ]);

    if (slotResult.rows.length > 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(409).json({ message: "Slot already booked" });
    }

    // Book the slot
    const bookSlotQuery = `
      INSERT INTO appointments (doctor_id, patient_id, appointment_date, appointment_time, status)
      VALUES ($1, $2, $3, $4, 'booked')
      RETURNING *
    `;
    const bookingResult = await client.query(bookSlotQuery, [
      doctorId,
      patientId,
      appointmentDate,
      appointmentTime,
    ]);

    // Commit transaction
    await client.query("COMMIT");
    client.release();

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment: bookingResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error booking the appointment" });
  }
});

// Endpoint to view booked appointments for a doctor
router.get("/doctor/:doctorId", async (req, res) => {
  const { doctorId } = req.params;

  try {
    const query = `
      SELECT * FROM appointments
      WHERE doctor_id = $1
      ORDER BY appointment_date, appointment_time
    `;
    const result = await pool.query(query, [doctorId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving appointments" });
  }
});

module.exports = router;
