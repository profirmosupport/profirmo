// Model registry + association definitions for the Profirmo backend.
//
// Requiring this module loads the Sequelize instance and every model, and
// wires up the foreign-key relationships ("table connections"). Associations
// declare real database FOREIGN KEY constraints with referential actions.
// Tables must be created parents-first (see SYNC_ORDER in server.js).

const sequelize = require('../config/database');

const User = require('./User');
const Session = require('./Session');
const Professional = require('./Professional');
const Firm = require('./Firm');
const ProfessionalClient = require('./ProfessionalClient');
const Case = require('./Case');
const Booking = require('./Booking');
const Consultation = require('./Consultation');
const Review = require('./Review');
const ReviewAppeal = require('./ReviewAppeal');
const CaseNote = require('./CaseNote');
const CaseLog = require('./CaseLog');
const CaseUpdate = require('./CaseUpdate');
const File = require('./File');
const Upload = require('./Upload');

// --- Phase-5 security models -----------------------------------------------
const AuditLog = require('./AuditLog');
const NewsletterSubscriber = require('./NewsletterSubscriber');
const SupportTicket = require('./SupportTicket');

// --- Phase-6 jobs / notifications models -----------------------------------
const Job = require('./Job');
const Notification = require('./Notification');
const ProfessionalReminder = require('./ProfessionalReminder');
const CaseTask = require('./CaseTask');
const GmailConnection = require('./GmailConnection');
const GmailMessageLink = require('./GmailMessageLink');
const UserPreference = require('./UserPreference');
const ClientComplianceProfile = require('./ClientComplianceProfile');
const ComplianceObligation = require('./ComplianceObligation');
const ClientDocument = require('./ClientDocument');
const ClientDocumentAccess = require('./ClientDocumentAccess');

// --- Phase-2 profile / firm models ----------------------------------------
const Address = require('./Address');
const ProfessionalDetail = require('./ProfessionalDetail');
const LawyerDetail = require('./LawyerDetail');
const TechConsultantDetail = require('./TechConsultantDetail');
const LawFirm = require('./LawFirm');
const FirmMember = require('./FirmMember');

// --- Phase-7 dynamic professional registration / approval models ----------
const TaxConsultantDetail = require('./TaxConsultantDetail');
const ProfessionalApproval = require('./ProfessionalApproval');

// --- Phase-8 firm approval workflow + invitation models -------------------
const FirmApproval = require('./FirmApproval');
const FirmInvitation = require('./FirmInvitation');
const FirmJoinRequest = require('./FirmJoinRequest');

// --- Password-reset OTP model ----------------------------------------------
// Stores email-OTP rows for the forgot-password / reset flow. userId and
// email are plain indexed columns — no association / FK is declared.
const PasswordResetOtp = require('./PasswordResetOtp');
const PhoneOtpCode = require('./PhoneOtpCode');

// --- App settings: taxonomy + locations -----------------------------------
// Admin-managed lists that drive every category / sub-category / location
// dropdown across the app. Cities now belong to States which belong to
// Countries, so signup + filter forms can cascade.
const Category = require('./Category');
const SubCategory = require('./SubCategory');
const Country = require('./Country');
const State = require('./State');
const City = require('./City');
// Admin-managed lookup of court case status codes (ABATED, PENDING, …)
// — surfaced by the Cases module + E-Courts integration.
const CaseStatus = require('./CaseStatus');
// Sibling lookups for case-type + cause-list-type. Same shape as
// CaseStatus, used in the same dropdowns.
const CaseType = require('./CaseType');
const CauseListType = require('./CauseListType');

// --- Sales pipeline: Lead -> Opportunity -> Client -------------------------
// Lead captured from the homepage CTA and the gated advanced-search popup,
// promoted to Opportunity by an admin and finally converted into a
// User(role=client). LeadActivity is the shared timeline for both entities.
const Lead = require('./Lead');
const Opportunity = require('./Opportunity');
const LeadActivity = require('./LeadActivity');

// --- Payment domain: Razorpay + escrow + wallet + payouts -----------------
const Payment = require('./Payment');
const EscrowEntry = require('./EscrowEntry');
const WalletTransaction = require('./WalletTransaction');
const PayoutRequest = require('./PayoutRequest');

// --- Booking notes (client + pro free-text on each booking) ---------------
const BookingNote = require('./BookingNote');

// --- Admin-managed platform settings (markup %, etc.) ---------------------
const AdminSetting = require('./AdminSetting');
// Admin-editable subject + body for every transactional email.
const EmailTemplate = require('./EmailTemplate');

