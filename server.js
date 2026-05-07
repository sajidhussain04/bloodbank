
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

dotenv.config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

const helmet = require("helmet");

const app = express();
app.use(express.json());

// UPDATED CSP CONFIGURATION - FIXES INLINE EVENT HANDLERS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-hashes'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://kit.fontawesome.com"
        ],
        scriptSrcAttr: [
          "'unsafe-inline'",
          "'unsafe-hashes'"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://ka-f.fontawesome.com"
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: [
          "'self'",
          "https://www.google.com",
          "https://maps.google.com",
        ],
      },
    },
  })
);

app.use(
  cors({
origin: [
  "https://yourproject.pages.dev",
],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.static(__dirname));
// 🔥 Fix favicon 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

/* -------------------- EMAIL CONFIGURATION -------------------- */

const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.log("❌ Email config error:", error.message);
    } else {
      console.log("✅ Email server ready");
    }
  });
} else {
  console.log(
    "⚠️ Email notifications disabled (missing EMAIL_USER or EMAIL_PASS)"
  );
}

/* -------------------- DATABASE CONNECTION -------------------- */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

/* -------------------- SCHEMAS -------------------- */

const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 18, max: 65 },
  bloodGroup: {
    type: String,
    required: true,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true, match: /.+\@.+\..+/ },
  location: { type: String, required: true, trim: true },
  lastDonationDate: { type: Date },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const requestSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true },
  bloodGroup: {
    type: String,
    required: true,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  unitsRequired: { type: Number, required: true, min: 1, max: 10 },
  hospitalName: { type: String, required: true, trim: true },
  hospitalAddress: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  requiredDate: { type: Date, required: true },
  requesterName: { type: String, required: true, trim: true },
  requesterPhone: { type: String, required: true, trim: true },
  requesterEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: /.+\@.+\..+/,
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Completed", "Rejected"],
    default: "Pending",
  },
  priority: {
    type: String,
    enum: ["Normal", "Urgent"],
    default: "Normal",
  },
  notes: { type: String },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: "Administrator" },
  phone: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const Donor = mongoose.model("Donor", donorSchema);
const BloodRequest = mongoose.model("BloodRequest", requestSchema);
const Admin = mongoose.model("Admin", adminSchema);

/* -------------------- INITIALIZE ADMIN -------------------- */

async function initAdmin() {
  try {
    const exists = await Admin.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
    });
    if (!exists) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await Admin.create({
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        password: hash,
        name: "Administrator",
        phone: process.env.ADMIN_PHONE || null,
      });
      console.log("✅ Admin user created successfully");
      console.log(`📧 Admin Email: ${process.env.ADMIN_EMAIL}`);
      if (process.env.ADMIN_PHONE) {
        console.log(`📱 Admin Phone: ${process.env.ADMIN_PHONE}`);
      }
    } else {
      console.log("✅ Admin user already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin:", error);
  }
}

// Initialize admin after database connection
mongoose.connection.once("open", () => {
  initAdmin();
});

/* -------------------- AUTHENTICATION MIDDLEWARE -------------------- */

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided or invalid format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/* -------------------- AUTHENTICATION ROUTES -------------------- */

// Admin login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        role: "admin",
        email: admin.email,
        id: admin._id,
        name: admin.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      admin: {
        email: admin.email,
        name: admin.name,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// Verify token
app.get("/api/admin/verify", verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");
    res.json({
      success: true,
      admin,
      message: "Token is valid",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying token",
    });
  }
});

// Forgot Password - Send reset link
app.post("/api/admin/forgot", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(200).json({
        success: true,
        message:
          "If your email is registered, you will receive a password reset link",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = resetTokenExpiry;
    await admin.save();

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password.html?token=${resetToken}`;

    // Send email with reset link
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: "Password Reset Request - JharJeevan Admin Panel",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">Password Reset Request</h2>
            <p>Hello ${admin.name || "Administrator"},</p>
            <p>You requested to reset your password for the JharJeevan Admin Panel.</p>
            <p>Click the link below to reset your password (valid for 1 hour):</p>
            <p><a href="${resetUrl}" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">JharJeevan Blood Bank System</p>
          </div>
        `,
      });
      console.log(`✅ Reset email sent to ${admin.email}`);
    } else {
      console.log(
        `⚠️ Email not configured. Reset token for ${admin.email}: ${resetToken}`
      );
      return res.json({
        success: true,
        message: `Reset token (email not configured): ${resetToken}`,
      });
    }

    res.json({
      success: true,
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reset link. Please try again.",
    });
  }
});

// Reset Password - Set new password
app.post("/api/admin/reset/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const admin = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password. Please try again.",
    });
  }
});

/* -------------------- INVENTORY ROUTE -------------------- */

// GET inventory (blood stock summary)
app.get("/api/inventory", async (req, res) => {
  try {
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const inventory = {};

    for (const bg of bloodGroups) {
      // Count donors
      const donorCount = await Donor.countDocuments({ bloodGroup: bg });

      // Count approved requests (units used)
      const usedUnitsAgg = await BloodRequest.aggregate([
        {
          $match: {
            bloodGroup: bg,
            status: "Approved",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$unitsRequired" },
          },
        },
      ]);

      const usedUnits = usedUnitsAgg[0]?.total || 0;

      // Final inventory
      inventory[bg] = Math.max(donorCount - usedUnits, 0);
    }

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory",
    });
  }
});

