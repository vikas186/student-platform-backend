import { Sequelize } from 'sequelize';
import { sequelize } from '../config/database';
import UserModel from './User.model';
import SubscriptionPlanModel from './SubscriptionPlan.model';
import UniversityModel from './University.model';
import CourseModel from './Course.model';
import StudentProfileModel from './StudentProfile.model';
import AgentProfileModel from './AgentProfile.model';
import UniversityProfileModel from './UniversityProfile.model';
import ApplicationModel from './Application.model';
import DocumentModel from './Document.model';
import OfferLetterModel from './OfferLetter.model';
import PaymentModel from './Payment.model';
import DeadlineModel from './Deadline.model';
import CommissionModel from './Commission.model';
import AgentRankingModel from './AgentRanking.model';
import NotificationModel from './Notification.model';
import ActivityLogModel from './ActivityLog.model';
import ChatMessageModel from './ChatMessage.model';
import ChatSessionModel from './ChatSession.model';
import AssistantChatMessageModel from './AssistantChatMessage.model';
import ChatFeedbackModel from './ChatFeedback.model';
import TokenModel from './Token.model';
import ErrorLogModel from './ErrorLog.model';
import PasswordResetTokenModel from './PasswordResetToken.model';
import RolePermissionModel from './RolePermission.model';
import ScrapeJobModel from './ScrapeJob.model';
import RawScrapeBatchModel from './RawScrapeBatch.model';
import ScrapedCourseModel from './ScrapedCourse.model';
import ScrapeUniversityModel from './ScrapeUniversity.model';
import ScrapeFeeModel from './ScrapeFee.model';
import ScrapeScholarshipModel from './ScrapeScholarship.model';
import ScrapeRejectedPageModel from './ScrapeRejectedPage.model';
import ScrapeAiMetaModel from './ScrapeAiMeta.model';
import GoogleCalendarConnectionModel from './GoogleCalendarConnection.model';
import CounsellorAvailabilityModel from './CounsellorAvailability.model';
import AppointmentModel from './Appointment.model';

interface Db {
  User: ReturnType<typeof UserModel>;
  SubscriptionPlan: ReturnType<typeof SubscriptionPlanModel>;
  University: ReturnType<typeof UniversityModel>;
  Course: ReturnType<typeof CourseModel>;
  StudentProfile: ReturnType<typeof StudentProfileModel>;
  AgentProfile: ReturnType<typeof AgentProfileModel>;
  UniversityProfile: ReturnType<typeof UniversityProfileModel>;
  Application: ReturnType<typeof ApplicationModel>;
  Document: ReturnType<typeof DocumentModel>;
  OfferLetter: ReturnType<typeof OfferLetterModel>;
  Payment: ReturnType<typeof PaymentModel>;
  Deadline: ReturnType<typeof DeadlineModel>;
  Commission: ReturnType<typeof CommissionModel>;
  AgentRanking: ReturnType<typeof AgentRankingModel>;
  Notification: ReturnType<typeof NotificationModel>;
  ActivityLog: ReturnType<typeof ActivityLogModel>;
  ChatMessage: ReturnType<typeof ChatMessageModel>;
  ChatSession: ReturnType<typeof ChatSessionModel>;
  AssistantChatMessage: ReturnType<typeof AssistantChatMessageModel>;
  ChatFeedback: ReturnType<typeof ChatFeedbackModel>;
  Token: ReturnType<typeof TokenModel>;
  ErrorLogs: ReturnType<typeof ErrorLogModel>;
  PasswordResetToken: ReturnType<typeof PasswordResetTokenModel>;
  RolePermission: ReturnType<typeof RolePermissionModel>;
  ScrapeJob: ReturnType<typeof ScrapeJobModel>;
  RawScrapeBatch: ReturnType<typeof RawScrapeBatchModel>;
  ScrapedCourse: ReturnType<typeof ScrapedCourseModel>;
  ScrapeUniversity: ReturnType<typeof ScrapeUniversityModel>;
  ScrapeFee: ReturnType<typeof ScrapeFeeModel>;
  ScrapeScholarship: ReturnType<typeof ScrapeScholarshipModel>;
  ScrapeRejectedPage: ReturnType<typeof ScrapeRejectedPageModel>;
  ScrapeAiMeta: ReturnType<typeof ScrapeAiMetaModel>;
  GoogleCalendarConnection: ReturnType<typeof GoogleCalendarConnectionModel>;
  CounsellorAvailability: ReturnType<typeof CounsellorAvailabilityModel>;
  Appointment: ReturnType<typeof AppointmentModel>;
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  [key: string]: any;
}

const db: Db = {
  User: UserModel(sequelize),
  SubscriptionPlan: SubscriptionPlanModel(sequelize),
  University: UniversityModel(sequelize),
  Course: CourseModel(sequelize),
  StudentProfile: StudentProfileModel(sequelize),
  AgentProfile: AgentProfileModel(sequelize),
  UniversityProfile: UniversityProfileModel(sequelize),
  Application: ApplicationModel(sequelize),
  Document: DocumentModel(sequelize),
  OfferLetter: OfferLetterModel(sequelize),
  Payment: PaymentModel(sequelize),
  Deadline: DeadlineModel(sequelize),
  Commission: CommissionModel(sequelize),
  AgentRanking: AgentRankingModel(sequelize),
  Notification: NotificationModel(sequelize),
  ActivityLog: ActivityLogModel(sequelize),
  ChatMessage: ChatMessageModel(sequelize),
  ChatSession: ChatSessionModel(sequelize),
  AssistantChatMessage: AssistantChatMessageModel(sequelize),
  ChatFeedback: ChatFeedbackModel(sequelize),
  Token: TokenModel(sequelize),
  ErrorLogs: ErrorLogModel(sequelize),
  PasswordResetToken: PasswordResetTokenModel(sequelize),
  RolePermission: RolePermissionModel(sequelize),
  ScrapeJob: ScrapeJobModel(sequelize),
  RawScrapeBatch: RawScrapeBatchModel(sequelize),
  ScrapedCourse: ScrapedCourseModel(sequelize),
  ScrapeUniversity: ScrapeUniversityModel(sequelize),
  ScrapeFee: ScrapeFeeModel(sequelize),
  ScrapeScholarship: ScrapeScholarshipModel(sequelize),
  ScrapeRejectedPage: ScrapeRejectedPageModel(sequelize),
  ScrapeAiMeta: ScrapeAiMetaModel(sequelize),
  GoogleCalendarConnection: GoogleCalendarConnectionModel(sequelize),
  CounsellorAvailability: CounsellorAvailabilityModel(sequelize),
  Appointment: AppointmentModel(sequelize),
  sequelize,
  Sequelize,
};

Object.keys(db).forEach(modelName => {
  if (db[modelName]?.associate) {
    db[modelName].associate(db);
  }
});

export { db };
