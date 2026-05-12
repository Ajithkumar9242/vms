import React from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import dayjs from 'dayjs';

const ParentPrivacyPolicy = () => {
    const lastUpdated = dayjs().format('MMMM D, YYYY');

    const Section = ({ title, children }) => (
        <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                {title}
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}>
                {children}
            </div>
        </div>
    );

    return (
        <ParentLayout title="Privacy Policy" hideBottomNav>
            <div className="m-card" style={{ padding: 18 }}>
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                        Privacy Policy
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        Last updated: {lastUpdated}
                    </div>
                </div>

                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                    This Privacy Policy explains how VSS International School (“School”, “we”, “our”) collects, uses,
                    and protects information when you use the Parent Portal (“Portal”).
                </div>

                <Section title="1. Information we collect">
                    <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        <li>Parent/guardian details (name, phone number, email).</li>
                        <li>Student details linked to your account (name, class, roll/admission info).</li>
                        <li>Usage data like login timestamps and activity needed for security and audit logs.</li>
                        <li>Payments/transactions (amount, mode, reference) for receipts and verification.</li>
                        <li>Uploaded/downloaded documents where applicable (e.g., certificates).</li>
                    </ul>
                </Section>

                <Section title="2. How we use your information">
                    <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        <li>Provide Portal features: fees, attendance, exam results, notifications, documents.</li>
                        <li>Process payments and generate receipts/invoices.</li>
                        <li>Verify identity, prevent unauthorized access, and protect accounts.</li>
                        <li>Maintain audit logs for compliance and troubleshooting.</li>
                        <li>Send important communications related to school activities and updates.</li>
                    </ul>
                </Section>

                <Section title="3. Sharing of information">
                    <div>
                        We do not sell your personal information. Data may be shared only with:
                        <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                            <li>Authorized school staff (admin/principal/faculty) for legitimate school operations.</li>
                            <li>Payment providers (e.g., Razorpay/UPI) for transaction processing.</li>
                            <li>Storage providers (e.g., Cloudinary) to securely store files you access/download.</li>
                            <li>Legal authorities if required by law or to protect rights and safety.</li>
                        </ul>
                    </div>
                </Section>

                <Section title="4. Data security">
                    <div>
                        We use reasonable technical and organizational safeguards such as authentication,
                        role-based access control, and audit logging. However, no system is 100% secure.
                        Please keep your login/OTP private and contact the school immediately if you suspect misuse.
                    </div>
                </Section>

                <Section title="5. Data retention">
                    <div>
                        We retain information only as long as needed for school operations, legal compliance,
                        and audit purposes. Documents and receipts may be retained according to school policy.
                    </div>
                </Section>

                <Section title="6. Your rights & access">
                    <div>
                        You may request correction of inaccurate details or raise privacy concerns by contacting
                        the school administration. Access to student data is restricted to linked parents/guardians.
                    </div>
                </Section>

                <Section title="7. Contact">
                    <div>
                        For questions about this policy, contact the school administration through the Portal
                        or the school office.
                    </div>
                </Section>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E2E8F0', fontSize: 12, color: '#64748B' }}>
                    Note: This policy may be updated periodically. Continued use of the Portal indicates acceptance of updates.
                </div>
            </div>
        </ParentLayout>
    );
};

export default ParentPrivacyPolicy;