/* -------------------- DONOR ROUTES -------------------- */

// GET all donors (protected)
app.get("/api/donors", verifyAdmin, async (req, res) => {
  try {
    const { bloodGroup, isAvailable, search } = req.query;
    let query = {};

    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === "true";
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const donors = await Donor.find(query).sort({ createdAt: -1 });
    res.json({ success: true, donors });
  } catch (err) {
    console.error("Error fetching donors:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching donors",
    });
  }
});

// POST new donor (public)
app.post("/api/donors", async (req, res) => {
  try {
    const { name, age, bloodGroup, phone, email, location, lastDonationDate } =
      req.body;

    if (!name || !age || !bloodGroup || !phone || !location) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, age, bloodGroup, phone, location",
      });
    }

    if (age < 18 || age > 65) {
      return res.status(400).json({
        success: false,
        message: "Age must be between 18 and 65 years",
      });
    }

    const existingDonor = await Donor.findOne({ phone });
    if (existingDonor) {
      return res.status(400).json({
        success: false,
        message: "A donor with this phone number already exists",
      });
    }

    if (lastDonationDate) {
      const lastDonation = new Date(lastDonationDate);
      const daysSinceDonation = Math.floor(
        (Date.now() - lastDonation) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceDonation < 90) {
        return res.status(400).json({
          success: false,
          message: `Donors can only donate every 90 days. Last donation was ${daysSinceDonation} days ago.`,
        });
      }
    }

    const donor = await Donor.create({
      name,
      age,
      bloodGroup,
      phone,
      email,
      location,
      lastDonationDate,
    });

    if (transporter && donor.email) {
      transporter
        .sendMail({
          from: process.env.EMAIL_USER,
          to: donor.email,
          subject: "Thank You for Registering as a Blood Donor",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #c0392b;">Dear ${donor.name},</h2>
            <p>Thank you for your generous decision to become a blood donor.</p>
            <p>Your registration has been successfully completed with the following details:</p>
            <ul>
              <li><strong>Blood Group:</strong> ${donor.bloodGroup}</li>
              <li><strong>Location:</strong> ${donor.location}</li>
              <li><strong>Phone:</strong> ${donor.phone}</li>
            </ul>
            <p>You can save up to 3 lives with each donation!</p>
            <p>Best regards,<br/><strong>Jhar Jeevan Blood Bank Team</strong></p>
          </div>
        `,
        })
        .catch((err) => console.error("Email sending failed:", err.message));
    }

    res.status(201).json({
      success: true,
      message: "Donor registered successfully",
      donor: {
        id: donor._id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        phone: donor.phone,
        location: donor.location,
      },
    });
  } catch (err) {
    console.error("Error creating donor:", err);
    res.status(500).json({
      success: false,
      message: "Server error while registering donor",
    });
  }
});

// UPDATE donor (protected)
app.put("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const donor = await Donor.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.json({
      success: true,
      message: "Donor updated successfully",
      donor,
    });
  } catch (err) {
    console.error("Error updating donor:", err);
    res.status(500).json({
      success: false,
      message: "Error updating donor",
    });
  }
});

// DELETE donor (protected)
app.delete("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const donor = await Donor.findByIdAndDelete(req.params.id);

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.json({
      success: true,
      message: "Donor deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting donor:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting donor",
    });
  }
});

// GET single donor
app.get("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }
    res.json({ success: true, donor });
  } catch (err) {
    console.error("Error fetching donor:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching donor",
    });
  }
});

/* -------------------- BLOOD REQUEST ROUTES -------------------- */

// GET all requests (protected)
app.get("/api/requests", verifyAdmin, async (req, res) => {
  try {
    const { status, bloodGroup, priority } = req.query;
    let query = {};

    if (status) query.status = status;
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (priority) query.priority = priority;

    const requests = await BloodRequest.find(query).sort({
      priority: -1,
      createdAt: -1,
    });

    res.json({ success: true, requests });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching requests",
    });
  }
});

// PATCH - Approve request (for compatibility with admin.js)
app.patch("/api/requests/:id/approve", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await BloodRequest.findByIdAndUpdate(
      id,
      {
        status: "Approved",
        approvedBy: req.admin.email,
        approvedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found",
      });
    }

    res.json({
      success: true,
      message: "Request approved successfully",
      request,
    });
  } catch (err) {
    console.error("Error approving request:", err);
    res.status(500).json({
      success: false,
      message: "Error approving request",
    });
  }
});

// POST new blood request (public)
app.post("/api/requests", async (req, res) => {
  try {
    const data = req.body;

    if (!data.requesterName && data.name) {
      data.requesterName = data.name;
    }

    const requiredFields = [
      "patientName",
      "bloodGroup",
      "unitsRequired",
      "hospitalName",
      "hospitalAddress",
      "city",
      "requiredDate",
      "requesterPhone",
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
        });
      }
    }

    if (!data.requesterName) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: requesterName or name",
      });
    }

    if (!data.requesterPhone || data.requesterPhone.toString().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Valid phone number is required (minimum 10 digits)",
      });
    }

    const requiredDate = new Date(data.requiredDate);
    if (isNaN(requiredDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid required date format",
      });
    }

    const now = new Date();
    const daysUntilRequired = Math.ceil(
      (requiredDate - now) / (1000 * 60 * 60 * 24)
    );
    const priority = daysUntilRequired <= 1 ? "Urgent" : "Normal";

    const request = await BloodRequest.create({
      patientName: data.patientName,
      bloodGroup: data.bloodGroup,
      unitsRequired: data.unitsRequired,
      hospitalName: data.hospitalName,
      hospitalAddress: data.hospitalAddress,
      city: data.city,
      requiredDate: data.requiredDate,
      requesterName: data.requesterName,
      requesterPhone: data.requesterPhone,
      requesterEmail: data.requesterEmail || "",
      priority: priority,
    });

    if (priority === "Urgent") {
      const matchingDonors = await Donor.find({
        bloodGroup: data.bloodGroup,
        isAvailable: true,
      }).limit(50);

      if (transporter && matchingDonors.length > 0) {
        matchingDonors.slice(0, 10).forEach((donor) => {
          if (donor.email) {
            transporter
              .sendMail({
                from: process.env.EMAIL_USER,
                to: donor.email,
                subject:
                  "⚠️ URGENT: Blood Donation Needed Immediately - Jhar Jeevan",
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #ff4444; color: white; padding: 10px; text-align: center; border-radius: 5px;">
                    <h2>⚠️ URGENT Blood Donation Request</h2>
                  </div>
                  <div style="padding: 20px;">
                    <p>Dear <strong>${donor.name}</strong>,</p>
                    <p>An urgent request for <strong style="color: #ff4444;">${data.bloodGroup} blood</strong> has been raised.</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                      <h3 style="margin-top: 0;">Request Details:</h3>
                      <ul>
                        <li>👤 <strong>Patient:</strong> ${data.patientName}</li>
                        <li>🏥 <strong>Hospital:</strong> ${data.hospitalName}</li>
                        <li>📍 <strong>Location:</strong> ${data.city}</li>
                        <li>📅 <strong>Required by:</strong> ${requiredDate.toLocaleDateString()}</li>
                        <li>🩸 <strong>Units needed:</strong> ${data.unitsRequired}</li>
                      </ul>
                    </div>
                    <p><strong>Contact Number:</strong> ${data.requesterPhone}</p>
                    <p>Your donation can save a life! 🩸</p>
                    <p>Thank you,<br/><strong>Jhar Jeevan Blood Bank</strong></p>
                  </div>
                </div>
              `,
              })
              .catch((err) => console.error("Email failed:", err.message));
          }
        });
        console.log(
          `📧 Queued urgent emails to ${Math.min(matchingDonors.length, 10)} donors`
        );
      }
    }

    if (transporter && data.requesterEmail) {
      transporter
        .sendMail({
          from: process.env.EMAIL_USER,
          to: data.requesterEmail,
          subject: "Blood Request Received - Jhar Jeevan",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4CAF50;">Blood Request Confirmation</h2>
            <p>Dear <strong>${data.requesterName}</strong>,</p>
            <p>Your blood request has been successfully submitted to Jhar Jeevan Blood Bank.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>📋 Request ID:</strong> ${request._id.toString().slice(-6)}</p>
              <p><strong>📊 Status:</strong> ${request.status}</p>
              <p><strong>⚡ Priority:</strong> ${request.priority}</p>
              <p><strong>🩸 Blood Group:</strong> ${request.bloodGroup}</p>
            </div>
            <p>We will notify you once a donor is available.</p>
            <p>Thank you for using Jhar Jeevan services.</p>
          </div>
        `,
        })
        .catch((err) => console.error("Email failed:", err.message));
    }

    res.status(201).json({
      success: true,
      message: "Blood request submitted successfully",
      request: {
        id: request._id,
        patientName: request.patientName,
        bloodGroup: request.bloodGroup,
        status: request.status,
        priority: request.priority,
      },
    });
  } catch (err) {
    console.error("Error creating request:", err);
    res.status(500).json({
      success: false,
      message: "Error submitting request: " + err.message,
    });
  }
});

// UPDATE request status (Approve/Reject/Complete)
app.put("/api/requests/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (
      !status ||
      !["Pending", "Approved", "Completed", "Rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Must be Pending, Approved, Completed, or Rejected",
      });
    }

    const updateData = { status };

    if (status === "Approved") {
      updateData.approvedBy = req.admin.email;
      updateData.approvedAt = new Date();
    }

    if (notes) {
      updateData.notes = notes;
    }

    const request = await BloodRequest.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found",
      });
    }

    if (transporter && request.requesterEmail) {
      let emailSubject = "";
      let emailMessage = "";

      if (status === "Approved") {
        emailSubject = "✅ Blood Request Approved - Jhar Jeevan";
        emailMessage = `<h2>Great News! Your blood request has been approved.</h2><p>Dear ${request.requesterName},</p><p>We're pleased to inform you that your blood request has been approved. A donor will contact you shortly.</p><p>Thank you for choosing Jhar Jeevan Blood Bank.</p>`;
      } else if (status === "Rejected") {
        emailSubject = "❌ Blood Request Update - Jhar Jeevan";
        emailMessage = `<h2>Blood Request Status Update</h2><p>Dear ${request.requesterName},</p><p>We regret to inform you that your blood request could not be approved at this time. Please contact us directly for assistance.</p>`;
      } else if (status === "Completed") {
        emailSubject = "🎉 Blood Request Completed - Jhar Jeevan";
        emailMessage = `<h2>Blood Request Completed Successfully</h2><p>Dear ${request.requesterName},</p><p>Your blood request has been marked as completed. Thank you for using Jhar Jeevan services.</p>`;
      }

      if (emailMessage) {
        transporter
          .sendMail({
            from: process.env.EMAIL_USER,
            to: request.requesterEmail,
            subject: emailSubject,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">${emailMessage}</div>`,
          })
          .catch((err) => console.error("Email failed:", err.message));
      }
    }

    res.json({
      success: true,
      message: `Request ${status.toLowerCase()} successfully`,
      request,
    });
  } catch (err) {
    console.error("Error updating request:", err);
    res.status(500).json({
      success: false,
      message: "Error updating request status",
    });
  }
});

