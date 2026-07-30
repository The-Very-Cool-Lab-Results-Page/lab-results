'use client';

import { PatientNotice } from '@/components/patient/patient-notice';

export default function PatientError() {
  return (
    <PatientNotice tone="alert" heading="We could not open this page">
      Please try the link again. If it still does not open, the clinic can help.
    </PatientNotice>
  );
}
