const nodemailer = require("nodemailer");

interface SendEmailPayload {
	to: string;
	cc?: string | string[];
	subject: string;
	text: string;
}

const toBoolean = (value: string | undefined): boolean => {
	return value === "true";
};

const hasSmtpConfig = (): boolean => {
	return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
};

const createTransporter = () => {
	if (!hasSmtpConfig()) {
		return null;
	}

	return nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port: Number(process.env.SMTP_PORT ?? 587),
		secure: toBoolean(process.env.SMTP_SECURE),
		auth:
			process.env.SMTP_USER && process.env.SMTP_PASS
				? {
						user: process.env.SMTP_USER,
						pass: process.env.SMTP_PASS
					}
				: undefined
	});
};

export const sendEmail = async ({ to, cc, subject, text }: SendEmailPayload): Promise<boolean> => {
	const transporter = createTransporter();

	if (!transporter) {
		return false;
	}

	await transporter.sendMail({
		from: process.env.SMTP_FROM,
		to,
		cc,
		subject,
		text
	});

	return true;
};

export default sendEmail;
