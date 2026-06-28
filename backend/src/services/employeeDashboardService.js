// employeeDashboardService — read endpoints + payout flow for the
// authenticated employee. Onboarding hands off to the existing
// professional-registration service with the employee context stamped
// onto the ProfessionalDetail row.

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
const professionalRegistrationService = require('./professionalRegistrationService');

// --- Settings -----------------------------------------------------------
const SETTING_KEYS = {
  commission: 'employee_commission_per_approved_professional',
  minPayout: 'employee_minimum_payout_amount',
  maxPayout: 'employee_maximum_payout_amount',
  // Multiplier applied to the base commission for the Employee-of-the-Month
  // recognition cards on /join-team/dashboard. Surfaced in the dashboard
  // summary; admin edits via /admin/employee-settings.
  topPerformerMultiplier: 'employee_top_performer_multiplier',
};

const DEFAULTS = {
  commission: 10, // ₹10 per approved pro
  minPayout: 100, // ₹100
  maxPayout: 10000, // ₹10,000
  topPerformerMultiplier: 2, // 2× the base commission for top performers
};

async function readNumberSetting(key, fallback) {
  const row = await AdminSetting.findOne({ where: { key } });
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
}

async function readEmployeeSettings() {
  const [commission, minPayout, maxPayout, topPerformerMultiplier] =
    await Promise.all([
      readNumberSetting(SETTING_KEYS.commission, DEFAULTS.commission),
      readNumberSetting(SETTING_KEYS.minPayout, DEFAULTS.minPayout),
      readNumberSetting(SETTING_KEYS.maxPayout, DEFAULTS.maxPayout),
      readNumberSetting(
        SETTING_KEYS.topPerformerMultiplier,
        DEFAULTS.topPerformerMultiplier
      ),
    ]);
  return { commission, minPayout, maxPayout, topPerformerMultiplier };
}

// --- Balance accounting -------------------------------------------------
// Earned   = SUM(commission_amount) where status='earned'
// Paid     = SUM(requested_amount)  where status='paid'
// Pending  = SUM(requested_amount)  where status IN ('pending','approved','on-hold')
// Available = Earned - Paid - Pending  (a request reserves the amount
// until it's resolved, so the employee can't double-book).
async function computeBalance(employeeId) {
  const [earnedRow] = await EmployeeCommission.findAll({
    where: { employeeId, status: 'earned' },
    attributes: [
      [
        EmployeeCommission.sequelize.fn(
          'COALESCE',
          EmployeeCommission.sequelize.fn(
            'SUM',
            EmployeeCommission.sequelize.col('commissionAmount')
          ),
          0
        ),
        'sum',
      ],
    ],
    raw: true,
  });
  const earned = Number((earnedRow && earnedRow.sum) || 0);

  async function sumPayouts(statuses) {
    const [row] = await EmployeePayout.findAll({
      where: { employeeId, status: { [Op.in]: statuses } },
      attributes: [
        [
          EmployeePayout.sequelize.fn(
            'COALESCE',
            EmployeePayout.sequelize.fn(
              'SUM',
              EmployeePayout.sequelize.col('requestedAmount')
            ),
            0
          ),
          'sum',
        ],
      ],
      raw: true,
    });
    return Number((row && row.sum) || 0);
  }
  const paid = await sumPayouts(['paid']);
  const pending = await sumPayouts(['pending', 'approved', 'on-hold']);
  const available = Math.max(0, earned - paid - pending);
  return { earned, paid, pending, available };
}

// --- Dashboard summary --------------------------------------------------
async function getSummary(employeeId) {
  const counts = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  // ProfessionalApproval lives keyed on userId; ProfessionalDetail has
  // employeeId on the same userId, so we join through userId.
  const details = await ProfessionalDetail.findAll({
    where: { employeeId },
    attributes: ['userId'],
    raw: true,
  });
  const userIds = details.map((d) => d.userId).filter(Boolean);
  counts.total = userIds.length;
  if (userIds.length > 0) {
    const approvals = await ProfessionalApproval.findAll({
      where: { userId: { [Op.in]: userIds } },
      attributes: ['userId', 'status'],
      raw: true,
    });
    // Pick the latest approval per userId — there can be one or two
    // (resubmissions create a fresh row in some flows).
    const byUser = {};
    for (const a of approvals) {
      byUser[a.userId] = a.status;
    }
    for (const userId of userIds) {
      const status = byUser[userId];
      if (status === 'APPROVED') counts.approved += 1;
      else if (status === 'REJECTED') counts.rejected += 1;
      else counts.pending += 1;
    }
  }

  const balance = await computeBalance(employeeId);
  const settings = await readEmployeeSettings();
  return {
    professionals: counts,
    earned: balance.earned,
    paid: balance.paid,
    pendingPayout: balance.pending,
    availablePayout: balance.available,
    settings,
  };
}

