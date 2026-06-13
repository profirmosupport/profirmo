// employeeAdminService — admin-side read/write for the Employee module.
// Listing, detail (with onboarded pros + financial aggregates), inline
// update (status / name / email), payout queue + decision, and
// commission / payout-limit settings read/write.

const { Op } = require('sequelize');
const {
  Employee,
  EmployeeCommission,
  EmployeePayout,
  ProfessionalDetail,
  ProfessionalApproval,
  User,
  AdminSetting,
} = require('../models');
const employeeDashboardService = require('./employeeDashboardService');

const PAYOUT_STATUSES = new Set([
  'pending',
  'approved',
  'paid',
  'rejected',
  'on-hold',
  'cancelled',
]);

// --- List employees -----------------------------------------------------
// Returns one row per employee with the aggregates the admin listing
// surfaces: onboarded counts (total/pending/approved/rejected) and
// the balance breakdown.
async function listEmployees({ q = '', status = '' } = {}) {
  const where = {};
  const trimmed = String(q || '').trim();
  if (trimmed) {
    where[Op.or] = [
      { name: { [Op.like]: `%${trimmed}%` } },
      { email: { [Op.like]: `%${trimmed}%` } },
      { phone: { [Op.like]: `%${trimmed}%` } },
      { employeeCode: { [Op.like]: `%${trimmed}%` } },
    ];
  }
  if (status) where.status = status;
  const employees = await Employee.findAll({
    where,
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  if (employees.length === 0) return [];

  // Hydrate aggregates per employee with one query each. Done in
  // Promise.all so the listing latency stays reasonable; the query
  // count scales with rows but each is keyed on indexed columns.
  const decorated = await Promise.all(
    employees.map(async (emp) => {
      const balance = await employeeDashboardService.computeBalance(emp.id);
      // Counts of onboarded pros by approval status.
      const details = await ProfessionalDetail.findAll({
        where: { employeeId: emp.id },
        attributes: ['userId'],
        raw: true,
      });
      const counts = { total: details.length, pending: 0, approved: 0, rejected: 0 };
      const userIds = details.map((d) => d.userId).filter(Boolean);
      if (userIds.length > 0) {
        const approvals = await ProfessionalApproval.findAll({
          where: { userId: { [Op.in]: userIds } },
          attributes: ['userId', 'status'],
          raw: true,
        });
        const byUser = {};
        for (const a of approvals) byUser[a.userId] = a.status;
        for (const userId of userIds) {
          const status = byUser[userId];
          if (status === 'APPROVED') counts.approved += 1;
          else if (status === 'REJECTED') counts.rejected += 1;
          else counts.pending += 1;
        }
      }
      // Drop the password hash before returning.
      delete emp.passwordHash;
      return {
        ...emp,
        professionals: counts,
        earnedAmount: balance.earned,
        paidAmount: balance.paid,
        pendingPayoutAmount: balance.pending,
        availablePayoutAmount: balance.available,
      };
    })
  );
  return decorated;
}

// --- Employee detail ----------------------------------------------------
async function getEmployee(id) {
  const emp = await Employee.findByPk(id, { raw: true });
  if (!emp) throw { statusCode: 404, message: 'Employee not found.' };
  delete emp.passwordHash;
  const balance = await employeeDashboardService.computeBalance(id);
  const settings = await employeeDashboardService.readEmployeeSettings();
  return { ...emp, balance, settings };
}

async function listEmployeeProfessionals(employeeId) {
  // Re-use the dashboard list to keep the shape consistent across
  // the admin + employee surfaces.
  return employeeDashboardService.listOnboardedProfessionals(employeeId);
}

// --- Update employee (admin scope) -------------------------------------
const UPDATABLE_FIELDS = new Set(['name', 'email', 'phone', 'status']);
const ALLOWED_STATUSES = new Set(['active', 'inactive', 'blocked']);

// Create an employee from the admin panel. Skips the OTP flow:
// admin-created accounts are flagged otpVerified=true so the employee
// can log in immediately with the supplied password. employeeCode is
// derived from phone using the same rule as self-signup.
async function createEmployee(input = {}, adminUserId) {
  const bcrypt = require('bcryptjs');
  const employeeService = require('./employeeService');

  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const phone = String(input.phone || '').replace(/[\s-]/g, '').trim();
  const password = String(input.password || '');

  if (!name) throw { statusCode: 422, message: 'Name is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { statusCode: 422, message: 'A valid email is required.' };
  }
  if (!/^\+?\d{8,15}$/.test(phone)) {
    throw { statusCode: 422, message: 'A valid phone number is required.' };
  }
  if (password && password.length < 8) {
    throw {
      statusCode: 422,
      message: 'Password must be at least 8 characters.',
    };
  }

  const employeeCode = employeeService.deriveEmployeeCode(phone);
  const clash = await Employee.findOne({
    where: {
      [Op.or]: [{ email }, { phone }, { employeeCode }],
    },
  });
  if (clash) {
    throw {
      statusCode: 409,
      message: 'An employee with that email, phone, or code already exists.',
    };
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const created = await Employee.create({
    employeeCode,
    name,
    email,
    phone,
    passwordHash,
    // Admin-created accounts skip the OTP gate — they go live straight
    // away. T&C is taken as accepted on the admin's behalf.
    otpVerified: true,
    termsAccepted: true,
    termsAcceptedAt: new Date(),
    status: 'active',
  });
  const plain = created.get({ plain: true });
  delete plain.passwordHash;
  if (adminUserId) {
    // No-op without the audit log — left here so future revisions
    // have a hook point without re-touching the call site.
  }
  return plain;
}

// Delete an employee. Refuses when the row has any commission OR
// payout history, since those records are part of the financial
// audit trail. Admin should set status='blocked' instead in that
// case. The error message points to the safer alternative.
async function deleteEmployee(id) {
  const emp = await Employee.findByPk(id);
  if (!emp) throw { statusCode: 404, message: 'Employee not found.' };
  const [commissionCount, payoutCount, professionalCount] = await Promise.all([
    EmployeeCommission.count({ where: { employeeId: id } }),
    EmployeePayout.count({ where: { employeeId: id } }),
    ProfessionalDetail.count({ where: { employeeId: id } }),
  ]);
  if (commissionCount + payoutCount + professionalCount > 0) {
    throw {
      statusCode: 409,
      message:
        'Cannot delete an employee with commission, payout, or onboarding history. Set their status to "blocked" instead.',
    };
  }
  await emp.destroy();
  return { id, removed: true };
}

async function updateEmployee(id, patch = {}) {
  const emp = await Employee.findByPk(id);
  if (!emp) throw { statusCode: 404, message: 'Employee not found.' };
  const next = {};
  for (const k of Object.keys(patch)) {
    if (!UPDATABLE_FIELDS.has(k)) continue;
    next[k] = patch[k];
  }
  if (next.status && !ALLOWED_STATUSES.has(next.status)) {
    throw {
      statusCode: 422,
      message: 'Status must be active, inactive, or blocked.',
    };
  }
  if (next.email) {
    const clash = await Employee.findOne({
      where: { email: String(next.email).toLowerCase(), id: { [Op.ne]: id } },
    });
    if (clash) {
      throw { statusCode: 409, message: 'Another employee uses that email.' };
    }
    next.email = String(next.email).toLowerCase();
  }
  await emp.update(next);
  const plain = emp.get({ plain: true });
  delete plain.passwordHash;
  return plain;
}

// --- Payout queue + decisions ------------------------------------------
async function listAllPayouts({ status = '' } = {}) {
  const where = {};
  if (status) where.status = status;
  const rows = await EmployeePayout.findAll({
    where,
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (rows.length === 0) return [];
  const empIds = [...new Set(rows.map((r) => r.employeeId))];
  const employees = await Employee.findAll({
    where: { id: { [Op.in]: empIds } },
    attributes: ['id', 'name', 'employeeCode', 'email', 'phone'],
    raw: true,
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    employee: empMap.get(r.employeeId) || null,
  }));
}

// `decision` is one of: approved | paid | rejected | on-hold.
// Admin also passes `adminRemarks` and (for `paid`) `paymentReference`.
async function decidePayout(payoutId, adminUserId, body = {}) {
  const row = await EmployeePayout.findByPk(payoutId);
  if (!row) throw { statusCode: 404, message: 'Payout not found.' };
  const decision = String(body.decision || '').trim();
  if (!['approved', 'paid', 'rejected', 'on-hold'].includes(decision)) {
    throw {
      statusCode: 422,
      message: 'Decision must be approved, paid, rejected, or on-hold.',
    };
  }
  // Block illegal transitions — cancelled is terminal, paid is terminal.
  if (row.status === 'cancelled' || row.status === 'paid') {
    throw {
      statusCode: 409,
      message: `Cannot change a ${row.status} payout.`,
    };
  }
  // Marking as paid requires an external reference (cheque #, UTR, etc.)
  if (decision === 'paid' && !String(body.paymentReference || '').trim()) {
    throw {
      statusCode: 422,
      message: 'A payment reference is required to mark as paid.',
    };
  }
  const patch = {
    status: decision,
    adminRemarks:
      body.adminRemarks != null ? String(body.adminRemarks) : row.adminRemarks,
  };
  if (decision === 'paid') {
    patch.paymentReference = String(body.paymentReference || '').trim();
    patch.paidAt = new Date();
    patch.paidBy = adminUserId || null;
  }
  await row.update(patch);
  return row.get({ plain: true });
}

// --- Settings --------------------------------------------------------
const KEYS = employeeDashboardService.SETTING_KEYS;
const DEFS = employeeDashboardService.DEFAULTS;

async function readSettings() {
  return employeeDashboardService.readEmployeeSettings();
}

async function writeSettings({ commission, minPayout, maxPayout }, adminUserId) {
  const updates = [
    { key: KEYS.commission, value: commission, fallback: DEFS.commission },
    { key: KEYS.minPayout, value: minPayout, fallback: DEFS.minPayout },
    { key: KEYS.maxPayout, value: maxPayout, fallback: DEFS.maxPayout },
  ];
  for (const u of updates) {
    if (u.value == null || u.value === '') continue;
    const n = Number(u.value);
    if (!Number.isFinite(n) || n < 0) {
      throw {
        statusCode: 422,
        message: `${u.key} must be a non-negative number.`,
      };
    }
    const [row] = await AdminSetting.findOrCreate({
      where: { key: u.key },
      defaults: {
        key: u.key,
        value: String(n),
        updatedByUserId: adminUserId || null,
      },
    });
    if (row.value !== String(n)) {
      await row.update({
        value: String(n),
        updatedByUserId: adminUserId || null,
      });
    }
  }
  // Sanity: min <= max once both are written.
  const fresh = await readSettings();
  if (fresh.minPayout > fresh.maxPayout) {
    throw {
      statusCode: 422,
      message: 'Minimum payout cannot exceed maximum payout.',
    };
  }
  return fresh;
}

module.exports = {
  listEmployees,
  getEmployee,
  listEmployeeProfessionals,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listAllPayouts,
  decidePayout,
  readSettings,
  writeSettings,
  PAYOUT_STATUSES,
};