// DELETE request (protected)
app.delete("/api/requests/:id", verifyAdmin, async (req, res) => {
  try {
    const request = await BloodRequest.findByIdAndDelete(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    res.json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting request:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting request",
    });
  }
});

// GET requests by blood group (public)
app.get("/api/requests/blood/:bloodGroup", async (req, res) => {
  try {
    const requests = await BloodRequest.find({
      bloodGroup: req.params.bloodGroup,
      status: "Pending",
    })
      .sort({ priority: -1, createdAt: 1 })
      .limit(20);

    res.json({ success: true, requests });
  } catch (err) {
    console.error("Error fetching requests by blood group:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching requests",
    });
  }
});

/* -------------------- STATISTICS ROUTES -------------------- */

app.get("/api/stats", verifyAdmin, async (req, res) => {
  try {
    const [
      totalDonors,
      activeDonors,
      totalRequests,
      pendingRequests,
      urgentRequests,
      approvedRequests,
      completedRequests,
    ] = await Promise.all([
      Donor.countDocuments(),
      Donor.countDocuments({ isAvailable: true }),
      BloodRequest.countDocuments(),
      BloodRequest.countDocuments({ status: "Pending" }),
      BloodRequest.countDocuments({ priority: "Urgent", status: "Pending" }),
      BloodRequest.countDocuments({ status: "Approved" }),
      BloodRequest.countDocuments({ status: "Completed" }),
    ]);

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const [donorsByBloodGroup, requestsByBloodGroup] = await Promise.all([
      Promise.all(
        bloodGroups.map((bg) => Donor.countDocuments({ bloodGroup: bg }))
      ),
      Promise.all(
        bloodGroups.map((bg) =>
          BloodRequest.countDocuments({ bloodGroup: bg, status: "Pending" })
        )
      ),
    ]);

    const donorsByBloodGroupObj = {};
    const requestsByBloodGroupObj = {};
    bloodGroups.forEach((bg, index) => {
      donorsByBloodGroupObj[bg] = donorsByBloodGroup[index];
      requestsByBloodGroupObj[bg] = requestsByBloodGroup[index];
    });

    const [recentDonors, recentRequests] = await Promise.all([
      Donor.find().sort({ createdAt: -1 }).limit(5),
      BloodRequest.find().sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      stats: {
        totalDonors,
        activeDonors,
        totalRequests,
        pendingRequests,
        urgentRequests,
        approvedRequests,
        completedRequests,
        donorsByBloodGroup: donorsByBloodGroupObj,
        requestsByBloodGroup: requestsByBloodGroupObj,
        recentDonors,
        recentRequests,
      },
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
    });
  }
});

