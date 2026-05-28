// Email templates for the Profirmo backend (Phase 6).
//
// renderTemplate(name, vars) returns a { subject, html, text } object ready
// to pass to emailService.sendEmail(). Each template is a function in the
// TEMPLATES registry below — adding a new one (Phases 7-8: approval /
// invitation emails) is just another entry.

// --- Shared layout ---------------------------------------------------------

// Escape a value for safe interpolation into HTML.
const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Wrap inner content in the branded Profirmo HTML shell.
const layout = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1d4ed8;padding:24px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Profirmo</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You received this email because an action was taken on your
                Profirmo account. If this was not you, please ignore this
                message.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Profirmo. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Render a primary call-to-action button.
const button = (label, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:6px;background-color:#1d4ed8;">
        <a href="${esc(url)}"
           style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;

// --- Template registry -----------------------------------------------------

const TEMPLATES = {
  /**
   * Email-verification message sent on signup / resend.
   * vars: { name, verifyUrl, expiryHours }
   */
  emailVerification(vars = {}) {
    const name = vars.name || 'there';
    const verifyUrl = vars.verifyUrl || '#';
    const expiryHours = vars.expiryHours || 48;

    const subject = 'Verify your Profirmo email address';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Confirm your email</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Hi ${esc(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Thanks for creating a Profirmo account. Please confirm your email
        address to activate your account and start using Profirmo.
      </p>
      ${button('Verify email address', verifyUrl)}
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7280;">
        This link expires in ${esc(expiryHours)} hours. If the button above
        does not work, copy and paste this URL into your browser:
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
        <a href="${esc(verifyUrl)}" style="color:#1d4ed8;">${esc(verifyUrl)}</a>
      </p>`
    );

    const text = [
      `Hi ${name},`,
      '',
      'Thanks for creating a Profirmo account. Please confirm your email',
      'address to activate your account:',
      '',
      verifyUrl,
      '',
      `This link expires in ${expiryHours} hours.`,
      'If you did not create this account, you can ignore this email.',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Invitation sent when a professional adds a new client to their book.
   * The client clicks the claim link, sets a password, and gets logged in.
   * vars: { name, professionalName, claimUrl, expiryHours }
   */
  clientInvitation(vars = {}) {
    const name = vars.name || 'there';
    const professionalName = vars.professionalName || 'A professional';
    const claimUrl = vars.claimUrl || '#';
    const expiryHours = vars.expiryHours || 168; // 7 days default

    const subject = 'You have been invited to Profirmo';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Profirmo</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Hi ${esc(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        ${esc(professionalName)} has added you as a client on Profirmo. Claim
        your account to view your cases, bookings, and consultation notes.
      </p>
      ${button('Claim your account', claimUrl)}
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7280;">
        This link expires in ${esc(expiryHours)} hours. If the button above
        does not work, copy and paste this URL into your browser:
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
        <a href="${esc(claimUrl)}" style="color:#1d4ed8;">${esc(claimUrl)}</a>
      </p>`
    );

    const text = [
      `Hi ${name},`,
      '',
      `${professionalName} has added you as a client on Profirmo.`,
      'Claim your account and set a password:',
      '',
      claimUrl,
      '',
      `This link expires in ${expiryHours} hours.`,
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Professional-approval message sent when an admin approves an application.
   * vars: { professionalName, professionalType, email, approvalDate,
   *         loginUrl, organizationName }
   */
  professionalApproval(vars = {}) {
    const professionalName = vars.professionalName || 'there';
    const professionalType = vars.professionalType || 'Professional';
    const email = vars.email || '';
    const approvalDate = vars.approvalDate || new Date().toLocaleDateString();
    const loginUrl = vars.loginUrl || '#';
    const organizationName = vars.organizationName || 'Profirmo';

    const subject = 'Your Professional Profile Has Been Approved';

    const detailRow = (label, value) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">${esc(
          label
        )}</td>
        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
          value
        )}</td>
      </tr>`;

    const canList = [
      'Access your professional dashboard',
      'Manage your profile and details',
      'Create and manage law firms',
      'Upload and manage your documents',
      'Connect with clients',
    ]
      .map(
        (item) =>
          `<li style="margin:0 0 6px;font-size:14px;line-height:1.6;">${esc(
            item
          )}</li>`
      )
      .join('');

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Profile Approved</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(professionalName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Congratulations! We are pleased to inform you that your professional
        profile has been reviewed and approved. Your account is now active.
      </p>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">Account Details</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        ${detailRow('Name', professionalName)}
        ${detailRow('Professional Type', professionalType)}
        ${detailRow('Email', email)}
        ${detailRow('Approval Date', approvalDate)}
      </table>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">You can now:</h2>
      <ul style="margin:0 0 8px;padding-left:20px;color:#1f2937;">
        ${canList}
      </ul>
      ${button('Log in to your account', loginUrl)}
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">
        If the button above does not work, copy and paste this URL into your
        browser:
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;word-break:break-all;">
        <a href="${esc(loginUrl)}" style="color:#1d4ed8;">${esc(loginUrl)}</a>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        Welcome aboard,<br />The ${esc(organizationName)} Team
      </p>`
    );

    const text = [
      `Dear ${professionalName},`,
      '',
      'Congratulations! Your professional profile has been reviewed and',
      'approved. Your account is now active.',
      '',
      'Account Details',
      `  Name:              ${professionalName}`,
      `  Professional Type: ${professionalType}`,
      `  Email:             ${email}`,
      `  Approval Date:     ${approvalDate}`,
      '',
      'You can now:',
      '  - Access your professional dashboard',
      '  - Manage your profile and details',
      '  - Create and manage law firms',
      '  - Upload and manage your documents',
      '  - Connect with clients',
      '',
      'Log in to your account:',
      loginUrl,
      '',
      'Welcome aboard,',
      `The ${organizationName} Team`,
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Professional-rejection message sent when an admin rejects an application.
   * vars: { professionalName, reason, resubmitUrl }
   */
  professionalRejection(vars = {}) {
    const professionalName = vars.professionalName || 'there';
    const reason = vars.reason || 'No specific reason was provided.';
    const resubmitUrl = vars.resubmitUrl || '#';

    const subject = 'Update on Your Professional Application';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Application Not Approved</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(professionalName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Thank you for your interest in joining Profirmo. After careful review,
        we are unable to approve your professional application at this time.
      </p>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">Reason</h2>
      <p style="margin:0 0 12px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;font-size:14px;line-height:1.6;color:#7f1d1d;">
        ${esc(reason)}
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        You are welcome to address the points above and resubmit your
        application for another review.
      </p>
      ${button('Update and resubmit', resubmitUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      `Dear ${professionalName},`,
      '',
      'Thank you for your interest in joining Profirmo. After careful review,',
      'we are unable to approve your professional application at this time.',
      '',
      'Reason:',
      `  ${reason}`,
      '',
      'You are welcome to address the points above and resubmit your',
      'application for another review:',
      resubmitUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Information-request message sent when an admin needs more details.
   * vars: { professionalName, requestedInfo }
   * The applicant replies by emailing profirmo.support@gmail.com — no
   * resubmit link is exposed.
   */
  professionalInfoRequest(vars = {}) {
    const professionalName = vars.professionalName || 'there';
    const requestedInfo =
      vars.requestedInfo || 'Additional information is required.';
    const supportEmail = 'profirmo.support@gmail.com';

    const subject = 'Additional Information Needed for Your Application';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">More Information Needed</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(professionalName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Thank you for submitting your professional application. Before we can
        complete our review, we need some additional information from you.
      </p>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">What we need</h2>
      <p style="margin:0 0 12px;padding:12px 16px;background-color:#fffbeb;border-left:4px solid #d97706;font-size:14px;line-height:1.6;color:#78350f;">
        ${esc(requestedInfo)}
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Please email the requested information to
        <a href="mailto:${supportEmail}" style="color:#0f766e;font-weight:600;">${supportEmail}</a>
        and our team will continue your review.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      `Dear ${professionalName},`,
      '',
      'Thank you for submitting your professional application. Before we can',
      'complete our review, we need some additional information from you.',
      '',
      'What we need:',
      `  ${requestedInfo}`,
      '',
      `Please email the requested information to ${supportEmail} and our`,
      'team will continue your review.',
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Admin-facing notice that a new professional has registered.
   * vars: { professionalName, professionalType, reviewUrl }
   */
  newProfessionalRegistration(vars = {}) {
    const professionalName = vars.professionalName || 'A new professional';
    const professionalType = vars.professionalType || 'Professional';
    const reviewUrl = vars.reviewUrl || '#';

    const subject = 'New Professional Registration Pending Review';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">New Registration</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        A new professional has registered on Profirmo and is awaiting admin
        approval.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">Name</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            professionalName
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;">Professional Type</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            professionalType
          )}</td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Please review their application and documents.
      </p>
      ${button('Review application', reviewUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      'A new professional has registered on Profirmo and is awaiting admin',
      'approval.',
      '',
      `  Name:              ${professionalName}`,
      `  Professional Type: ${professionalType}`,
      '',
      'Please review their application and documents:',
      reviewUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  // --- Phase 8: firm approval workflow + invitations -----------------------

  /**
   * Firm-approval message sent when an admin approves a law firm.
   * vars: { ownerName, firmName, approvalDate, dashboardUrl }
   */
  firmApproval(vars = {}) {
    const ownerName = vars.ownerName || 'there';
    const firmName = vars.firmName || 'your firm';
    const approvalDate = vars.approvalDate || new Date().toLocaleDateString();
    const dashboardUrl = vars.dashboardUrl || '#';

    const subject = 'Your Law Firm Has Been Approved';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Firm Approved</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(ownerName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Congratulations! Your law firm <strong>${esc(
          firmName
        )}</strong> has been reviewed and approved. Your firm is now active on
        Profirmo.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">Firm Name</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            firmName
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;">Approval Date</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            approvalDate
          )}</td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        You can now invite professionals to join your firm and manage your
        firm profile.
      </p>
      ${button('Go to your firm dashboard', dashboardUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        Welcome aboard,<br />The Profirmo Team
      </p>`
    );

    const text = [
      `Dear ${ownerName},`,
      '',
      `Congratulations! Your law firm "${firmName}" has been reviewed and`,
      'approved. Your firm is now active on Profirmo.',
      '',
      `  Firm Name:     ${firmName}`,
      `  Approval Date: ${approvalDate}`,
      '',
      'You can now invite professionals to join your firm and manage your',
      'firm profile:',
      dashboardUrl,
      '',
      'Welcome aboard,',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Firm-rejection message sent when an admin rejects a law firm.
   * vars: { ownerName, firmName, reason, resubmitUrl }
   */
  firmRejection(vars = {}) {
    const ownerName = vars.ownerName || 'there';
    const firmName = vars.firmName || 'your firm';
    const reason = vars.reason || 'No specific reason was provided.';
    const resubmitUrl = vars.resubmitUrl || '#';

    const subject = 'Update on Your Law Firm Registration';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Firm Not Approved</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(ownerName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        After careful review, we are unable to approve your law firm
        <strong>${esc(firmName)}</strong> at this time.
      </p>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">Reason</h2>
      <p style="margin:0 0 12px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;font-size:14px;line-height:1.6;color:#7f1d1d;">
        ${esc(reason)}
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        You are welcome to address the points above and resubmit your firm
        for another review.
      </p>
      ${button('Update and resubmit', resubmitUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      `Dear ${ownerName},`,
      '',
      `After careful review, we are unable to approve your law firm`,
      `"${firmName}" at this time.`,
      '',
      'Reason:',
      `  ${reason}`,
      '',
      'You are welcome to address the points above and resubmit your firm',
      'for another review:',
      resubmitUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Modifications-requested message sent when an admin needs firm changes.
   * vars: { ownerName, firmName, requestedModifications, resubmitUrl }
   */
  firmModificationsRequested(vars = {}) {
    const ownerName = vars.ownerName || 'there';
    const firmName = vars.firmName || 'your firm';
    const requestedModifications =
      vars.requestedModifications || 'Some changes are required.';
    const resubmitUrl = vars.resubmitUrl || '#';

    const subject = 'Changes Requested for Your Law Firm Registration';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Changes Requested</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(ownerName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Thank you for registering your law firm <strong>${esc(
          firmName
        )}</strong>. Before we can complete our review, we need a few changes
        from you.
      </p>
      <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">What we need</h2>
      <p style="margin:0 0 12px;padding:12px 16px;background-color:#fffbeb;border-left:4px solid #d97706;font-size:14px;line-height:1.6;color:#78350f;">
        ${esc(requestedModifications)}
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Please update your firm details with the requested changes and
        resubmit for review.
      </p>
      ${button('Update and resubmit', resubmitUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      `Dear ${ownerName},`,
      '',
      `Thank you for registering your law firm "${firmName}". Before we can`,
      'complete our review, we need a few changes from you.',
      '',
      'What we need:',
      `  ${requestedModifications}`,
      '',
      'Please update your firm details with the requested changes and',
      'resubmit for review:',
      resubmitUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Firm-invitation message sent to a prospective firm member. When the
   * invitee already has a Profirmo account, the CTA links to /invitations;
   * for a not-yet-registered address it links to /signup with an invite to
   * register first.
   * vars: { inviteeName, email, firmName, inviterName, role, acceptUrl,
   *         isRegistered }
   */
  firmInvitation(vars = {}) {
    const inviteeName = vars.inviteeName || vars.email || 'there';
    const firmName = vars.firmName || 'a law firm';
    const inviterName = vars.inviterName || 'A firm administrator';
    const role = vars.role || 'member';
    const acceptUrl = vars.acceptUrl || '#';
    const isRegistered = vars.isRegistered !== false;

    const subject = `You've been invited to join ${firmName} on Profirmo`;

    const roleLabel = role === 'co-owner' ? 'co-owner' : 'member';

    const registeredBody = `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Hi ${esc(inviteeName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        <strong>${esc(inviterName)}</strong> has invited you to join
        <strong>${esc(firmName)}</strong> on Profirmo as a
        <strong>${esc(roleLabel)}</strong>.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Open your invitations to accept or decline this invitation.
      </p>
      ${button('View your invitations', acceptUrl)}`;

    const unregisteredBody = `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Hi ${esc(inviteeName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        <strong>${esc(inviterName)}</strong> has invited you to join
        <strong>${esc(firmName)}</strong> on Profirmo as a
        <strong>${esc(roleLabel)}</strong>.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        You do not have a Profirmo account yet. Create one with this email
        address and your invitation will be waiting for you once your
        professional profile is approved.
      </p>
      ${button('Create your account', acceptUrl)}`;

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Firm Invitation</h1>
      ${isRegistered ? registeredBody : unregisteredBody}
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      `Hi ${inviteeName},`,
      '',
      `${inviterName} has invited you to join "${firmName}" on Profirmo as a`,
      `${roleLabel}.`,
      '',
      isRegistered
        ? 'Open your invitations to accept or decline this invitation:'
        : 'You do not have a Profirmo account yet. Create one with this ' +
          'email address and your invitation will be waiting for you:',
      acceptUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Admin-facing notice that a new law firm has registered.
   * vars: { firmName, ownerName, reviewUrl }
   */
  newFirmRegistration(vars = {}) {
    const firmName = vars.firmName || 'A new law firm';
    const ownerName = vars.ownerName || 'Unknown';
    const reviewUrl = vars.reviewUrl || '#';

    const subject = 'New Law Firm Registration Pending Review';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">New Firm Registration</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        A new law firm has registered on Profirmo and is awaiting admin
        approval.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">Firm Name</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            firmName
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6b7280;">Owner</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${esc(
            ownerName
          )}</td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Please review the firm registration and documents.
      </p>
      ${button('Review firm', reviewUrl)}
      <p style="margin:0;font-size:14px;line-height:1.6;">
        The Profirmo Team
      </p>`
    );

    const text = [
      'A new law firm has registered on Profirmo and is awaiting admin',
      'approval.',
      '',
      `  Firm Name: ${firmName}`,
      `  Owner:     ${ownerName}`,
      '',
      'Please review the firm registration and documents:',
      reviewUrl,
      '',
      'The Profirmo Team',
    ].join('\n');

    return { subject, html, text };
  },

  // --- Password reset (forgot-password + email OTP) ------------------------

  /**
   * Password-reset OTP message sent when a user requests a reset / resend.
   * vars: { userName, otp, organizationName }
   */
  passwordResetOtp(vars = {}) {
    const userName = vars.userName || 'there';
    const otp = vars.otp || '------';
    const organizationName = vars.organizationName || 'Profirmo';

    const subject = 'Password Reset Verification Code';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Password Reset Verification Code</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(userName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        We received a request to reset your account password.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Use the verification code below:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td align="center" style="padding:20px 36px;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;">
            <span style="font-size:38px;font-weight:700;letter-spacing:10px;color:#1d4ed8;font-family:Consolas,Menlo,monospace;">${esc(
              otp
            )}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        This code will expire in 10 minutes.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">
        If you did not request this password reset, you can safely ignore this
        email.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">
        For security reasons, never share this code with anyone.
      </p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;">
        Regards,<br />${esc(organizationName)}
      </p>`
    );

    const text = [
      `Dear ${userName},`,
      '',
      'We received a request to reset your account password.',
      '',
      'Use the verification code below:',
      '',
      `    ${otp}`,
      '',
      'This code will expire in 10 minutes.',
      '',
      'If you did not request this password reset, you can safely ignore',
      'this email.',
      '',
      'For security reasons, never share this code with anyone.',
      '',
      'Regards,',
      organizationName,
    ].join('\n');

    return { subject, html, text };
  },

  /**
   * Password-changed confirmation sent after a successful reset.
   * vars: { userName, dateTime, organizationName }
   */
  passwordChanged(vars = {}) {
    const userName = vars.userName || 'there';
    const dateTime = vars.dateTime || new Date().toLocaleString();
    const organizationName = vars.organizationName || 'Profirmo';

    const subject = 'Your Password Has Been Changed Successfully';

    const html = layout(
      subject,
      `
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your Password Has Been Changed Successfully</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Dear ${esc(userName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Your account password was successfully changed.
      </p>
      <p style="margin:0 0 12px;padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #16a34a;font-size:14px;line-height:1.6;color:#14532d;">
        Time: ${esc(dateTime)}
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">
        If this change was not made by you, please contact support
        immediately.
      </p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;">
        Regards,<br />${esc(organizationName)}
      </p>`
    );

    const text = [
      `Dear ${userName},`,
      '',
      'Your account password was successfully changed.',
      '',
      `Time: ${dateTime}`,
      '',
      'If this change was not made by you, please contact support',
      'immediately.',
      '',
      'Regards,',
      organizationName,
    ].join('\n');

    return { subject, html, text };
  },
};

/**
 * Render a named email template.
 * @param {string} name - template key in TEMPLATES
 * @param {object} vars - template variables
 * @returns {{ subject: string, html: string, text: string }}
 */
function renderTemplate(name, vars = {}) {
  const tpl = TEMPLATES[name];
  if (typeof tpl !== 'function') {
    throw new Error(`Unknown email template: ${name}`);
  }
  return tpl(vars);
}

module.exports = { renderTemplate, TEMPLATES };
