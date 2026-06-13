// employeeService — signup / OTP / login / read-self for the /join-team
// Employee module. Employees are NOT Users; they're a parallel entity
// that auths via its own JWT with role='employee' so an employee token
// can never accidentally authenticate a User-facing API call.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Employee, sequelize } = require('../models');
const phoneOtpService = require('./phoneOtpService');
const env = require('../config/env');

const PASSWORD_MIN_LEN = 8;

// employee_code is the digit-only form of the phone — e.g. "9876543210"
// for `+91 98765 43210`. Used as a public identifier on every pro
// onboarded by the employee.
function deriveEmployeeCode(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Drop a leading country code if 11+ digits and starts with 91 (India).
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
}

function sanitisePhone(raw) {
  return String(raw || '').replace(/[\s-]/g, '').trim();
}

function publicEmployee(emp) {
  if (!emp) return null;
  const p = typeof emp.get === 'function' ? emp.get({ plain: true }) : emp;
  delete p.passwordHash;
  return p;
}

function signEmployeeToken(emp) {
  return jwt.sign(
    {
      sub: emp.id,
      role: 'employee',
      employeeCode: emp.employeeCode,
      type: 'employee-access',
    },
    env.jwtSecret,
    { expiresIn: env.accessTokenExpiry }
  );
}

// ---- Signup (step 1: create the row + send OTP) ----------------------