/* -------------------- SEARCH ROUTES -------------------- */

app.get("/api/search/donors", verifyAdmin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const donors = await Donor.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { bloodGroup: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
      ],
    }).limit(20);

    res.json({ success: true, donors });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({
      success: false,
      message: "Error searching donors",
    });
  }
});

/* -------------------- HEALTH CHECK -------------------- */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    mongodb:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    email: transporter ? "Configured" : "Not configured",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});





// ============ AI ROUTES (NEW FEATURE) ============
/* -------------------- AI ROUTES -------------------- */

// Import AI routes
const { initAIRoutes } = require("./server/routes/aiRoutes");

// Initialize AI routes with models
const aiRoutes = initAIRoutes(Donor, BloodRequest);
app.use("/api/ai", aiRoutes);

console.log("🤖 AI Routes Initialized: Donor Recommender, Chatbot, Demand Predictor");
/* -------------------- ERROR HANDLING MIDDLEWARE -------------------- */

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong on the server",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/* -------------------- SERVER INITIALIZATION -------------------- */

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log(`🚀 Jhar Jeevan Blood Bank Server`);
  console.log("=".repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔒 Admin login: POST http://localhost:${PORT}/api/admin/login`);
  console.log("-".repeat(50));
  console.log(
    `📧 Email: ${transporter ? "✅ Configured" : "❌ Not configured"}`
  );
  console.log(`🔐 Admin Email: ${process.env.ADMIN_EMAIL}`);
  if (process.env.ADMIN_PHONE)
    console.log(`📱 Admin Phone: ${process.env.ADMIN_PHONE}`);
  console.log("=".repeat(50));
  console.log("✨ System Ready! ✨\n");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});


