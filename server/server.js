const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const axios = require("axios");
const PORT = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(
  "sk_test_51P1B7LCXIhVW50LeLXacm9VK72GEVjz5HQ7n10tCy9aHRI69LMXXgp4m2mPsQgOTQRcP1HQwTNCVBSyeDHMBOz9p00Rgu6NaPe"
);

app.use(
  cors({
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(express.static("uploads"));

let db;
(async () => {
  try {
    db = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("Connected to MySQL");
  } catch (error) {
    console.error("Error connecting to MySQL:", error);
  }
})();

// Configure Multer storage
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
// Initialize Multer
const upload = multer({ storage });

app.post("/api/bookings", upload.single("style_image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "Image upload failed. Please select a file." });
  }

  const {
    service_id,
    service_name,
    price,
    date,
    duration,
    time,
    phone,
    mpesa_transaction_id,
    payment_method,
  } = req.body;

  // Get the filename of the uploaded image
  const style_image = req.file ? `/uploads/${req.file.filename}` : null;
  if (
    !service_id ||
    !service_name ||
    !price ||
    !date ||
    !time ||
    !payment_method
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const sql = `
    INSERT INTO bookings 
    (service_id, service_name, price, date, duration, time, phone, mpesa_transaction_id, style_image, payment_method) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

  const values = [
    service_id,
    service_name,
    price,
    date,
    duration,
    time,
    phone,
    mpesa_transaction_id,
    style_image,
    payment_method,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Booking Successful!", bookingId: result.insertId });
  });
});

app.get("/api/bookings", (req, res) => {
  db.query(
    "SELECT * FROM bookings ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// M-Pesa STK Push Payment API
app.post("/api/mpesa/pay", async (req, res) => {
  let { phone, amount } = req.body;

  // Load credentials from .env
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackURL = process.env.MPESA_CALLBACK_URL;

  if (
    !consumerKey ||
    !consumerSecret ||
    !shortCode ||
    !passkey ||
    !callbackURL
  ) {
    return res
      .status(500)
      .json({
        error: "Missing M-Pesa credentials. Check environment variables.",
      });
  }

  // Convert phone number to international format
  // Convert phone number to proper format
  phone = phone.replace(/\D/g, ""); // Remove non-numeric characters

  if (phone.startsWith("07")) {
    phone = "254" + phone.substring(1);
  } else if (phone.startsWith("254")) {
    // Already in international format, no need to change
  } else {
    return res
      .status(400)
      .json({
        error: "Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX.",
      });
  }

  // Generate timestamp
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  // Encode password
  const password = Buffer.from(shortCode + passkey + timestamp).toString(
    "base64"
  );

  try {
    // Step 1: Get M-Pesa Access Token
    const tokenResponse = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        auth: {
          username: consumerKey,
          password: consumerSecret,
        },
      }
    );
    const accessToken = tokenResponse.data.access_token;

    // Step 2: Initiate STK Push
    const paymentResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackURL,
        AccountReference: "ServiceBooking",
        TransactionDesc: "Payment for booked service",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(paymentResponse.data);
  } catch (error) {
    console.error(
      "Error processing Mpesa payment:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to process M-Pesa payment" });
  }
});

// In-memory store for transactions (replace with a database in production)
const transactions = {};

// Callback URL to receive payment status from M-Pesa
app.post("/api/mpesa/callback", async (req, res) => {
  try {
    const { Body } = req.body;

    console.log("M-Pesa Callback Received:", Body); // Log the callback data

    // Check if the transaction was successful
    if (Body.stkCallback.ResultCode === 0) {
      // Extract transaction details
      const transactionId = Body.stkCallback.CheckoutRequestID; // Use CheckoutRequestID as transactionId
      const amount = Body.stkCallback.CallbackMetadata.Item.find(
        (item) => item.Name === "Amount"
      ).Value;
      const phone = Body.stkCallback.CallbackMetadata.Item.find(
        (item) => item.Name === "PhoneNumber"
      ).Value;

      // Store the transaction details
      transactions[transactionId] = {
        status: "Success",
        amount,
        phone,
        timestamp: new Date().toISOString(),
      };

      console.log("Transaction Successful. Transaction ID:", transactionId);
      console.log("Transactions Object:", transactions); // Log the transactions object
      return res.status(200).json({ success: true, transactionId });
    } else {
      // Transaction failed
      const transactionId = Body.stkCallback.CheckoutRequestID;
      transactions[transactionId] = {
        status: "Failed",
        error: Body.stkCallback.ResultDesc,
        timestamp: new Date().toISOString(),
      };

      console.error(
        "Transaction Failed. Transaction ID:",
        transactionId,
        "Reason:",
        Body.stkCallback.ResultDesc
      );
      return res
        .status(400)
        .json({
          error: "M-Pesa payment failed",
          details: Body.stkCallback.ResultDesc,
        });
    }
  } catch (error) {
    console.error("Error in M-Pesa callback:", error.message);
    return res.status(500).json({ error: "Error processing callback" });
  }
});

app.get("/api/mpesa/transaction/:transactionId", (req, res) => {
  const { transactionId } = req.params;

  console.log("Fetching transaction status for ID:", transactionId); // Log the transaction ID
  console.log("Transactions Object:", transactions); // Log the transactions object

  if (!transactions[transactionId]) {
    console.error("Transaction not found for ID:", transactionId); // Log if transaction is not found
    return res.status(404).json({ error: "Transaction not found" });
  }

  console.log("Transaction found:", transactions[transactionId]); // Log the transaction details
  return res.status(200).json(transactions[transactionId]);
});

app.post("/api/stripe", async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;

    const payment = await stripe.paymentIntents.create({
      amount,
      currency: "kes",
      payment_method: paymentMethodId,
      confirm: true,
      return_url: "http://127.0.0.1:5500/confirmation",
    });

    res.json({
      success: true,
      id: payment.id,
      amount: payment.amount / 100,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API to fetch booked times for a specific date
app.get("/api/bookings/:date", (req, res) => {
  const { date } = req.params;

  // Validate the date format (optional)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }

  // Query the database for bookings on the specified date
  const sql = `
      SELECT time 
      FROM bookings 
      WHERE date = ?
      ORDER BY time ASC
  `;

  db.query(sql, [date], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: err.message });
    }

    // Extract the booked times from the results
    const bookedTimes = results.map((booking) => booking.time);
    res.json({ bookedTimes });
  });
});

// API to validate time selection
app.post("/api/bookings/validate-time", (req, res) => {
  const { date, time } = req.body;

  // Validate the date and time
  if (!date || !time) {
    return res.status(400).json({ error: "Date and time are required." });
  }

  // Check if the selected time is in the past
  const selectedDateTime = new Date(`${date}T${time}`);
  const currentDateTime = new Date();

  if (selectedDateTime < currentDateTime) {
    return res
      .status(400)
      .json({ error: "You cannot select a time in the past." });
  }

  // Check if the time is already booked
  const sql = `
      SELECT COUNT(*) AS count 
      FROM bookings 
      WHERE date = ? AND time = ?
  `;

  db.query(sql, [date, time], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: err.message });
    }

    const isBooked = results[0].count > 0;

    if (isBooked) {
      return res
        .status(400)
        .json({ error: "This time slot is already booked." });
    }

    res.json({ valid: true });
  });
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
