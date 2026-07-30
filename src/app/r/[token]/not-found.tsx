import { PatientNotice } from '@/components/patient/patient-notice';

export default function PatientNotFound() {
  return (
    <PatientNotice tone="alert" heading="This link is not available">
      The link may be incomplete or no longer active. The clinic can help you find your results.
    </PatientNotice>
  );
}