const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

dotenv.config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

const helmet = require("helmet");

const app = express();
app.use(express.json());

// UPDATED CSP CONFIGURATION - FIXES INLINE EVENT HANDLERS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-hashes'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://kit.fontawesome.com"
        ],
        scriptSrcAttr: [
          "'unsafe-inline'",
          "'unsafe-hashes'"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://ka-f.fontawesome.com"
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:5000"],
        frameSrc: [
          "'self'",
          "https://www.google.com",
          "https://maps.google.com",
        ],
      },
    },
  })
);

app.use(
  cors({
    origin: [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.static(__dirname));
// 🔥 Fix favicon 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

/* -------------------- EMAIL CONFIGURATION -------------------- */

const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.log("❌ Email config error:", error.message);
    } else {
      console.log("✅ Email server ready");
    }
  });
} else {
  console.log(
    "⚠️ Email notifications disabled (missing EMAIL_USER or EMAIL_PASS)"
  );
}

/* -------------------- DATABASE CONNECTION -------------------- */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

/* -------------------- SCHEMAS -------------------- */

const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 18, max: 65 },
  bloodGroup: {
    type: String,
    required: true,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true, match: /.+\@.+\..+/ },
  location: { type: String, required: true, trim: true },
  lastDonationDate: { type: Date },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const requestSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true },
  bloodGroup: {
    type: String,
    required: true,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  unitsRequired: { type: Number, required: true, min: 1, max: 10 },
  hospitalName: { type: String, required: true, trim: true },
  hospitalAddress: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  requiredDate: { type: Date, required: true },
  requesterName: { type: String, required: true, trim: true },
  requesterPhone: { type: String, required: true, trim: true },
  requesterEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: /.+\@.+\..+/,
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Completed", "Rejected"],
    default: "Pending",
  },
  priority: {
    type: String,
    enum: ["Normal", "Urgent"],
    default: "Normal",
  },
  notes: { type: String },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: "Administrator" },
  phone: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const Donor = mongoose.model("Donor", donorSchema);
const BloodRequest = mongoose.model("BloodRequest", requestSchema);
const Admin = mongoose.model("Admin", adminSchema);

/* -------------------- INITIALIZE ADMIN -------------------- */

async function initAdmin() {
  try {
    const exists = await Admin.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
    });
    if (!exists) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await Admin.create({
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        password: hash,
        name: "Administrator",
        phone: process.env.ADMIN_PHONE || null,
      });
      console.log("✅ Admin user created successfully");
      console.log(`📧 Admin Email: ${process.env.ADMIN_EMAIL}`);
      if (process.env.ADMIN_PHONE) {
        console.log(`📱 Admin Phone: ${process.env.ADMIN_PHONE}`);
      }
    } else {
      console.log("✅ Admin user already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin:", error);
  }
}

// Initialize admin after database connection
mongoose.connection.once("open", () => {
  initAdmin();
});

/* -------------------- AUTHENTICATION MIDDLEWARE -------------------- */

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided or invalid format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/* -------------------- AUTHENTICATION ROUTES -------------------- */

// Admin login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        role: "admin",
        email: admin.email,
        id: admin._id,
        name: admin.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      admin: {
        email: admin.email,
        name: admin.name,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// Verify token
app.get("/api/admin/verify", verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");
    res.json({
      success: true,
      admin,
      message: "Token is valid",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying token",
    });
  }
});

// Forgot Password - Send reset link
app.post("/api/admin/forgot", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(200).json({
        success: true,
        message:
          "If your email is registered, you will receive a password reset link",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = resetTokenExpiry;
    await admin.save();

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password.html?token=${resetToken}`;

    // Send email with reset link
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: "Password Reset Request - JharJeevan Admin Panel",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">Password Reset Request</h2>
            <p>Hello ${admin.name || "Administrator"},</p>
            <p>You requested to reset your password for the JharJeevan Admin Panel.</p>
            <p>Click the link below to reset your password (valid for 1 hour):</p>
            <p><a href="${resetUrl}" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">JharJeevan Blood Bank System</p>
          </div>
        `,
      });
      console.log(`✅ Reset email sent to ${admin.email}`);
    } else {
      console.log(
        `⚠️ Email not configured. Reset token for ${admin.email}: ${resetToken}`
      );
      return res.json({
        success: true,
        message: `Reset token (email not configured): ${resetToken}`,
      });
    }

    res.json({
      success: true,
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reset link. Please try again.",
    });
  }
});

// Reset Password - Set new password
app.post("/api/admin/reset/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const admin = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password. Please try again.",
    });
  }
});

/* -------------------- INVENTORY ROUTE -------------------- */

// GET inventory (blood stock summary)
app.get("/api/inventory", async (req, res) => {
  try {
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const inventory = {};

    for (const bg of bloodGroups) {
      // Count donors
      const donorCount = await Donor.countDocuments({ bloodGroup: bg });

      // Count approved requests (units used)
      const usedUnitsAgg = await BloodRequest.aggregate([
        {
          $match: {
            bloodGroup: bg,
            status: "Approved",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$unitsRequired" },
          },
        },
      ]);

      const usedUnits = usedUnitsAgg[0]?.total || 0;

      // Final inventory
      inventory[bg] = Math.max(donorCount - usedUnits, 0);
    }

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory",
    });
  }
});