// --- Onboarded professionals list --------------------------------------
async function listOnboardedProfessionals(employeeId) {
  const details = await ProfessionalDetail.findAll({
    where: { employeeId },
    raw: true,
    order: [['createdAt', 'DESC']],
  });
  if (details.length === 0) return [];
  const userIds = details.map((d) => d.userId).filter(Boolean);
  const [users, approvals] = await Promise.all([
    User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: [
        'id',
        'fullName',
        'firstName',
        'lastName',
        'email',
        'mobileNumber',
        'status',
        'createdAt',
      ],
      raw: true,
    }),
    ProfessionalApproval.findAll({
      where: { userId: { [Op.in]: userIds } },
      raw: true,
      order: [['createdAt', 'DESC']],
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const approvalMap = new Map();
  for (const a of approvals) {
    // First write wins because we ordered DESC, so the latest stays.
    if (!approvalMap.has(a.userId)) approvalMap.set(a.userId, a);
  }
  return details.map((d) => {
    const user = userMap.get(d.userId) || {};
    const approval = approvalMap.get(d.userId) || {};
    return {
      userId: d.userId,
      name:
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        '—',
      email: user.email || null,
      mobileNumber: user.mobileNumber || null,
      professionalType: d.professionalType || null,
      submittedAt: d.createdAt,
      approvalStatus: approval.status || 'PENDING_APPROVAL',
      rejectionReason: approval.rejectionReason || null,
      approvedAt: approval.approvedAt || null,
      rejectedAt: approval.rejectedAt || null,
    };
  });
}

// --- Commissions list ---------------------------------------------------
async function listCommissions(employeeId) {
  const rows = await EmployeeCommission.findAll({
    where: { employeeId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (rows.length === 0) return [];
  const userIds = rows.map((r) => r.professionalUserId).filter(Boolean);
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ['id', 'fullName', 'firstName', 'lastName', 'email'],
    raw: true,
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = userMap.get(r.professionalUserId) || {};
    return {
      ...r,
      professionalName:
        u.fullName ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        r.professionalUserId,
      professionalEmail: u.email || null,
    };
  });
}

// --- Payouts ------------------------------------------------------------
async function listPayouts(employeeId) {
  return EmployeePayout.findAll({
    where: { employeeId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
}

async function requestPayout(employeeId, { requestedAmount }) {
  const n = Number(requestedAmount);
  if (!Number.isFinite(n) || n <= 0) {
    throw { statusCode: 422, message: 'Enter a valid payout amount.' };
  }
  const settings = await readEmployeeSettings();
  if (n < settings.minPayout) {
    throw {
      statusCode: 422,
      message: `Minimum payout amount is ₹${settings.minPayout}.`,
    };
  }
  if (n > settings.maxPayout) {
    throw {
      statusCode: 422,
      message: `Maximum payout amount is ₹${settings.maxPayout}.`,
    };
  }
  const balance = await computeBalance(employeeId);
  if (n > balance.available) {
    throw {
      statusCode: 422,
      message: `Requested amount exceeds your available balance (₹${balance.available}).`,
    };
  }
  // One pending request at a time keeps the queue clean.
  const existing = await EmployeePayout.findOne({
    where: {
      employeeId,
      status: { [Op.in]: ['pending', 'approved', 'on-hold'] },
    },
  });
  if (existing) {
    throw {
      statusCode: 409,
      message:
        'You already have a payout request in flight. Cancel it or wait for the admin decision.',
    };
  }
  const row = await EmployeePayout.create({
    employeeId,
    requestedAmount: n,
    availableAtRequest: balance.available,
    status: 'pending',
  });
  return row.get({ plain: true });
}

async function cancelPayout(employeeId, payoutId) {
  const row = await EmployeePayout.findOne({
    where: { id: payoutId, employeeId },
  });
  if (!row) throw { statusCode: 404, message: 'Payout request not found.' };
  if (row.status !== 'pending') {
    throw {
      statusCode: 409,
      message: 'Only pending payout requests can be cancelled.',
    };
  }
  await row.update({ status: 'cancelled' });
  return row.get({ plain: true });
}

// --- Onboarding -- a thin wrapper over the public registration service.
// Stamps employeeId + employeeCode on the ProfessionalDetail row so
// the admin-approval commission hook knows who to credit.
// Requires an `otpCode` that matches a fresh OTP issued to the
// professional's mobile via /api/auth/phone/send-otp (purpose=signup).
// The OTP is verified + consumed before registration so an employee
// can't onboard random phones without the professional's consent.
async function onboardProfessional(employee, body = {}) {
  const phoneOtpService = require('./phoneOtpService');
  const phone = String(body.mobileNumber || '').replace(/[\s-]/g, '').trim();
  const code = String(body.otpCode || '').trim();
  if (!phone) {
    throw {
      statusCode: 422,
      message: 'Professional mobile number is required.',
    };
  }
  if (!code) {
    throw {
      statusCode: 422,
      message:
        'OTP verification is required — send and verify an OTP to the professional’s phone first.',
      code: 'ONBOARD_OTP_REQUIRED',
    };
  }
  const okOtp = await phoneOtpService.verifyOtp({
    phone,
    purpose: 'signup',
    code,
  });
  if (!okOtp) {
    throw {
      statusCode: 401,
      message: 'Invalid or expired OTP. Send a fresh one to the professional.',
      code: 'ONBOARD_OTP_INVALID',
    };
  }
  await phoneOtpService.consumeOtp({ phone, purpose: 'signup' });

  const data = {
    ...body,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
  };
  return professionalRegistrationService.registerProfessional(data);
}

module.exports = {
  getSummary,
  listOnboardedProfessionals,
  listCommissions,
  listPayouts,
  requestPayout,
  cancelPayout,
  onboardProfessional,
  readEmployeeSettings,
  computeBalance,
  SETTING_KEYS,
  DEFAULTS,
};
