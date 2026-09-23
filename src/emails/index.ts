import type { ComponentType } from "react";
import type { NotificationEventType } from "@/domain/notifications/events";
import AppointmentCancelledEmail from "@/emails/appointment-cancelled";
import AppointmentConfirmationRequestEmail from "@/emails/appointment-confirmation-request";
import AppointmentConfirmedEmail from "@/emails/appointment-confirmed";
import AppointmentCreatedEmail from "@/emails/appointment-created";
import AppointmentReminderEmail from "@/emails/appointment-reminder";
import AppointmentRescheduledEmail from "@/emails/appointment-rescheduled";
import FeedbackPublishedEmail from "@/emails/feedback-published";
import MaterialAssignedEmail from "@/emails/material-assigned";
import PaymentConfirmedEmail from "@/emails/payment-confirmed";
import SupplementRecommendationCreatedEmail from "@/emails/supplement-recommendation-created";
import type { AppointmentEmailProps } from "@/emails/types";

/** Template React Email por evento (prompt Fase 12 §32) — a chave é o evento; `TEMPLATE_KEY` dá o nome técnico. */
export const EMAIL_TEMPLATES: Record<NotificationEventType, ComponentType<AppointmentEmailProps>> = {
  APPOINTMENT_CREATED: AppointmentCreatedEmail,
  APPOINTMENT_RESCHEDULED: AppointmentRescheduledEmail,
  APPOINTMENT_CANCELLED: AppointmentCancelledEmail,
  APPOINTMENT_CONFIRMED: AppointmentConfirmedEmail,
  APPOINTMENT_REMINDER: AppointmentReminderEmail,
  APPOINTMENT_CONFIRMATION_REQUEST: AppointmentConfirmationRequestEmail,
  FEEDBACK_PUBLISHED: FeedbackPublishedEmail,
  MATERIAL_ASSIGNED: MaterialAssignedEmail,
  SUPPLEMENT_RECOMMENDATION_CREATED: SupplementRecommendationCreatedEmail,
  PAYMENT_CONFIRMED: PaymentConfirmedEmail,
};
