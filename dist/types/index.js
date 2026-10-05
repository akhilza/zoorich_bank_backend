"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentFrequency = exports.LoanStatus = exports.CardStatus = exports.KycStatus = exports.IdempotencyStatus = exports.LedgerEntryType = exports.TransactionStatus = exports.TransactionType = exports.AccountStatus = exports.AccountType = exports.UserStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["CUSTOMER"] = "CUSTOMER";
    Role["TELLER"] = "TELLER";
    Role["ADMIN"] = "ADMIN";
    Role["AUDITOR"] = "AUDITOR";
})(Role || (exports.Role = Role = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["FROZEN"] = "FROZEN";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var AccountType;
(function (AccountType) {
    AccountType["CHECKING"] = "CHECKING";
    AccountType["SAVINGS"] = "SAVINGS";
    AccountType["BUSINESS"] = "BUSINESS";
})(AccountType || (exports.AccountType = AccountType = {}));
var AccountStatus;
(function (AccountStatus) {
    AccountStatus["ACTIVE"] = "ACTIVE";
    AccountStatus["FROZEN"] = "FROZEN";
    AccountStatus["CLOSED"] = "CLOSED";
})(AccountStatus || (exports.AccountStatus = AccountStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["TRANSFER"] = "TRANSFER";
    TransactionType["DEPOSIT"] = "DEPOSIT";
    TransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    TransactionType["BILL_PAYMENT"] = "BILL_PAYMENT";
    TransactionType["LOAN_DISBURSEMENT"] = "LOAN_DISBURSEMENT";
    TransactionType["LOAN_REPAYMENT"] = "LOAN_REPAYMENT";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["COMPLETED"] = "COMPLETED";
    TransactionStatus["FAILED"] = "FAILED";
    TransactionStatus["REVERSED"] = "REVERSED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var LedgerEntryType;
(function (LedgerEntryType) {
    LedgerEntryType["DEBIT"] = "DEBIT";
    LedgerEntryType["CREDIT"] = "CREDIT";
})(LedgerEntryType || (exports.LedgerEntryType = LedgerEntryType = {}));
var IdempotencyStatus;
(function (IdempotencyStatus) {
    IdempotencyStatus["PROCESSING"] = "PROCESSING";
    IdempotencyStatus["RESOLVED"] = "RESOLVED";
    IdempotencyStatus["REJECTED"] = "REJECTED";
})(IdempotencyStatus || (exports.IdempotencyStatus = IdempotencyStatus = {}));
var KycStatus;
(function (KycStatus) {
    KycStatus["PENDING"] = "PENDING";
    KycStatus["APPROVED"] = "APPROVED";
    KycStatus["REJECTED"] = "REJECTED";
})(KycStatus || (exports.KycStatus = KycStatus = {}));
var CardStatus;
(function (CardStatus) {
    CardStatus["ACTIVE"] = "ACTIVE";
    CardStatus["FROZEN"] = "FROZEN";
    CardStatus["CANCELLED"] = "CANCELLED";
})(CardStatus || (exports.CardStatus = CardStatus = {}));
var LoanStatus;
(function (LoanStatus) {
    LoanStatus["PENDING"] = "PENDING";
    LoanStatus["APPROVED"] = "APPROVED";
    LoanStatus["ACTIVE"] = "ACTIVE";
    LoanStatus["REPAID"] = "REPAID";
    LoanStatus["REJECTED"] = "REJECTED";
})(LoanStatus || (exports.LoanStatus = LoanStatus = {}));
var PaymentFrequency;
(function (PaymentFrequency) {
    PaymentFrequency["DAILY"] = "DAILY";
    PaymentFrequency["WEEKLY"] = "WEEKLY";
    PaymentFrequency["MONTHLY"] = "MONTHLY";
})(PaymentFrequency || (exports.PaymentFrequency = PaymentFrequency = {}));