async function startSignup({ name, email, phone, termsAccepted }) {
  if (!name || !String(name).trim()) {
    throw { statusCode: 422, message: 'Name is required.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    throw { statusCode: 422, message: 'A valid email is required.' };
  }
  const phoneClean = sanitisePhone(phone);
  if (!/^\+?\d{8,15}$/.test(phoneClean)) {
    throw { statusCode: 422, message: 'A valid phone number is required.' };
  }
  if (!termsAccepted) {
    throw {
      statusCode: 422,
      message: 'You must accept the Terms & Privacy Policy to continue.',
    };
  }

  const employeeCode = deriveEmployeeCode(phoneClean);
  const emailNorm = String(email).trim().toLowerCase();

  // Conflict check — phone OR email OR employee_code already taken.
  const existing = await Employee.findOne({
    where: {
      [Op.or]: [
        { phone: phoneClean },
        { email: emailNorm },
        { employeeCode },
      ],
    },
  });
  if (existing) {
    // If the existing row hasn't completed OTP yet, allow them to
    // resume by re-issuing an OTP — this matches the brief's
    // "Resend OTP" allowance.
    if (!existing.otpVerified) {
      await phoneOtpService.sendOtp({
        phone: phoneClean,
        purpose: 'employee-signup',
      });
      return { resumed: true, employeeId: existing.id };
    }
    // Already-verified collision — give the user a clear error so
    // they know which field already exists.
    if (existing.phone === phoneClean || existing.employeeCode === employeeCode) {
      throw {
        statusCode: 409,
        message: 'This phone number is already registered as an employee.',
        code: 'EMPLOYEE_PHONE_TAKEN',
      };
    }
    throw {
      statusCode: 409,
      message: 'This email is already registered as an employee.',
      code: 'EMPLOYEE_EMAIL_TAKEN',
    };
  }

  const created = await Employee.create({
    employeeCode,
    name: String(name).trim(),
    email: emailNorm,
    phone: phoneClean,
    termsAccepted: true,
    termsAcceptedAt: new Date(),
    otpVerified: false,
    status: 'active',
  });
  await phoneOtpService.sendOtp({
    phone: phoneClean,
    purpose: 'employee-signup',
  });
  return { employeeId: created.id };
}

async function resendSignupOtp({ phone }) {
  const phoneClean = sanitisePhone(phone);
  if (!phoneClean) {
    throw { statusCode: 422, message: 'Phone number is required.' };
  }
  const emp = await Employee.findOne({ where: { phone: phoneClean } });
  if (!emp) throw { statusCode: 404, message: 'No employee with this phone.' };
  if (emp.otpVerified) {
    throw { statusCode: 409, message: 'This phone is already verified.' };
  }
  await phoneOtpService.sendOtp({
    phone: phoneClean,
    purpose: 'employee-signup',
  });
  return { ok: true };
}

// ---- Signup (step 2: verify OTP + optional set password) -------------

async function verifySignupOtp({ phone, code, password }) {
  const phoneClean = sanitisePhone(phone);
  if (!phoneClean || !code) {
    throw { statusCode: 422, message: 'Phone and OTP code are required.' };
  }
  const emp = await Employee.findOne({ where: { phone: phoneClean } });
  if (!emp) throw { statusCode: 404, message: 'Employee not found.' };

  const okOtp = await phoneOtpService.verifyOtp({
    phone: phoneClean,
    purpose: 'employee-signup',
    code: String(code).trim(),
  });
  if (!okOtp) {
    throw {
      statusCode: 401,
      message: 'Invalid or expired OTP. Please request a new one.',
      code: 'EMPLOYEE_OTP_INVALID',
    };
  }
  await phoneOtpService.consumeOtp({
    phone: phoneClean,
    purpose: 'employee-signup',
  });

  const patch = { otpVerified: true };
  if (password) {
    if (String(password).length < PASSWORD_MIN_LEN) {
      throw {
        statusCode: 422,
        message: `Password must be at least ${PASSWORD_MIN_LEN} characters.`,
      };
    }
    patch.passwordHash = await bcrypt.hash(String(password), 10);
  }
  await emp.update(patch);
  await emp.update({ lastLoginAt: new Date() });
  return {
    employee: publicEmployee(emp),
    accessToken: signEmployeeToken(emp),
  };
}

// ---- Login (password OR OTP) -----------------------------------------

async function loginWithPassword({ identifier, password }) {
  if (!identifier || !password) {
    throw {
      statusCode: 422,
      message: 'Email/phone and password are required.',
    };
  }
  const id = String(identifier).trim();
  const isEmail = id.includes('@');
  const emp = isEmail
    ? await Employee.findOne({ where: { email: id.toLowerCase() } })
    : await Employee.findOne({ where: { phone: sanitisePhone(id) } });
  if (!emp) {
    throw { statusCode: 401, message: 'No employee account found.' };
  }
  if (!emp.otpVerified) {
    throw {
      statusCode: 403,
      message: 'Verify your phone via OTP before logging in.',
      code: 'EMPLOYEE_NOT_VERIFIED',
    };
  }
  if (emp.status !== 'active') {
    throw {
      statusCode: 403,
      message: 'This employee account is not active. Contact admin.',
    };
  }
  if (!emp.passwordHash) {
    throw {
      statusCode: 403,
      message:
        'No password set on this account — use OTP login instead, then set a password from your profile.',
      code: 'EMPLOYEE_NO_PASSWORD',
    };
  }
  const ok = await bcrypt.compare(String(password), emp.passwordHash);
  if (!ok) {
    throw { statusCode: 401, message: 'Incorrect password.' };
  }
  await emp.update({ lastLoginAt: new Date() });
  return {
    employee: publicEmployee(emp),
    accessToken: signEmployeeToken(emp),
  };
}

async function sendLoginOtp({ phone }) {
  const phoneClean = sanitisePhone(phone);
  if (!phoneClean) {
    throw { statusCode: 422, message: 'Phone number is required.' };
  }
  const emp = await Employee.findOne({ where: { phone: phoneClean } });
  if (!emp) throw { statusCode: 404, message: 'No employee with this phone.' };
  if (!emp.otpVerified) {
    throw {
      statusCode: 403,
      message: 'Finish signup verification before logging in via OTP.',
      code: 'EMPLOYEE_NOT_VERIFIED',
    };
  }
  if (emp.status !== 'active') {
    throw { statusCode: 403, message: 'Account is not active.' };
  }
  await phoneOtpService.sendOtp({
    phone: phoneClean,
    purpose: 'employee-login',
  });
  return { ok: true };
}

async function loginWithOtp({ phone, code }) {
  const phoneClean = sanitisePhone(phone);
  if (!phoneClean || !code) {
    throw { statusCode: 422, message: 'Phone and OTP code are required.' };
  }
  const emp = await Employee.findOne({ where: { phone: phoneClean } });
  if (!emp) throw { statusCode: 404, message: 'No employee with this phone.' };
  if (!emp.otpVerified) {
    throw {
      statusCode: 403,
      message: 'Finish signup verification before logging in.',
    };
  }
  if (emp.status !== 'active') {
    throw { statusCode: 403, message: 'Account is not active.' };
  }
  const okOtp = await phoneOtpService.verifyOtp({
    phone: phoneClean,
    purpose: 'employee-login',
    code: String(code).trim(),
  });
  if (!okOtp) {
    throw {
      statusCode: 401,
      message: 'Invalid or expired OTP.',
      code: 'EMPLOYEE_OTP_INVALID',
    };
  }
  await phoneOtpService.consumeOtp({
    phone: phoneClean,
    purpose: 'employee-login',
  });
  await emp.update({ lastLoginAt: new Date() });
  return {
    employee: publicEmployee(emp),
    accessToken: signEmployeeToken(emp),
  };
}

async function getMe(employeeId) {
  const emp = await Employee.findByPk(employeeId);
  if (!emp) throw { statusCode: 404, message: 'Employee not found.' };
  return publicEmployee(emp);
}

// Used by the auth middleware. Returns null when the token's employee
// row has been deleted or blocked.
async function getActiveById(employeeId) {
  const emp = await Employee.findByPk(employeeId);
  if (!emp || emp.status !== 'active') return null;
  return emp;
}

module.exports = {
  startSignup,
  resendSignupOtp,
  verifySignupOtp,
  loginWithPassword,
  sendLoginOtp,
  loginWithOtp,
  getMe,
  getActiveById,
  publicEmployee,
  deriveEmployeeCode,
  signEmployeeToken,
};