// --- Blog / news content --------------------------------------------------
const BlogCategory = require('./BlogCategory');
const BlogTag = require('./BlogTag');
const BlogPost = require('./BlogPost');

// --- Subscription management ---------------------------------------------
const SubscriptionPlan = require('./SubscriptionPlan');
const SubscriptionFeatureRule = require('./SubscriptionFeatureRule');
const ProfessionalSubscription = require('./ProfessionalSubscription');
const SubscriptionPayment = require('./SubscriptionPayment');

// --- E-Courts India favourites -------------------------------------------
// Lightweight bookmarks of cases looked up via the partner API. No
// associations — userId + cnr are plain indexed columns.
const ECourtsFavorite = require('./ECourtsFavorite');

// --- Employee module: field agents who onboard professionals -------------
// Independent of User. Commissions + payouts reference the employee
// row directly. ProfessionalDetail picks up an additive employeeId /
// employeeCode column via the migration runner.
const Employee = require('./Employee');
const EmployeeCommission = require('./EmployeeCommission');
const EmployeePayout = require('./EmployeePayout');

// Optional relationship — clearing the parent nulls the foreign key.
const fkSetNull = (foreignKey) => ({
  foreignKey,
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// Ownership relationship — removing the parent removes the children.
const fkCascade = (foreignKey) => ({
  foreignKey,
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// --- Firm relationships ----------------------------------------------------
Firm.hasMany(Professional, fkSetNull('firmId'));
Professional.belongsTo(Firm, fkSetNull('firmId'));

// `cases.firmId` can be a legacy firm id (`firm-N`) OR a new-model
// `law_firms.id`. The column is a plain string at the application layer —
// no Sequelize association so Sequelize doesn't recreate a stale FK to the
// legacy `firms` table.

// Reviews are always against a professional; a firm's reviews are simply the
// collective reviews of its member professionals. No Firm <-> Review FK.

// --- Client relationships --------------------------------------------------
// Clients are first-class users (role='client') — there is no separate
// `clients` table. The `clientId` column on Case / Booking / Consultation /
// Review now references `users.id`. We do not declare a Sequelize association
// for it (the column is a plain string FK at the application layer, and
// historical rows pre-unification may still carry legacy ids).

// A professional <-> client-user link (many-to-many): one client-user can be
// linked to multiple professionals.
User.hasMany(ProfessionalClient, fkCascade('clientUserId'));
ProfessionalClient.belongsTo(User, {
  foreignKey: 'clientUserId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// --- Professional relationships -------------------------------------------
// `cases.professionalId`, `bookings.professionalId`, and
// `consultations.professionalId` can be either a legacy `professionals.id`
// OR a new-model `professional_details.id`. They're plain string columns at
// the application layer — no Sequelize association so Sequelize doesn't
// recreate stale FKs to the legacy `professionals` table.

// Reviews can reference either a legacy `professionals.id` or a new-model
// `professional_details.id`. The column is therefore a plain string at the
// application layer — no Sequelize association / FK constraint.

// --- Review appeals --------------------------------------------------------
// A review can be appealed; removing the review removes its appeal records.
Review.hasMany(ReviewAppeal, fkCascade('reviewId'));
ReviewAppeal.belongsTo(Review, fkCascade('reviewId'));

// --- Case notes + log ------------------------------------------------------
// Both cascade-delete with the case they belong to.
Case.hasMany(CaseNote, fkCascade('caseId'));
CaseNote.belongsTo(Case, fkCascade('caseId'));
Case.hasMany(CaseLog, fkCascade('caseId'));
CaseLog.belongsTo(Case, fkCascade('caseId'));
Case.hasMany(CaseUpdate, fkCascade('caseId'));
CaseUpdate.belongsTo(Case, fkCascade('caseId'));

// --- Booking <-> Consultation ---------------------------------------------
Booking.hasOne(Consultation, fkSetNull('bookingId'));
Consultation.belongsTo(Booking, fkSetNull('bookingId'));

// --- Case <-> File ---------------------------------------------------------
Case.hasMany(File, fkCascade('caseId'));
File.belongsTo(Case, fkCascade('caseId'));

// --- User <-> Session ------------------------------------------------------
// A user owns many persistent refresh-token sessions. Deleting the user
// removes their sessions.
User.hasMany(Session, fkCascade('userId'));
Session.belongsTo(User, fkCascade('userId'));

// --- User <-> Upload (Phase 4) ---------------------------------------------
// A user owns many uploaded files. Deleting the user removes the rows
// (the on-disk files are cleaned up explicitly via the file service).
User.hasMany(Upload, fkCascade('userId'));
Upload.belongsTo(User, fkCascade('userId'));

// --- User <-> Notification (Phase 6) ---------------------------------------
// A user receives many in-app notifications. Deleting the user removes them.
User.hasMany(Notification, fkCascade('userId'));
Notification.belongsTo(User, fkCascade('userId'));

// NOTE: User keeps linkedId / firmId as plain columns. linkedId is
// polymorphic (points to a client, professional or firm depending on role),
// so no association / constraint is declared for it.

// --- Phase-2 profile / firm relationships ---------------------------------
// One postal address per user.
User.hasOne(Address, fkCascade('userId'));
Address.belongsTo(User, fkCascade('userId'));

// One extended professional profile per user.
User.hasOne(ProfessionalDetail, fkCascade('userId'));
ProfessionalDetail.belongsTo(User, fkCascade('userId'));

// Type-specific detail tables hang off the shared professional profile.
ProfessionalDetail.hasOne(LawyerDetail, fkCascade('professionalId'));
LawyerDetail.belongsTo(ProfessionalDetail, fkCascade('professionalId'));

ProfessionalDetail.hasOne(TechConsultantDetail, fkCascade('professionalId'));
TechConsultantDetail.belongsTo(
  ProfessionalDetail,
  fkCascade('professionalId')
);

// Phase-7: tax-consultant-specific detail hangs off the shared profile.
ProfessionalDetail.hasOne(TaxConsultantDetail, fkCascade('professionalId'));
TaxConsultantDetail.belongsTo(
  ProfessionalDetail,
  fkCascade('professionalId')
);

// Phase-7: one approval-workflow record per professional user.
User.hasOne(ProfessionalApproval, fkCascade('userId'));
ProfessionalApproval.belongsTo(User, fkCascade('userId'));

// A user owns many law firms.
User.hasMany(LawFirm, fkCascade('ownerUserId'));
LawFirm.belongsTo(User, {
  foreignKey: 'ownerUserId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// Firm membership join: a firm has many members; a professional has many
// memberships.
LawFirm.hasMany(FirmMember, fkCascade('firmId'));
FirmMember.belongsTo(LawFirm, fkCascade('firmId'));

ProfessionalDetail.hasMany(FirmMember, fkCascade('professionalId'));
FirmMember.belongsTo(ProfessionalDetail, fkCascade('professionalId'));

// --- Phase-8 firm approval workflow ----------------------------------------
// One approval-workflow record per law firm. Removing the firm removes it.
LawFirm.hasOne(FirmApproval, fkCascade('firmId'));
FirmApproval.belongsTo(LawFirm, fkCascade('firmId'));

// --- Phase-8 firm invitations ----------------------------------------------
// A firm sends many invitations. Removing the firm removes its invitations.
LawFirm.hasMany(FirmInvitation, fkCascade('firmId'));
FirmInvitation.belongsTo(LawFirm, fkCascade('firmId'));

// A firm receives many join requests. Removing the firm removes them.
LawFirm.hasMany(FirmJoinRequest, fkCascade('firmId'));
FirmJoinRequest.belongsTo(LawFirm, fkCascade('firmId'));

// --- Payment domain --------------------------------------------------------
// Bookings → Payments (one-to-many: a booking can have a retried payment).
Booking.hasMany(Payment, fkSetNull('bookingId'));
Payment.belongsTo(Booking, fkSetNull('bookingId'));

// Payer → Payments (client). Cascade the payments off if the user is wiped.
User.hasMany(Payment, fkCascade('userId'));
Payment.belongsTo(User, fkCascade('userId'));

// One escrow row per Payment.
Payment.hasOne(EscrowEntry, fkCascade('paymentId'));
EscrowEntry.belongsTo(Payment, fkCascade('paymentId'));

// Wallet entries reference the professional whose wallet they belong to.
// Use CASCADE so a deleted pro doesn't leave orphan ledger rows.
User.hasMany(WalletTransaction, fkCascade('walletUserId'));
WalletTransaction.belongsTo(User, fkCascade('walletUserId'));

// Payout requests belong to the requesting professional.
User.hasMany(PayoutRequest, fkCascade('professionalUserId'));
PayoutRequest.belongsTo(User, fkCascade('professionalUserId'));

// Booking notes cascade off the parent booking + author.
Booking.hasMany(BookingNote, fkCascade('bookingId'));
BookingNote.belongsTo(Booking, fkCascade('bookingId'));
User.hasMany(BookingNote, fkCascade('authorUserId'));
BookingNote.belongsTo(User, fkCascade('authorUserId'));

// --- JSON normalization ----------------------------------------------------
// MariaDB exposes JSON columns as LONGTEXT, so the driver returns them as raw
// strings; `raw: true` queries also bypass model getters. This afterFind hook
// guarantees JSON fields are always parsed to arrays/objects in query results.
function jsonParser(fields) {
  return (result, options) => {
    if (!result || !options || !options.raw) return;
    const rows = Array.isArray(result) ? result : [result];
    for (const row of rows) {
      if (!row) continue;
      for (const field of fields) {
        if (typeof row[field] === 'string') {
          try {
            row[field] = JSON.parse(row[field]);
          } catch (err) {
            row[field] = [];
          }
        }
      }
    }
  };
}

Professional.addHook(
  'afterFind',
  jsonParser(['languages', 'servicesOffered', 'availabilitySlots'])
);
Firm.addHook('afterFind', jsonParser(['services', 'professionalIds']));

ProfessionalDetail.addHook(
  'afterFind',
  jsonParser([
    'skills',
    'expertise',
    'languages',
    'certifications',
    'education',
    'achievements',
    'certificationsDocuments',
    'availability',
    'subCategoryIds',
    'practiceCities',
    'courtsPracticing',
  ])
);

// --- Category <-> SubCategory ---------------------------------------------
Category.hasMany(SubCategory, fkCascade('categoryId'));
SubCategory.belongsTo(Category, fkCascade('categoryId'));

// --- Country <-> State <-> City -------------------------------------------
Country.hasMany(State, fkCascade('countryId'));
State.belongsTo(Country, fkCascade('countryId'));
State.hasMany(City, fkSetNull('stateId'));
City.belongsTo(State, fkSetNull('stateId'));
LawyerDetail.addHook(
  'afterFind',
  jsonParser([
    'practiceAreas',
    'courtPractice',
    'availability',
    'supportingCertificates',
  ])
);
TechConsultantDetail.addHook(
  'afterFind',
  jsonParser(['technologies', 'certifications', 'experienceProjects'])
);
TaxConsultantDetail.addHook(
  'afterFind',
  jsonParser(['specializationAreas', 'supportingCertifications'])
);
LawFirm.addHook(
  'afterFind',
  jsonParser(['practiceAreas', 'socialLinks', 'taxDocuments'])
);
Case.addHook('afterFind', jsonParser(['clientIds', 'professionalIds']));
CaseUpdate.addHook('afterFind', jsonParser(['attachments']));
CaseNote.addHook('afterFind', jsonParser(['attachments']));
Payment.addHook('afterFind', jsonParser(['rawOrder', 'rawPayment']));
WalletTransaction.addHook('afterFind', jsonParser(['metadata']));
BookingNote.addHook('afterFind', jsonParser(['attachments']));
BlogPost.addHook('afterFind', jsonParser(['tagIds']));

module.exports = {
  sequelize,
  User,
  Session,
  Professional,
  Firm,
  ProfessionalClient,
  Case,
  CaseUpdate,
  Booking,
  Consultation,
  Review,
  ReviewAppeal,
  CaseNote,
  CaseLog,
  File,
  Upload,
  Address,
  ProfessionalDetail,
  LawyerDetail,
  TechConsultantDetail,
  LawFirm,
  FirmMember,
  AuditLog,
  NewsletterSubscriber,
  SupportTicket,
  Job,
  Notification,
  TaxConsultantDetail,
  ProfessionalApproval,
  FirmApproval,
  FirmInvitation,
  FirmJoinRequest,
  PasswordResetOtp,
  PhoneOtpCode,
  Category,
  SubCategory,
  Country,
  State,
  City,
  CaseStatus,
  CaseType,
  CauseListType,
  Lead,
  Opportunity,
  LeadActivity,
  Payment,
  EscrowEntry,
  WalletTransaction,
  PayoutRequest,
  BookingNote,
  AdminSetting,
  EmailTemplate,
  BlogCategory,
  BlogTag,
  BlogPost,
  SubscriptionPlan,
  SubscriptionFeatureRule,
  ProfessionalSubscription,
  SubscriptionPayment,
  ECourtsFavorite,
  Employee,
  EmployeeCommission,
  EmployeePayout,
  ProfessionalReminder,
  CaseTask,
  GmailConnection,
  GmailMessageLink,
  UserPreference,
  ClientComplianceProfile,
  ComplianceObligation,
  ClientDocument,
  ClientDocumentAccess,
};