/* -------------------- DONOR ROUTES -------------------- */

// GET all donors (protected)
app.get("/api/donors", verifyAdmin, async (req, res) => {
  try {
    const { bloodGroup, isAvailable, search } = req.query;
    let query = {};

    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === "true";
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const donors = await Donor.find(query).sort({ createdAt: -1 });
    res.json({ success: true, donors });
  } catch (err) {
    console.error("Error fetching donors:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching donors",
    });
  }
});

// POST new donor (public)
app.post("/api/donors", async (req, res) => {
  try {
    const { name, age, bloodGroup, phone, email, location, lastDonationDate } =
      req.body;

    if (!name || !age || !bloodGroup || !phone || !location) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, age, bloodGroup, phone, location",
      });
    }

    if (age < 18 || age > 65) {
      return res.status(400).json({
        success: false,
        message: "Age must be between 18 and 65 years",
      });
    }

    const existingDonor = await Donor.findOne({ phone });
    if (existingDonor) {
      return res.status(400).json({
        success: false,
        message: "A donor with this phone number already exists",
      });
    }

    if (lastDonationDate) {
      const lastDonation = new Date(lastDonationDate);
      const daysSinceDonation = Math.floor(
        (Date.now() - lastDonation) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceDonation < 90) {
        return res.status(400).json({
          success: false,
          message: `Donors can only donate every 90 days. Last donation was ${daysSinceDonation} days ago.`,
        });
      }
    }

    const donor = await Donor.create({
      name,
      age,
      bloodGroup,
      phone,
      email,
      location,
      lastDonationDate,
    });

    if (transporter && donor.email) {
      transporter
        .sendMail({
          from: process.env.EMAIL_USER,
          to: donor.email,
          subject: "Thank You for Registering as a Blood Donor",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #c0392b;">Dear ${donor.name},</h2>
            <p>Thank you for your generous decision to become a blood donor.</p>
            <p>Your registration has been successfully completed with the following details:</p>
            <ul>
              <li><strong>Blood Group:</strong> ${donor.bloodGroup}</li>
              <li><strong>Location:</strong> ${donor.location}</li>
              <li><strong>Phone:</strong> ${donor.phone}</li>
            </ul>
            <p>You can save up to 3 lives with each donation!</p>
            <p>Best regards,<br/><strong>Jhar Jeevan Blood Bank Team</strong></p>
          </div>
        `,
        })
        .catch((err) => console.error("Email sending failed:", err.message));
    }

    res.status(201).json({
      success: true,
      message: "Donor registered successfully",
      donor: {
        id: donor._id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        phone: donor.phone,
        location: donor.location,
      },
    });
  } catch (err) {
    console.error("Error creating donor:", err);
    res.status(500).json({
      success: false,
      message: "Server error while registering donor",
    });
  }
});

// UPDATE donor (protected)
app.put("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const donor = await Donor.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.json({
      success: true,
      message: "Donor updated successfully",
      donor,
    });
  } catch (err) {
    console.error("Error updating donor:", err);
    res.status(500).json({
      success: false,
      message: "Error updating donor",
    });
  }
});

// DELETE donor (protected)
app.delete("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const donor = await Donor.findByIdAndDelete(req.params.id);

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.json({
      success: true,
      message: "Donor deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting donor:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting donor",
    });
  }
});

// GET single donor
app.get("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }
    res.json({ success: true, donor });
  } catch (err) {
    console.error("Error fetching donor:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching donor",
    });
  }
});

/* -------------------- BLOOD REQUEST ROUTES -------------------- */

// GET all requests (protected)
app.get("/api/requests", verifyAdmin, async (req, res) => {
  try {
    const { status, bloodGroup, priority } = req.query;
    let query = {};

    if (status) query.status = status;
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (priority) query.priority = priority;

    const requests = await BloodRequest.find(query).sort({
      priority: -1,
      createdAt: -1,
    });

    res.json({ success: true, requests });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching requests",
    });
  }
});

// PATCH - Approve request (for compatibility with admin.js)
app.patch("/api/requests/:id/approve", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await BloodRequest.findByIdAndUpdate(
      id,
      {
        status: "Approved",
        approvedBy: req.admin.email,
        approvedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found",
      });
    }

    res.json({
      success: true,
      message: "Request approved successfully",
      request,
    });
  } catch (err) {
    console.error("Error approving request:", err);
    res.status(500).json({
      success: false,
      message: "Error approving request",
    });
  }
});

// POST new blood request (public)
app.post("/api/requests", async (req, res) => {
  try {
    const data = req.body;

    if (!data.requesterName && data.name) {
      data.requesterName = data.name;
    }

    const requiredFields = [
      "patientName",
      "bloodGroup",
      "unitsRequired",
      "hospitalName",
      "hospitalAddress",
      "city",
      "requiredDate",
      "requesterPhone",
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
        });
      }
    }

    if (!data.requesterName) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: requesterName or name",
      });
    }

    if (!data.requesterPhone || data.requesterPhone.toString().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Valid phone number is required (minimum 10 digits)",
      });
    }

    const requiredDate = new Date(data.requiredDate);
    if (isNaN(requiredDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid required date format",
      });
    }

    const now = new Date();
    const daysUntilRequired = Math.ceil(
      (requiredDate - now) / (1000 * 60 * 60 * 24)
    );
    const priority = daysUntilRequired <= 1 ? "Urgent" : "Normal";

    const request = await BloodRequest.create({
      patientName: data.patientName,
      bloodGroup: data.bloodGroup,
      unitsRequired: data.unitsRequired,
      hospitalName: data.hospitalName,
      hospitalAddress: data.hospitalAddress,
      city: data.city,
      requiredDate: data.requiredDate,
      requesterName: data.requesterName,
      requesterPhone: data.requesterPhone,
      requesterEmail: data.requesterEmail || "",
      priority: priority,
    });

    if (priority === "Urgent") {
      const matchingDonors = await Donor.find({
        bloodGroup: data.bloodGroup,
        isAvailable: true,
      }).limit(50);

      if (transporter && matchingDonors.length > 0) {
        matchingDonors.slice(0, 10).forEach((donor) => {
          if (donor.email) {
            transporter
              .sendMail({
                from: process.env.EMAIL_USER,
                to: donor.email,
                subject:
                  "⚠️ URGENT: Blood Donation Needed Immediately - Jhar Jeevan",
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #ff4444; color: white; padding: 10px; text-align: center; border-radius: 5px;">
                    <h2>⚠️ URGENT Blood Donation Request</h2>
                  </div>
                  <div style="padding: 20px;">
                    <p>Dear <strong>${donor.name}</strong>,</p>
                    <p>An urgent request for <strong style="color: #ff4444;">${data.bloodGroup} blood</strong> has been raised.</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                      <h3 style="margin-top: 0;">Request Details:</h3>
                      <ul>
                        <li>👤 <strong>Patient:</strong> ${data.patientName}</li>
                        <li>🏥 <strong>Hospital:</strong> ${data.hospitalName}</li>
                        <li>📍 <strong>Location:</strong> ${data.city}</li>
                        <li>📅 <strong>Required by:</strong> ${requiredDate.toLocaleDateString()}</li>
                        <li>🩸 <strong>Units needed:</strong> ${data.unitsRequired}</li>
                      </ul>
                    </div>
                    <p><strong>Contact Number:</strong> ${data.requesterPhone}</p>
                    <p>Your donation can save a life! 🩸</p>
                    <p>Thank you,<br/><strong>Jhar Jeevan Blood Bank</strong></p>
                  </div>
                </div>
              `,
              })
              .catch((err) => console.error("Email failed:", err.message));
          }
        });
        console.log(
          `📧 Queued urgent emails to ${Math.min(matchingDonors.length, 10)} donors`
        );
      }
    }

    if (transporter && data.requesterEmail) {
      transporter
        .sendMail({
          from: process.env.EMAIL_USER,
          to: data.requesterEmail,
          subject: "Blood Request Received - Jhar Jeevan",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4CAF50;">Blood Request Confirmation</h2>
            <p>Dear <strong>${data.requesterName}</strong>,</p>
            <p>Your blood request has been successfully submitted to Jhar Jeevan Blood Bank.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>📋 Request ID:</strong> ${request._id.toString().slice(-6)}</p>
              <p><strong>📊 Status:</strong> ${request.status}</p>
              <p><strong>⚡ Priority:</strong> ${request.priority}</p>
              <p><strong>🩸 Blood Group:</strong> ${request.bloodGroup}</p>
            </div>
            <p>We will notify you once a donor is available.</p>
            <p>Thank you for using Jhar Jeevan services.</p>
          </div>
        `,
        })
        .catch((err) => console.error("Email failed:", err.message));
    }

    res.status(201).json({
      success: true,
      message: "Blood request submitted successfully",
      request: {
        id: request._id,
        patientName: request.patientName,
        bloodGroup: request.bloodGroup,
        status: request.status,
        priority: request.priority,
      },
    });
  } catch (err) {
    console.error("Error creating request:", err);
    res.status(500).json({
      success: false,
      message: "Error submitting request: " + err.message,
    });
  }
});

// UPDATE request status (Approve/Reject/Complete)
app.put("/api/requests/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (
      !status ||
      !["Pending", "Approved", "Completed", "Rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Must be Pending, Approved, Completed, or Rejected",
      });
    }

    const updateData = { status };

    if (status === "Approved") {
      updateData.approvedBy = req.admin.email;
      updateData.approvedAt = new Date();
    }

    if (notes) {
      updateData.notes = notes;
    }

    const request = await BloodRequest.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found",
      });
    }

    if (transporter && request.requesterEmail) {
      let emailSubject = "";
      let emailMessage = "";

      if (status === "Approved") {
        emailSubject = "✅ Blood Request Approved - Jhar Jeevan";
        emailMessage = `<h2>Great News! Your blood request has been approved.</h2><p>Dear ${request.requesterName},</p><p>We're pleased to inform you that your blood request has been approved. A donor will contact you shortly.</p><p>Thank you for choosing Jhar Jeevan Blood Bank.</p>`;
      } else if (status === "Rejected") {
        emailSubject = "❌ Blood Request Update - Jhar Jeevan";
        emailMessage = `<h2>Blood Request Status Update</h2><p>Dear ${request.requesterName},</p><p>We regret to inform you that your blood request could not be approved at this time. Please contact us directly for assistance.</p>`;
      } else if (status === "Completed") {
        emailSubject = "🎉 Blood Request Completed - Jhar Jeevan";
        emailMessage = `<h2>Blood Request Completed Successfully</h2><p>Dear ${request.requesterName},</p><p>Your blood request has been marked as completed. Thank you for using Jhar Jeevan services.</p>`;
      }

      if (emailMessage) {
        transporter
          .sendMail({
            from: process.env.EMAIL_USER,
            to: request.requesterEmail,
            subject: emailSubject,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">${emailMessage}</div>`,
          })
          .catch((err) => console.error("Email failed:", err.message));
      }
    }

    res.json({
      success: true,
      message: `Request ${status.toLowerCase()} successfully`,
      request,
    });
  } catch (err) {
    console.error("Error updating request:", err);
    res.status(500).json({
      success: false,
      message: "Error updating request status",
    });
  }
});

// DELETE request (protected)
app.delete("/api/requests/:id", verifyAdmin, async (req, res) => {
  try {
    const request = await BloodRequest.findByIdAndDelete(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    res.json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting request:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting request",
    });
  }
});

// GET requests by blood group (public)
app.get("/api/requests/blood/:bloodGroup", async (req, res) => {
  try {
    const requests = await BloodRequest.find({
      bloodGroup: req.params.bloodGroup,
      status: "Pending",
    })
      .sort({ priority: -1, createdAt: 1 })
      .limit(20);

    res.json({ success: true, requests });
  } catch (err) {
    console.error("Error fetching requests by blood group:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching requests",
    });
  }
});

/* -------------------- STATISTICS ROUTES -------------------- */

app.get("/api/stats", verifyAdmin, async (req, res) => {
  try {
    const [
      totalDonors,
      activeDonors,
      totalRequests,
      pendingRequests,
      urgentRequests,
      approvedRequests,
      completedRequests,
    ] = await Promise.all([
      Donor.countDocuments(),
      Donor.countDocuments({ isAvailable: true }),
      BloodRequest.countDocuments(),
      BloodRequest.countDocuments({ status: "Pending" }),
      BloodRequest.countDocuments({ priority: "Urgent", status: "Pending" }),
      BloodRequest.countDocuments({ status: "Approved" }),
      BloodRequest.countDocuments({ status: "Completed" }),
    ]);

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const [donorsByBloodGroup, requestsByBloodGroup] = await Promise.all([
      Promise.all(
        bloodGroups.map((bg) => Donor.countDocuments({ bloodGroup: bg }))
      ),
      Promise.all(
        bloodGroups.map((bg) =>
          BloodRequest.countDocuments({ bloodGroup: bg, status: "Pending" })
        )
      ),
    ]);

    const donorsByBloodGroupObj = {};
    const requestsByBloodGroupObj = {};
    bloodGroups.forEach((bg, index) => {
      donorsByBloodGroupObj[bg] = donorsByBloodGroup[index];
      requestsByBloodGroupObj[bg] = requestsByBloodGroup[index];
    });

    const [recentDonors, recentRequests] = await Promise.all([
      Donor.find().sort({ createdAt: -1 }).limit(5),
      BloodRequest.find().sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      stats: {
        totalDonors,
        activeDonors,
        totalRequests,
        pendingRequests,
        urgentRequests,
        approvedRequests,
        completedRequests,
        donorsByBloodGroup: donorsByBloodGroupObj,
        requestsByBloodGroup: requestsByBloodGroupObj,
        recentDonors,
        recentRequests,
      },
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
    });
  }
});

/* -------------------- SEARCH ROUTES -------------------- */

app.get("/api/search/donors", verifyAdmin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const donors = await Donor.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { bloodGroup: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
      ],
    }).limit(20);

    res.json({ success: true, donors });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({
      success: false,
      message: "Error searching donors",
    });
  }
});

/* -------------------- HEALTH CHECK -------------------- */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    mongodb:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    email: transporter ? "Configured" : "Not configured",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});





// ============ AI ROUTES (NEW FEATURE) ============
/* -------------------- AI ROUTES -------------------- */

// Import AI routes
const { initAIRoutes } = require("./server/routes/aiRoutes");

// Initialize AI routes with models
const aiRoutes = initAIRoutes(Donor, BloodRequest);
app.use("/api/ai", aiRoutes);

console.log("🤖 AI Routes Initialized: Donor Recommender, Chatbot, Demand Predictor");
/* -------------------- ERROR HANDLING MIDDLEWARE -------------------- */

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong on the server",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/* -------------------- SERVER INITIALIZATION -------------------- */

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log(`🚀 Jhar Jeevan Blood Bank Server`);
  console.log("=".repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔒 Admin login: POST http://localhost:${PORT}/api/admin/login`);
  console.log("-".repeat(50));
  console.log(
    `📧 Email: ${transporter ? "✅ Configured" : "❌ Not configured"}`
  );
  console.log(`🔐 Admin Email: ${process.env.ADMIN_EMAIL}`);
  if (process.env.ADMIN_PHONE)
    console.log(`📱 Admin Phone: ${process.env.ADMIN_PHONE}`);
  console.log("=".repeat(50));
  console.log("✨ System Ready! ✨\n");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});


module.exports = app;